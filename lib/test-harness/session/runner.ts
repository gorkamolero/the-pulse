/**
 * Session Runner
 *
 * Main orchestration loop. Generates random group, runs character creation,
 * executes main loop until story ends or max turns reached.
 */

import { nanoid } from 'nanoid';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, type LanguageModelUsage } from 'ai';
import type { ArchetypeId } from '../archetypes/types';
import { ARCHETYPES } from '../archetypes/definitions';
import { getNextFallbackModel } from '../archetypes/types';
import type { PlayerAgent, StoryContext } from '../agents/player';
import { createPlayerAgents } from '../agents/player';
import type { NarratorConfig } from '../agents/narrator';
import { NARRATOR_MODEL_MAP } from '../agents/narrator';
import type { Message } from './turn';
import type { SessionConfig, Checkpoint } from '../checkpoint/schema';
import { createCheckpoint } from '../checkpoint/schema';
import { saveCheckpoint } from '../checkpoint/save';
import { PrivateMomentTracker } from './private';
import { CostTracker, type CostBreakdown } from './cost';
import {
  TangentTracker,
  type TangentAnalysis,
  type TangentMoment,
} from './tangent';
import { runDiscussion } from './discussion';
import {
  collectPlayerFeedback,
  synthesizeFeedback,
  type SessionFeedback,
} from './feedback';

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
  tangents: TangentMoment[];
  tangentAnalysis?: TangentAnalysis;
  costBreakdown?: CostBreakdown;
  playerFeedback?: SessionFeedback;
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
  language?: string; // Output language (english, spanish, etc.)
}

/**
 * Generate random group composition
 */
export function generateGroupComposition(size?: number): ArchetypeId[] {
  const groupSize = size || Math.floor(Math.random() * 4) + 2; // 2-5 players
  const archetypeIds = ARCHETYPES.map((a) => a.id);

  const group: ArchetypeId[] = [];
  for (let i = 0; i < groupSize; i++) {
    const randomId =
      archetypeIds[Math.floor(Math.random() * archetypeIds.length)];
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
): Promise<{ text: string; usage: LanguageModelUsage }> {
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

  // All narrator models use OpenRouter
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  try {
    const result = streamText({
      model: openrouter(modelId),
      messages: [{ role: 'system', content: systemPrompt }, ...messages] as any,
      temperature: narratorConfig.temperature,
    });

    // Stream to console
    let fullText = '';
    process.stdout.write('\n📖 Narrator: ');
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullText += chunk;
    }
    process.stdout.write('\n');

    const usage = await result.usage;
    return { text: fullText, usage };
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
): Promise<{ text: string; usage: LanguageModelUsage }> {
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

  // Track tried models for fallback
  const triedModels: string[] = [];
  let currentModelId = agent.modelId;

  while (true) {
    triedModels.push(currentModelId);

    try {
      const result = streamText({
        model: openrouter(currentModelId),
        messages: messages as any,
        temperature: 0.8,
      });

      // Stream to console (note if using fallback)
      const modelNote =
        currentModelId !== agent.modelId ? ` [${currentModelId}]` : '';
      let fullText = '';
      process.stdout.write(`\n👤 ${agent.name}${modelNote}: `);
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullText += chunk;
      }
      process.stdout.write('\n');

      const usage = await result.usage;
      return { text: fullText, usage };
    } catch (error) {
      console.warn(
        `   ⚠ ${agent.name} model failed (${currentModelId}), trying fallback...`,
      );

      const nextModel = getNextFallbackModel(triedModels);
      if (nextModel) {
        currentModelId = nextModel;
        continue;
      }

      // All models exhausted
      console.error(`   ✗ All models failed for ${agent.name}`);
      throw error;
    }
  }
}

/**
 * Generate directed response for player-specific questions
 * Used when narrator asks specific players directly (not private, but targeted)
 */
async function generateDirectedResponse(
  agent: PlayerAgent,
  narratorOutput: string,
  conversationHistory: Message[],
): Promise<{ text: string; usage: LanguageModelUsage }> {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const recentHistory = conversationHistory.slice(-10);

  const messages = [
    { role: 'system', content: agent.systemPrompt },
    ...recentHistory.map((m) => ({
      role: m.role === 'narrator' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'assistant', content: narratorOutput },
    {
      role: 'user',
      content: `The narrator has asked YOU (${agent.name}) specific questions directly.

Answer ONLY the questions addressed to you. Do not answer questions meant for other players.

Respond in character as ${agent.name}.`,
    },
  ];

  // Track tried models for fallback
  const triedModels: string[] = [];
  let currentModelId = agent.modelId;

  while (true) {
    triedModels.push(currentModelId);

    try {
      const result = streamText({
        model: openrouter(currentModelId),
        messages: messages as any,
        temperature: 0.8,
      });

      // Stream to console (note if using fallback)
      const modelNote =
        currentModelId !== agent.modelId ? ` [${currentModelId}]` : '';
      let fullText = '';
      process.stdout.write(`\n👤 ${agent.name}${modelNote}: `);
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullText += chunk;
      }
      process.stdout.write('\n');

      const usage = await result.usage;
      return { text: fullText, usage };
    } catch (error) {
      console.warn(
        `   ⚠ ${agent.name} model failed (${currentModelId}), trying fallback...`,
      );

      const nextModel = getNextFallbackModel(triedModels);
      if (nextModel) {
        currentModelId = nextModel;
        continue;
      }

      // All models exhausted
      console.error(`   ✗ All models failed for ${agent.name}`);
      throw error;
    }
  }
}

/**
 * Generate spokesperson synthesis
 */
async function generateSpokespersonSynthesis(
  spokesperson: PlayerAgent,
  playerResponses: Array<{ agent: PlayerAgent; response: string }>,
  narratorOutput: string,
): Promise<{ text: string; usage: LanguageModelUsage }> {
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

  const messages = [
    { role: 'system', content: spokesperson.systemPrompt },
    { role: 'user', content: synthesisPrompt },
  ];

  // Track tried models for fallback
  const triedModels: string[] = [];
  let currentModelId = spokesperson.modelId;

  while (true) {
    triedModels.push(currentModelId);

    try {
      const result = streamText({
        model: openrouter(currentModelId),
        messages: messages as any,
        temperature: 0.7,
      });

      // Stream to console (note if using fallback)
      const modelNote =
        currentModelId !== spokesperson.modelId ? ` [${currentModelId}]` : '';
      let fullText = '';
      process.stdout.write(
        `\n🎙️ ${spokesperson.name}${modelNote} (spokesperson): `,
      );
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullText += chunk;
      }
      process.stdout.write('\n');

      const usage = await result.usage;
      return { text: fullText, usage };
    } catch (error) {
      console.warn(
        `   ⚠ Spokesperson model failed (${currentModelId}), trying fallback...`,
      );

      const nextModel = getNextFallbackModel(triedModels);
      if (nextModel) {
        currentModelId = nextModel;
        continue;
      }

      // All models exhausted
      console.error(`   ✗ All models failed for spokesperson`);
      throw error;
    }
  }
}

/**
 * Detect if session should end
 */
function shouldEndSession(
  classificationType: string,
  turn: number,
  maxTurns: number,
): { shouldEnd: boolean; reason: string } {
  // Max turns reached
  if (turn >= maxTurns) {
    return { shouldEnd: true, reason: 'timeout' };
  }

  // Classifier detected story ending
  if (classificationType === 'ending') {
    return { shouldEnd: true, reason: 'completed' };
  }

  return { shouldEnd: false, reason: '' };
}

/**
 * Resume session from checkpoint
 */
export async function resumeSessionFromCheckpoint(
  checkpoint: Checkpoint,
): Promise<SessionResult> {
  const startTime = Date.now();

  try {
    console.log(`\n🔄 Resuming from turn ${checkpoint.turn}`);
    console.log(
      `📖 ${checkpoint.sessionConfig.story.storyTitle} | 🤖 ${checkpoint.sessionConfig.narratorConfig.model}\n`,
    );

    const sessionConfig = checkpoint.sessionConfig;
    const playerAgents = checkpoint.playerAgents;
    const spokesperson = playerAgents.find(
      (a) => a.archetype === checkpoint.spokespersonId,
    );

    if (!spokesperson) {
      throw new Error('Spokesperson not found in checkpoint');
    }

    // Restore tracking state
    const privateMomentTracker = new PrivateMomentTracker();
    for (const pm of checkpoint.privateMoments) {
      privateMomentTracker.add(pm);
    }

    const tangentTracker = new TangentTracker();
    // Note: Tangent tracker state is not restored from checkpoint
    // It will start fresh for the remainder of the session

    // Initialize cost tracker
    const costTracker = new CostTracker(
      NARRATOR_MODEL_MAP[sessionConfig.narratorConfig.model] || '',
      playerAgents.map((a) => a.modelId),
    );

    const conversationHistory = [...checkpoint.conversationHistory];
    const detectedPulses = [...checkpoint.detectedPulses];
    let outcome: SessionOutcome = 'timeout';

    // Continue from next turn
    const startTurn = checkpoint.turn + 1;

    // Main session loop (same as runSession)
    for (let turn = startTurn; turn <= sessionConfig.maxTurns; turn++) {
      console.log(`\n--- Turn ${turn} ---`);

      try {
        // Generate narrator output
        const { text: narratorOutput, usage: narratorUsage } =
          await generateNarratorResponse(
            conversationHistory,
            sessionConfig.narratorConfig,
            playerAgents.map((a) => a.name),
          );

        costTracker.recordNarratorUsage(narratorUsage);

        // Narrator output already streamed above

        // Classify output
        const { classifyOutput } = await import('./classifier');
        const classification = await classifyOutput(narratorOutput, {
          previousPulseCount: detectedPulses.length,
          playerNames: playerAgents.map((a) => a.name),
        });

        if (classification.usage) {
          costTracker.recordClassificationUsage(classification.usage);
        }

        console.log(`🏷️  Classified as: ${classification.type}`);

        if (classification.type === 'pulse') {
          detectedPulses.push(turn);
          console.log(`💓 Pulse ${detectedPulses.length}/~20`);
        }

        // Track tangent if detected
        if (classification.type === 'tangent-response') {
          console.log(`🌀 Tangent detected`);
        }

        // Add narrator message
        conversationHistory.push({
          role: 'narrator',
          content: narratorOutput,
          turn,
          timestamp: Date.now(),
          classification: classification.type,
        });

        // Check for private moment payoffs
        const payoffs = await privateMomentTracker.checkPayoff(
          turn,
          narratorOutput,
        );
        if (payoffs.length > 0) {
          console.log(
            `💎 Payoffs detected: ${payoffs.map((p) => p.target).join(', ')}`,
          );
        }

        // Check for requires-discussion first (major group decisions)
        if (classification.type === 'requires-discussion') {
          console.log(`🗣️  Discussion required`);

          const discussionResult = await runDiscussion(
            narratorOutput,
            playerAgents,
            spokesperson,
            costTracker,
          );

          // Add spokesperson synthesis to history
          conversationHistory.push({
            role: 'spokesperson',
            player: spokesperson.name,
            content: discussionResult.spokespersonMessage,
            turn,
            timestamp: Date.now(),
          });

          // Check for directed questions (public but targeted)
        } else if (
          classification.type === 'directed-questions' &&
          classification.targetPlayers?.length
        ) {
          console.log(
            `🎯 Directed questions for: ${classification.targetPlayers.join(', ')}`,
          );

          // Collect responses from ONLY targeted players, sequentially
          for (const targetName of classification.targetPlayers) {
            const agent = playerAgents.find(
              (a) => a.name.toLowerCase() === targetName.toLowerCase(),
            );
            if (agent) {
              const { text: response, usage: playerUsage } =
                await generateDirectedResponse(
                  agent,
                  narratorOutput,
                  conversationHistory,
                );

              costTracker.recordPlayerUsage(playerUsage);

              conversationHistory.push({
                role: 'player',
                player: agent.name,
                content: response,
                turn,
                timestamp: Date.now(),
              });
            }
          }
          // NO spokesperson synthesis - responses are individual
        } else {
          // Check for private moment
          const { routePrivateMoment } = await import('./private');
          const privateRouting = routePrivateMoment(
            narratorOutput,
            playerAgents,
          );

          if (privateRouting.isPrivate && privateRouting.targetAgent) {
            // Private moment
            console.log(
              `🔒 Private moment for ${privateRouting.targetAgent.name}`,
            );

            const { text: response, usage: playerUsage } =
              await generatePlayerResponse(
                privateRouting.targetAgent,
                narratorOutput,
                conversationHistory,
              );

            costTracker.recordPlayerUsage(playerUsage);

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
            // Group interaction - sequential to avoid garbled streaming output
            const playerResponses: Array<{
              agent: PlayerAgent;
              response: string;
            }> = [];

            for (const agent of playerAgents) {
              const result = await generatePlayerResponse(
                agent,
                narratorOutput,
                conversationHistory,
              );
              costTracker.recordPlayerUsage(result.usage);
              playerResponses.push({ agent, response: result.text });
            }

            // Spokesperson synthesis
            const { text: synthesis, usage: spokespersonUsage } =
              await generateSpokespersonSynthesis(
                spokesperson,
                playerResponses,
                narratorOutput,
              );

            costTracker.recordPlayerUsage(spokespersonUsage);

            // Spokesperson synthesis already streamed above

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

            // Record tangent tracking with player responses
            tangentTracker.recordTangent(
              turn,
              playerResponses.map((r) => r.response),
              narratorOutput,
              classification,
            );
          }
        }

        // Save checkpoint
        const newCheckpoint = createCheckpoint(
          checkpoint.sessionId,
          turn,
          conversationHistory,
          playerAgents,
          spokesperson,
          sessionConfig,
          detectedPulses,
          tangentTracker.getAnalysis().moments,
          privateMomentTracker.getAll(),
          {
            parentCheckpoint: checkpoint.metadata.parentCheckpoint,
            branchReason: checkpoint.metadata.branchReason,
          },
        );

        await saveCheckpoint(newCheckpoint);

        // Check if session should end
        const endCheck = shouldEndSession(
          classification.type,
          turn,
          sessionConfig.maxTurns,
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

    // Finalize tangent tracking
    tangentTracker.finalize();
    const tangentAnalysis = tangentTracker.getAnalysis();

    // Collect player feedback if story completed successfully
    let playerFeedback: SessionFeedback | undefined;
    if (outcome === 'completed') {
      try {
        const feedbackList = await collectPlayerFeedback(
          playerAgents,
          conversationHistory,
          costTracker,
        );
        playerFeedback = synthesizeFeedback(checkpoint.sessionId, feedbackList);
      } catch (feedbackError) {
        console.error('Feedback collection error:', feedbackError);
      }
    }

    return {
      sessionId: checkpoint.sessionId,
      config: sessionConfig,
      conversationHistory,
      outcome,
      finalTurn:
        conversationHistory[conversationHistory.length - 1]?.turn ||
        checkpoint.turn,
      duration,
      detectedPulses,
      privateMoments: privateMomentTracker.getAll(),
      tangents: tangentAnalysis.moments,
      tangentAnalysis,
      costBreakdown: costTracker.getBreakdown(),
      playerFeedback,
    };
  } catch (error) {
    console.error('Session replay error:', error);
    return {
      sessionId: checkpoint.sessionId,
      config: checkpoint.sessionConfig,
      conversationHistory: checkpoint.conversationHistory,
      outcome: 'failed',
      finalTurn: checkpoint.turn,
      duration: Date.now() - startTime,
      detectedPulses: checkpoint.detectedPulses,
      privateMoments: checkpoint.privateMoments,
      tangents: checkpoint.detectedTangents,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run a complete session
 */
export async function runSession(
  config: SessionRunnerConfig,
): Promise<SessionResult> {
  const startTime = Date.now();

  try {
    // 1. Generate group composition
    const archetypeIds = generateGroupComposition(config.groupSize);

    const playerAgents = await createPlayerAgents(
      archetypeIds,
      config.story,
      config.language,
    );

    // 2. Select random spokesperson
    const spokesperson =
      playerAgents[Math.floor(Math.random() * playerAgents.length)] ||
      playerAgents[0];
    if (!spokesperson) {
      throw new Error('No players generated');
    }

    // 3. Create session config
    const sessionConfig = createSessionConfig(
      config,
      playerAgents,
      spokesperson,
    );
    const sessionId = sessionConfig.sessionId;

    console.log(`\n🎬 ${sessionId}`);
    console.log(`📖 ${config.story.storyTitle} | 🤖 ${config.narratorModel}`);
    console.log(
      `👥 ${playerAgents.map((a) => `${a.name} (${a.archetype})`).join(', ')}`,
    );
    console.log(`🎙️  Spokesperson: ${spokesperson.name}\n`);

    // 4. Initialize cost tracker
    const costTracker = new CostTracker(
      NARRATOR_MODEL_MAP[config.narratorModel] || '',
      playerAgents.map((a) => a.modelId),
    );

    // 5. Initialize conversation history (empty - narrator starts fresh)
    const conversationHistory: Message[] = [];

    // 6. Initialize tracking
    const privateMomentTracker = new PrivateMomentTracker();
    const tangentTracker = new TangentTracker();
    const detectedPulses: number[] = [];
    let outcome: SessionOutcome = 'timeout';

    // 7. Main session loop
    for (let turn = 1; turn <= sessionConfig.maxTurns; turn++) {
      console.log(`\n--- Turn ${turn} ---`);

      try {
        // Generate narrator output
        const { text: narratorOutput, usage: narratorUsage } =
          await generateNarratorResponse(
            conversationHistory,
            sessionConfig.narratorConfig,
            playerAgents.map((a) => a.name),
          );

        costTracker.recordNarratorUsage(narratorUsage);

        // Narrator output already streamed above

        // Classify output
        const { classifyOutput } = await import('./classifier');
        const classification = await classifyOutput(narratorOutput, {
          previousPulseCount: detectedPulses.length,
          playerNames: playerAgents.map((a) => a.name),
        });

        if (classification.usage) {
          costTracker.recordClassificationUsage(classification.usage);
        }

        console.log(`🏷️  Classified as: ${classification.type}`);

        if (classification.type === 'pulse') {
          detectedPulses.push(turn);
          console.log(`💓 Pulse ${detectedPulses.length}/~20`);
        }

        // Track tangent if detected
        if (classification.type === 'tangent-response') {
          console.log(`🌀 Tangent detected`);
        }

        // Add narrator message
        conversationHistory.push({
          role: 'narrator',
          content: narratorOutput,
          turn,
          timestamp: Date.now(),
          classification: classification.type,
        });

        // Check for private moment payoffs
        const payoffs = await privateMomentTracker.checkPayoff(
          turn,
          narratorOutput,
        );
        if (payoffs.length > 0) {
          console.log(
            `💎 Payoffs detected: ${payoffs.map((p) => p.target).join(', ')}`,
          );
        }

        // Check for requires-discussion first (major group decisions)
        if (classification.type === 'requires-discussion') {
          console.log(`🗣️  Discussion required`);

          const discussionResult = await runDiscussion(
            narratorOutput,
            playerAgents,
            spokesperson,
            costTracker,
          );

          // Add spokesperson synthesis to history
          conversationHistory.push({
            role: 'spokesperson',
            player: spokesperson.name,
            content: discussionResult.spokespersonMessage,
            turn,
            timestamp: Date.now(),
          });

          // Check for directed questions (public but targeted)
        } else if (
          classification.type === 'directed-questions' &&
          classification.targetPlayers?.length
        ) {
          console.log(
            `🎯 Directed questions for: ${classification.targetPlayers.join(', ')}`,
          );

          // Collect responses from ONLY targeted players, sequentially
          for (const targetName of classification.targetPlayers) {
            const agent = playerAgents.find(
              (a) => a.name.toLowerCase() === targetName.toLowerCase(),
            );
            if (agent) {
              const { text: response, usage: playerUsage } =
                await generateDirectedResponse(
                  agent,
                  narratorOutput,
                  conversationHistory,
                );

              costTracker.recordPlayerUsage(playerUsage);

              conversationHistory.push({
                role: 'player',
                player: agent.name,
                content: response,
                turn,
                timestamp: Date.now(),
              });
            }
          }
          // NO spokesperson synthesis - responses are individual
        } else {
          // Check for private moment
          const { routePrivateMoment } = await import('./private');
          const privateRouting = routePrivateMoment(
            narratorOutput,
            playerAgents,
          );

          if (privateRouting.isPrivate && privateRouting.targetAgent) {
            // Private moment
            console.log(
              `🔒 Private moment for ${privateRouting.targetAgent.name}`,
            );

            const { text: response, usage: playerUsage } =
              await generatePlayerResponse(
                privateRouting.targetAgent,
                narratorOutput,
                conversationHistory,
              );

            costTracker.recordPlayerUsage(playerUsage);

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
            // Group interaction - sequential to avoid garbled streaming output
            const playerResponses: Array<{
              agent: PlayerAgent;
              response: string;
            }> = [];

            for (const agent of playerAgents) {
              const result = await generatePlayerResponse(
                agent,
                narratorOutput,
                conversationHistory,
              );
              costTracker.recordPlayerUsage(result.usage);
              playerResponses.push({ agent, response: result.text });
            }

            // Spokesperson synthesis
            const { text: synthesis, usage: spokespersonUsage } =
              await generateSpokespersonSynthesis(
                spokesperson,
                playerResponses,
                narratorOutput,
              );

            costTracker.recordPlayerUsage(spokespersonUsage);

            // Spokesperson synthesis already streamed above

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

            // Record tangent tracking with player responses
            tangentTracker.recordTangent(
              turn,
              playerResponses.map((r) => r.response),
              narratorOutput,
              classification,
            );
          }
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
          tangentTracker.getAnalysis().moments,
          privateMomentTracker.getAll(),
        );

        await saveCheckpoint(checkpoint);

        // Check if session should end
        const endCheck = shouldEndSession(
          classification.type,
          turn,
          sessionConfig.maxTurns,
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

    // Finalize tangent tracking
    tangentTracker.finalize();
    const tangentAnalysis = tangentTracker.getAnalysis();

    // Collect player feedback if story completed successfully
    let playerFeedback: SessionFeedback | undefined;
    if (outcome === 'completed') {
      try {
        const feedbackList = await collectPlayerFeedback(
          playerAgents,
          conversationHistory,
          costTracker,
        );
        playerFeedback = synthesizeFeedback(sessionId, feedbackList);
      } catch (feedbackError) {
        console.error('Feedback collection error:', feedbackError);
      }
    }

    return {
      sessionId,
      config: sessionConfig,
      conversationHistory,
      outcome,
      finalTurn: conversationHistory[conversationHistory.length - 1]?.turn || 0,
      duration,
      detectedPulses,
      privateMoments: privateMomentTracker.getAll(),
      tangents: tangentAnalysis.moments,
      tangentAnalysis,
      costBreakdown: costTracker.getBreakdown(),
      playerFeedback,
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
