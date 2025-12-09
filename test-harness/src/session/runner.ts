/**
 * Session Runner
 *
 * Main orchestration loop. Generates random group, runs character creation,
 * executes main loop until story ends or max turns reached.
 */

import { nanoid } from 'nanoid';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, streamText } from 'ai';
import type { ArchetypeId } from '../archetypes/types';
import { ARCHETYPES, ARCHETYPE_MODEL_MAP } from '../archetypes/definitions';
import type { PlayerAgent, StoryContext } from '../agents/player';
import { createPlayerAgent } from '../agents/player';
import type { NarratorConfig } from '../agents/narrator';
import { NARRATOR_MODEL_MAP, getNarratorProvider } from '../agents/narrator';
import type { Message } from './turn';
import { executeTurn, buildTurnContext } from './turn';
import type { SessionConfig, Checkpoint } from '../checkpoint/schema';
import { createCheckpoint } from '../checkpoint/schema';
import { saveCheckpoint } from '../checkpoint/save';
import { PrivateMomentTracker } from './private';

export type SessionOutcome = 'completed' | 'timeout' | 'failed';

export interface SessionResult {
  sessionId: string;
  config: SessionConfig;
  conversationHistory: Message[];
  outcome: SessionOutcome;
  finalTurn: number;
  duration: number;
  detectedPulses: number[];
  privateMoments: any[];
  tangents: any[];
  error?: string;
}

export interface SessionRunnerConfig {
  story: StoryContext;
  systemPrompt: string;
  storyGuide: string;
  narratorModel: NarratorConfig['model'];
  groupSize?: number; // If not specified, random 2-5
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Generate random group composition
 */
export function generateGroupComposition(size?: number): ArchetypeId[] {
  const groupSize = size || Math.floor(Math.random() * 4) + 2; // 2-5 players
  const archetypeIds = ARCHETYPES.map((a) => a.id);

  const group: ArchetypeId[] = [];
  for (let i = 0; i < groupSize; i++) {
    const randomId = archetypeIds[Math.floor(Math.random() * archetypeIds.length)];
    if (randomId) group.push(randomId);
  }

  return group;
}

/**
 * Create session configuration
 */
export function createSessionConfig(
  config: SessionRunnerConfig,
  playerAgents: PlayerAgent[],
  spokesperson: PlayerAgent,
): SessionConfig {
  const sessionId = nanoid();

  return {
    sessionId,
    story: config.story,
    systemPrompt: config.systemPrompt,
    storyGuide: config.storyGuide,
    narratorConfig: {
      model: config.narratorModel,
      systemPrompt: config.systemPrompt,
      storyGuide: config.storyGuide,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000,
    },
    group: {
      players: playerAgents,
      spokesperson,
      size: playerAgents.length,
    },
    maxTurns: config.maxTurns || 100,
    createdAt: Date.now(),
  };
}

/**
 * Initialize narrator with system prompt
 */
function buildNarratorSystemPrompt(
  systemPrompt: string,
  storyGuide: string,
  playerNames: string[],
): string {
  return `${systemPrompt}

STORY GUIDE:
${storyGuide}

PLAYERS IN THIS SESSION:
${playerNames.join(', ')}

Remember:
- Track story progress through ~20 pulses (story beats)
- Handle tangents gracefully and return to narrative
- Occasionally address individual players for private moments
- Keep the story engaging and immersive
- End the story when you reach a satisfying conclusion`;
}

/**
 * Generate narrator response
 */
async function generateNarratorResponse(
  conversationHistory: Message[],
  narratorConfig: NarratorConfig,
  playerNames: string[],
): Promise<string> {
  const provider = getNarratorProvider(narratorConfig.model);
  const modelId = NARRATOR_MODEL_MAP[narratorConfig.model];

  if (!modelId) {
    throw new Error(`Unknown narrator model: ${narratorConfig.model}`);
  }

  const systemPrompt = buildNarratorSystemPrompt(
    narratorConfig.systemPrompt,
    narratorConfig.storyGuide,
    playerNames,
  );

  const messages = conversationHistory.map((m) => ({
    role: m.role === 'narrator' ? 'assistant' : 'user',
    content:
      m.role === 'player'
        ? `${m.player}: ${m.content}`
        : m.role === 'spokesperson'
          ? `Spokesperson (${m.player}): ${m.content}`
          : m.content,
  }));

  try {
    if (provider === 'anthropic') {
      const { text } = await generateText({
        model: anthropic(modelId),
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ] as any,
        temperature: narratorConfig.temperature,
        maxTokens: narratorConfig.maxTokens,
      });
      return text;
    } else {
      // OpenRouter
      const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
      });

      const { text } = await generateText({
        model: openrouter(modelId),
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ] as any,
        temperature: narratorConfig.temperature,
        maxTokens: narratorConfig.maxTokens,
      });
      return text;
    }
  } catch (error) {
    console.error('Narrator generation error:', error);
    throw error;
  }
}

/**
 * Generate player response
 */
async function generatePlayerResponse(
  agent: PlayerAgent,
  narratorOutput: string,
  conversationHistory: Message[],
): Promise<string> {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const recentHistory = conversationHistory.slice(-10); // Last 10 messages for context

  const messages = [
    { role: 'system', content: agent.systemPrompt },
    ...recentHistory.map((m) => ({
      role: m.role === 'narrator' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'assistant', content: narratorOutput },
    {
      role: 'user',
      content: `${agent.name}, what is your reaction to this? Respond in character.`,
    },
  ];

  try {
    const { text } = await generateText({
      model: openrouter(agent.modelId),
      messages: messages as any,
      temperature: 0.8,
      maxTokens: 150,
    });

    return text;
  } catch (error) {
    console.error(`Player response error for ${agent.name}:`, error);
    return `[${agent.name} is thinking...]`;
  }
}

/**
 * Generate spokesperson synthesis
 */
async function generateSpokespersonSynthesis(
  spokesperson: PlayerAgent,
  playerResponses: Array<{ agent: PlayerAgent; response: string }>,
  narratorOutput: string,
): Promise<string> {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const responsesText = playerResponses
    .map((r) => `${r.agent.name}: "${r.response}"`)
    .join('\n');

  const synthesisPrompt = `The group just heard from the narrator:
"${narratorOutput}"

Individual player responses:
${responsesText}

As ${spokesperson.name}, synthesize these responses into a single coherent message to relay back to the narrator. Keep it concise and preserve important details.`;

  try {
    const { text } = await generateText({
      model: openrouter(spokesperson.modelId),
      messages: [
        { role: 'system', content: spokesperson.systemPrompt },
        { role: 'user', content: synthesisPrompt },
      ] as any,
      temperature: 0.7,
      maxTokens: 200,
    });

    return text;
  } catch (error) {
    console.error('Spokesperson synthesis error:', error);
    // Fallback to simple concatenation
    return playerResponses.map((r) => r.response).join(' ');
  }
}

/**
 * Character creation phase
 */
async function runCharacterCreation(
  narratorConfig: NarratorConfig,
  playerAgents: PlayerAgent[],
  storyContext: StoryContext,
): Promise<Message[]> {
  const messages: Message[] = [];
  const timestamp = Date.now();

  // Narrator introduces and asks for characters
  const intro = await generateNarratorResponse(
    [],
    narratorConfig,
    playerAgents.map((a) => a.name),
  );

  messages.push({
    role: 'narrator',
    content: intro,
    turn: 0,
    timestamp,
  });

  // Players introduce their characters
  for (const agent of playerAgents) {
    messages.push({
      role: 'player',
      player: agent.name,
      content: `I'm ${agent.name}. ${agent.generatedBackstory}`,
      turn: 0,
      timestamp,
    });
  }

  return messages;
}

/**
 * Detect if session should end
 */
function shouldEndSession(
  narratorOutput: string,
  turn: number,
  maxTurns: number,
  pulseCount: number,
): { shouldEnd: boolean; reason: string } {
  // Max turns reached
  if (turn >= maxTurns) {
    return { shouldEnd: true, reason: 'timeout' };
  }

  // Story completion indicators
  const completionPatterns = [
    /the end/i,
    /story concludes/i,
    /journey ends/i,
    /finally over/i,
    /epilogue/i,
  ];

  if (completionPatterns.some((p) => p.test(narratorOutput))) {
    return { shouldEnd: true, reason: 'completed' };
  }

  // If we've done 20+ pulses and narrator seems to be wrapping up
  if (pulseCount >= 20 && narratorOutput.length > 200) {
    return { shouldEnd: false, reason: '' };
  }

  return { shouldEnd: false, reason: '' };
}

/**
 * Run a complete session
 */
export async function runSession(config: SessionRunnerConfig): Promise<SessionResult> {
  const startTime = Date.now();

  try {
    // 1. Generate group composition
    const archetypeIds = generateGroupComposition(config.groupSize);
    const playerAgents = archetypeIds.map((id) => createPlayerAgent(id, config.story));

    // 2. Select random spokesperson
    const spokesperson =
      playerAgents[Math.floor(Math.random() * playerAgents.length)] || playerAgents[0];
    if (!spokesperson) {
      throw new Error('No players generated');
    }

    // 3. Create session config
    const sessionConfig = createSessionConfig(config, playerAgents, spokesperson);
    const sessionId = sessionConfig.sessionId;

    console.log(`\n🎬 Starting session ${sessionId}`);
    console.log(`📖 Story: ${config.story.storyTitle}`);
    console.log(
      `👥 Group (${playerAgents.length}): ${playerAgents.map((a) => `${a.name} (${a.archetype})`).join(', ')}`,
    );
    console.log(`🎙️  Spokesperson: ${spokesperson.name}`);
    console.log(`🤖 Narrator: ${config.narratorModel}\n`);

    // 4. Character creation phase
    let conversationHistory = await runCharacterCreation(
      sessionConfig.narratorConfig,
      playerAgents,
      config.story,
    );

    // 5. Initialize tracking
    const privateMomentTracker = new PrivateMomentTracker();
    const detectedPulses: number[] = [];
    const tangents: any[] = [];
    let outcome: SessionOutcome = 'timeout';

    // 6. Main session loop
    for (let turn = 1; turn <= sessionConfig.maxTurns; turn++) {
      console.log(`\n--- Turn ${turn} ---`);

      try {
        // Generate narrator output
        const narratorOutput = await generateNarratorResponse(
          conversationHistory,
          sessionConfig.narratorConfig,
          playerAgents.map((a) => a.name),
        );

        console.log(`\n📖 Narrator: ${narratorOutput.substring(0, 200)}...`);

        // Classify output
        const { classifyOutput } = await import('./classifier');
        const classification = await classifyOutput(narratorOutput, {
          previousPulseCount: detectedPulses.length,
          playerNames: playerAgents.map((a) => a.name),
        });

        console.log(`🏷️  Classified as: ${classification.type}`);

        if (classification.type === 'pulse') {
          detectedPulses.push(turn);
          console.log(`💓 Pulse ${detectedPulses.length}/~20`);
        }

        // Add narrator message
        conversationHistory.push({
          role: 'narrator',
          content: narratorOutput,
          turn,
          timestamp: Date.now(),
          classification: classification.type,
        });

        // Check for private moment
        const { routePrivateMoment } = await import('./private');
        const privateRouting = routePrivateMoment(narratorOutput, playerAgents);

        if (privateRouting.isPrivate && privateRouting.targetAgent) {
          // Private moment
          console.log(`🔒 Private moment for ${privateRouting.targetAgent.name}`);

          const response = await generatePlayerResponse(
            privateRouting.targetAgent,
            narratorOutput,
            conversationHistory,
          );

          conversationHistory.push({
            role: 'player',
            player: privateRouting.targetAgent.name,
            content: response,
            turn,
            timestamp: Date.now(),
          });

          privateMomentTracker.add({
            turn,
            target: privateRouting.targetAgent.name,
            content: narratorOutput,
            response,
          });
        } else {
          // Group interaction
          const playerResponses = await Promise.all(
            playerAgents.map(async (agent) => ({
              agent,
              response: await generatePlayerResponse(agent, narratorOutput, conversationHistory),
            })),
          );

          console.log(
            `👥 Player responses:\n${playerResponses.map((r) => `  ${r.agent.name}: ${r.response.substring(0, 80)}...`).join('\n')}`,
          );

          // Spokesperson synthesis
          const synthesis = await generateSpokespersonSynthesis(
            spokesperson,
            playerResponses,
            narratorOutput,
          );

          console.log(`🎙️  Spokesperson: ${synthesis.substring(0, 100)}...`);

          // Add to history
          for (const { agent, response } of playerResponses) {
            conversationHistory.push({
              role: 'player',
              player: agent.name,
              content: response,
              turn,
              timestamp: Date.now(),
            });
          }

          conversationHistory.push({
            role: 'spokesperson',
            player: spokesperson.name,
            content: synthesis,
            turn,
            timestamp: Date.now(),
          });
        }

        // Save checkpoint
        const checkpoint = createCheckpoint(
          sessionId,
          turn,
          conversationHistory,
          playerAgents,
          spokesperson,
          sessionConfig,
          detectedPulses,
          tangents,
          privateMomentTracker.getAll(),
        );

        await saveCheckpoint(checkpoint);

        // Check if session should end
        const endCheck = shouldEndSession(
          narratorOutput,
          turn,
          sessionConfig.maxTurns,
          detectedPulses.length,
        );

        if (endCheck.shouldEnd) {
          outcome = endCheck.reason === 'timeout' ? 'timeout' : 'completed';
          console.log(`\n✅ Session ended: ${outcome}`);
          break;
        }
      } catch (turnError) {
        console.error(`Error in turn ${turn}:`, turnError);
        outcome = 'failed';
        break;
      }
    }

    const duration = Date.now() - startTime;

    return {
      sessionId,
      config: sessionConfig,
      conversationHistory,
      outcome,
      finalTurn: conversationHistory[conversationHistory.length - 1]?.turn || 0,
      duration,
      detectedPulses,
      privateMoments: privateMomentTracker.getAll(),
      tangents,
    };
  } catch (error) {
    console.error('Session error:', error);
    return {
      sessionId: 'error',
      config: null as any,
      conversationHistory: [],
      outcome: 'failed',
      finalTurn: 0,
      duration: Date.now() - startTime,
      detectedPulses: [],
      privateMoments: [],
      tangents: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
