/**
 * Session Runner
 *
 * Main orchestration loop. Generates random group, runs character creation,
 * executes main loop until story ends or max turns reached.
 */

import { nanoid } from 'nanoid';
import {
  streamText,
  wrapLanguageModel,
  extractReasoningMiddleware,
  gateway,
  type LanguageModelUsage,
  type UserModelMessage,
  type AssistantModelMessage,
} from 'ai';
import type { ArchetypeId } from '../archetypes/types';
import { ARCHETYPES } from '../archetypes/definitions';
import { getNextFallbackModel } from '../archetypes/types';
import type { PlayerAgent, StoryContext, GeneratedGroup } from '../agents/player';
import { createPlayerAgents } from '../agents/player';
import type { NarratorConfig } from '../agents/narrator';
import { NARRATOR_MODEL_MAP, THINK_TAG_MODELS } from '../agents/narrator';
import type { Message } from './turn';
import type { SessionConfig, Checkpoint } from '../checkpoint/schema';
import { createCheckpoint } from '../checkpoint/schema';
import { saveCheckpoint } from '../checkpoint/save';
import { PrivateMomentTracker, type PrivateMoment } from './private';
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
import {
  type GameState,
  createInitialState,
  formatStateForInjection,
  updateGameState,
  tryExtractCharacters,
} from './state';
import {
  isGarbageOutput,
  describeGarbageReason,
} from '@/lib/narrator/validation';

export type SessionOutcome = 'completed' | 'timeout' | 'failed';

export interface SessionResult {
  sessionId: string;
  config: SessionConfig;
  conversationHistory: Message[];
  outcome: SessionOutcome;
  finalTurn: number;
  duration: number;
  detectedPulses: number[];
  privateMoments: PrivateMoment[];
  tangents: TangentMoment[];
  tangentAnalysis?: TangentAnalysis;
  costBreakdown?: CostBreakdown;
  playerFeedback?: SessionFeedback;
  gameState?: GameState;
  error?: string;
}

export interface SessionRunnerConfig {
  story: StoryContext;
  systemPrompt: string;
  storyGuide: string;
  narratorModel: NarratorConfig['model'];
  groupSize?: number; // If not specified, random 2-5
  archetypes?: ArchetypeId[]; // Specific archetypes to use (overrides groupSize)
  preGeneratedGroup?: GeneratedGroup; // Pre-generated group for comparison tests
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
  language?: string; // Output language (english, spanish, etc.)
  promptStyle?: string; // Prompt variant (mechanical, philosophical, minimal)
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
    promptStyle: config.promptStyle,
  };
}

/**
 * Initialize narrator with system prompt
 *
 * Note: Story guide is already injected into the system prompt by the loader.
 * We pass systemPrompt through unchanged - test exactly what ships.
 */
function buildNarratorSystemPrompt(
  systemPrompt: string,
): string {
  return systemPrompt;
}

/**
 * Generate narrator response
 */
async function generateNarratorResponse(
  conversationHistory: Message[],
  narratorConfig: NarratorConfig,
  gameState: GameState | null,
): Promise<{ text: string; reasoning?: string; usage: LanguageModelUsage }> {
  const modelId = NARRATOR_MODEL_MAP[narratorConfig.model];

  if (!modelId) {
    throw new Error(`Unknown narrator model: ${narratorConfig.model}`);
  }

  const systemPrompt = buildNarratorSystemPrompt(
    narratorConfig.systemPrompt,
  );

  // Narrator only sees its own outputs and spokesperson syntheses
  // Player discussions are private - narrator only hears what spokesperson relays
  // Exclude turn 0 (pre-game chat - that's players talking before game starts)
  const narratorHistory = conversationHistory.filter(
    (m) => (m.role === 'narrator' || m.role === 'spokesperson') && m.turn > 0,
  );

  const messages: Array<UserModelMessage | AssistantModelMessage> =
    narratorHistory.map((m) => ({
      role: (m.role === 'narrator' ? 'assistant' : 'user') as 'user' | 'assistant',
      content:
        m.role === 'spokesperson'
          ? `Players: ${m.content}`
          : m.content,
    }));

  // Inject game state into system prompt
  const stateInjection = gameState ? formatStateForInjection(gameState) : '';
  const fullSystemPrompt = stateInjection
    ? `${systemPrompt}\n\n${stateInjection}`
    : systemPrompt;

  // Wrap with reasoning middleware for models that use <think> tags
  const needsThinkMiddleware = THINK_TAG_MODELS.includes(narratorConfig.model);
  const model = needsThinkMiddleware
    ? wrapLanguageModel({
        model: gateway(modelId),
        middleware: extractReasoningMiddleware({ tagName: 'think' }),
      })
    : gateway(modelId);

  const maxRetries = 3;
  let lastError: Error | null = null;

  // For first turn (no messages), use a minimal user prompt to trigger narrator
  // In production, user sends first message. Here we simulate that minimally.
  const isFirstTurn = messages.length === 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = streamText({
        model,
        system: fullSystemPrompt,
        // First turn: simulate user saying hi; subsequent turns: conversation history
        ...(isFirstTurn
          ? { prompt: 'Hi' }
          : { messages }),
        temperature: narratorConfig.temperature,
        // Enable reasoning for deepseek models
        ...(needsThinkMiddleware && {
          providerOptions: {
            deepseek: {
              reasoning: { enabled: true },
            },
          },
        }),
      });

      // Stream output to console
      let fullText = '';
      let reasoning = '';
      const retryNote = attempt > 1 ? ` [retry ${attempt}]` : '';
      let hasStartedReasoning = false;
      let hasStartedText = false;

      for await (const part of result.fullStream) {
        if (part.type === 'reasoning-delta') {
          if (!hasStartedReasoning) {
            process.stdout.write(`\n🧠 Narrator thinking${retryNote}:\n\x1b[2m`);
            hasStartedReasoning = true;
          }
          process.stdout.write(part.text);
          reasoning += part.text;
        } else if (part.type === 'text-delta') {
          if (!hasStartedText) {
            if (hasStartedReasoning) process.stdout.write('\x1b[0m\n');
            process.stdout.write(`\n📖 Narrator${retryNote}: `);
            hasStartedText = true;
          }
          process.stdout.write(part.text);
          fullText += part.text;
        }
      }
      process.stdout.write('\n');

      // Check for garbage output
      if (isGarbageOutput(fullText)) {
        const reason = describeGarbageReason(fullText);
        console.warn(`\n⚠️  Garbage output detected (${reason}), retrying (${attempt}/${maxRetries})...`);
        continue;
      }

      const usage = await result.usage;
      return { text: fullText, reasoning: reasoning || undefined, usage };
    } catch (error) {
      console.error(`Narrator generation error (attempt ${attempt}):`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('Narrator generation failed after retries');
}

/**
 * Generate player response
 */
async function generatePlayerResponse(
  agent: PlayerAgent,
  narratorOutput: string,
  conversationHistory: Message[],
): Promise<{ text: string; usage: LanguageModelUsage }> {
  const recentHistory = conversationHistory.slice(-10); // Last 10 messages for context

  const messages: Array<UserModelMessage | AssistantModelMessage> = [
    ...recentHistory.map((m) => ({
      role: (m.role === 'narrator' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'assistant' as const, content: narratorOutput },
    {
      role: 'user' as const,
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
        model: currentModelId,
        system: agent.systemPrompt,
        messages,
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
  const recentHistory = conversationHistory.slice(-10);

  const messages: Array<UserModelMessage | AssistantModelMessage> = [
    ...recentHistory.map((m) => ({
      role: (m.role === 'narrator' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'assistant' as const, content: narratorOutput },
    {
      role: 'user' as const,
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
        model: currentModelId,
        system: agent.systemPrompt,
        messages,
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
  const responsesText = playerResponses
    .map((r) => `${r.agent.name}: "${r.response}"`)
    .join('\n');

  const synthesisPrompt = `The group just heard from the narrator:
"${narratorOutput}"

Individual player responses:
${responsesText}

As ${spokesperson.name}, synthesize these responses into a single coherent message to relay back to the narrator. Keep it concise and preserve important details.`;

  const messages: Array<UserModelMessage> = [
    { role: 'user' as const, content: synthesisPrompt },
  ];

  // Track tried models for fallback
  const triedModels: string[] = [];
  let currentModelId = spokesperson.modelId;

  while (true) {
    triedModels.push(currentModelId);

    try {
      const result = streamText({
        model: currentModelId,
        system: spokesperson.systemPrompt,
        messages,
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
 * Run pre-game discussion
 *
 * Players chat as themselves BEFORE the narrator starts.
 * Primes them with player-voice memories.
 */
async function runPreGameDiscussion(
  playerAgents: PlayerAgent[],
  spokesperson: PlayerAgent,
  storyTitle: string,
  costTracker: CostTracker,
): Promise<Message[]> {
  console.log('\n--- Pre-Game Discussion ---\n');

  const preGamePrompt = `You're about to play "${storyTitle}" with your friends. Chat for a moment before starting.`;

  const result = await runDiscussion(
    preGamePrompt,
    playerAgents,
    spokesperson,
    costTracker,
    { skipSynthesis: true },
  );

  // Convert discussion messages to conversation history format
  const messages: Message[] = result.messages.map(({ agent, message }) => ({
    role: agent.name === spokesperson.name ? 'spokesperson' : 'player',
    player: agent.name,
    content: message,
    turn: 0,
    timestamp: Date.now(),
  }));

  console.log('');
  return messages;
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

    // Initialize game state - try to reconstruct from checkpoint history
    let gameState: GameState = createInitialState();
    // TODO: Could reconstruct state from checkpoint history if needed

    // Continue from next turn
    const startTurn = checkpoint.turn + 1;

    // Main session loop (same as runSession)
    for (let turn = startTurn; turn <= sessionConfig.maxTurns; turn++) {
      console.log(`\n--- Turn ${turn} ---`);

      try {
        // Generate narrator output (inject game state for character consistency)
        const { text: narratorOutput, reasoning: narratorReasoning, usage: narratorUsage } =
          await generateNarratorResponse(
            conversationHistory,
            sessionConfig.narratorConfig,
            gameState,
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

        // Log classification (multi-label)
        const pulseTag = classification.isPulse ? ' [PULSE]' : '';
        const endTag = classification.isEnding ? ' [END]' : '';
        console.log(`🏷️  ${classification.responseType}${pulseTag}${endTag}`);

        // Track pulse separately from response type
        if (classification.isPulse) {
          detectedPulses.push(turn);
          console.log(`💓 Pulse ${detectedPulses.length}/~20`);
        }

        // Add narrator message
        conversationHistory.push({
          role: 'narrator',
          content: narratorOutput,
          turn,
          timestamp: Date.now(),
          classification: classification.type, // Legacy field for reports
          reasoning: narratorReasoning,
        });

        // Update game state based on narrator response (location, items, NPCs)
        if (gameState.characters.length > 0) {
          gameState = await updateGameState(gameState, narratorOutput);
        }

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

        // Route based on responseType (not mutually exclusive with isPulse)
        switch (classification.responseType) {
          case 'discussion': {
            const discussionResult = await runDiscussion(
              narratorOutput,
              playerAgents,
              spokesperson,
              costTracker,
              { history: conversationHistory },
            );

            // Add spokesperson synthesis to history
            conversationHistory.push({
              role: 'spokesperson',
              player: spokesperson.name,
              content: discussionResult.spokespersonMessage,
              turn,
              timestamp: Date.now(),
            });

            break;
          }

          case 'directed': {
            const targets = classification.targetPlayers || [];
            console.log(`🎯 Directed questions for: ${targets.join(', ')}`);

            // Collect responses from ONLY targeted players, sequentially
            for (const targetName of targets) {
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
            break;
          }

          case 'private': {
            // Use classifier's target or fall back to pattern detection
            let targetAgent: PlayerAgent | undefined;

            if (classification.targetPlayers?.[0]) {
              targetAgent = playerAgents.find(
                (a) => a.name.toLowerCase() === classification.targetPlayers?.[0].toLowerCase(),
              );
            }

            if (!targetAgent) {
              // Fall back to pattern-based detection
              const { routePrivateMoment } = await import('./private');
              const privateRouting = routePrivateMoment(narratorOutput, playerAgents);
              targetAgent = privateRouting.targetAgent;
            }

            if (targetAgent) {
              console.log(`🔒 Private moment for ${targetAgent.name}`);

              const { text: response, usage: playerUsage } =
                await generatePlayerResponse(
                  targetAgent,
                  narratorOutput,
                  conversationHistory,
                );

              costTracker.recordPlayerUsage(playerUsage);

              conversationHistory.push({
                role: 'player',
                player: targetAgent.name,
                content: response,
                turn,
                timestamp: Date.now(),
              });

              privateMomentTracker.add({
                turn,
                target: targetAgent.name,
                content: narratorOutput,
                response,
              });
            }
            break;
          }

          case 'none': {
            // No response needed (ending, pure narration)
            console.log(`📖 No response needed`);
            break;
          }

          case 'group':
          default: {
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
            break;
          }
        }

        // Extract character mappings until fulfilled
        if (gameState.characters.length === 0) {
          gameState = await tryExtractCharacters(
            gameState,
            conversationHistory,
            turn,
            playerAgents,
            spokesperson,
          );
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

        // Check if session should end (use isEnding flag)
        const shouldEnd = classification.isEnding || turn >= sessionConfig.maxTurns;

        if (shouldEnd) {
          outcome = classification.isEnding ? 'completed' : 'timeout';
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
      gameState,
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
  let sessionConfig: SessionConfig | undefined;
  let sessionId = 'error';

  try {
    // 1. Generate group composition (use provided archetypes or random)
    const archetypeIds = config.archetypes || generateGroupComposition(config.groupSize);

    const playerAgents = await createPlayerAgents(
      archetypeIds,
      config.story,
      config.language,
      config.preGeneratedGroup,
    );

    // 2. Select random spokesperson
    const spokesperson =
      playerAgents[Math.floor(Math.random() * playerAgents.length)] ||
      playerAgents[0];
    if (!spokesperson) {
      throw new Error('No players generated');
    }

    // 3. Create session config
    sessionConfig = createSessionConfig(
      config,
      playerAgents,
      spokesperson,
    );
    sessionId = sessionConfig.sessionId;

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
    let gameState: GameState = createInitialState();

    // 7. Pre-game discussion (players chat as themselves before story starts)
    const preGameMessages = await runPreGameDiscussion(
      playerAgents,
      spokesperson,
      config.story.storyTitle,
      costTracker,
    );
    conversationHistory.push(...preGameMessages);

    // 8. Main session loop
    for (let turn = 1; turn <= sessionConfig.maxTurns; turn++) {
      console.log(`\n--- Turn ${turn} ---`);

      try {
        // Generate narrator output (inject game state for character consistency)
        const { text: narratorOutput, reasoning: narratorReasoning, usage: narratorUsage } =
          await generateNarratorResponse(
            conversationHistory,
            sessionConfig.narratorConfig,
            gameState,
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

        // Log classification (multi-label)
        const pulseTag = classification.isPulse ? ' [PULSE]' : '';
        const endTag = classification.isEnding ? ' [END]' : '';
        console.log(`🏷️  ${classification.responseType}${pulseTag}${endTag}`);

        // Track pulse separately from response type
        if (classification.isPulse) {
          detectedPulses.push(turn);
          console.log(`💓 Pulse ${detectedPulses.length}/~20`);
        }

        // Add narrator message
        conversationHistory.push({
          role: 'narrator',
          content: narratorOutput,
          turn,
          timestamp: Date.now(),
          classification: classification.type, // Legacy field for reports
          reasoning: narratorReasoning,
        });

        // Update game state based on narrator response (location, items, NPCs)
        if (gameState.characters.length > 0) {
          gameState = await updateGameState(gameState, narratorOutput);
        }

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

        // Route based on responseType (not mutually exclusive with isPulse)
        switch (classification.responseType) {
          case 'discussion': {
            const discussionResult = await runDiscussion(
              narratorOutput,
              playerAgents,
              spokesperson,
              costTracker,
              { history: conversationHistory },
            );

            // Add spokesperson synthesis to history
            conversationHistory.push({
              role: 'spokesperson',
              player: spokesperson.name,
              content: discussionResult.spokespersonMessage,
              turn,
              timestamp: Date.now(),
            });

            break;
          }

          case 'directed': {
            const targets = classification.targetPlayers || [];
            console.log(`🎯 Directed questions for: ${targets.join(', ')}`);

            // Collect responses from ONLY targeted players, sequentially
            for (const targetName of targets) {
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
            break;
          }

          case 'private': {
            // Use classifier's target or fall back to pattern detection
            let targetAgent: PlayerAgent | undefined;

            if (classification.targetPlayers?.[0]) {
              targetAgent = playerAgents.find(
                (a) => a.name.toLowerCase() === classification.targetPlayers?.[0].toLowerCase(),
              );
            }

            if (!targetAgent) {
              // Fall back to pattern-based detection
              const { routePrivateMoment } = await import('./private');
              const privateRouting = routePrivateMoment(narratorOutput, playerAgents);
              targetAgent = privateRouting.targetAgent;
            }

            if (targetAgent) {
              console.log(`🔒 Private moment for ${targetAgent.name}`);

              const { text: response, usage: playerUsage } =
                await generatePlayerResponse(
                  targetAgent,
                  narratorOutput,
                  conversationHistory,
                );

              costTracker.recordPlayerUsage(playerUsage);

              conversationHistory.push({
                role: 'player',
                player: targetAgent.name,
                content: response,
                turn,
                timestamp: Date.now(),
              });

              privateMomentTracker.add({
                turn,
                target: targetAgent.name,
                content: narratorOutput,
                response,
              });
            }
            break;
          }

          case 'none': {
            // No response needed (ending, pure narration)
            console.log(`📖 No response needed`);
            break;
          }

          case 'group':
          default: {
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
            break;
          }
        }

        // Extract character mappings until fulfilled
        if (gameState.characters.length === 0) {
          gameState = await tryExtractCharacters(
            gameState,
            conversationHistory,
            turn,
            playerAgents,
            spokesperson,
          );
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

        // Check if session should end (use isEnding flag)
        const shouldEnd = classification.isEnding || turn >= sessionConfig.maxTurns;

        if (shouldEnd) {
          outcome = classification.isEnding ? 'completed' : 'timeout';
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
      gameState,
    };
  } catch (error) {
    console.error('Session error:', error);

    // Create minimal error config if session crashed before config was created
    const errorConfig = sessionConfig ?? ({
      sessionId,
      story: config.story,
      systemPrompt: '',
      storyGuide: '',
      narratorConfig: {
        model: config.narratorModel,
        systemPrompt: '',
        storyGuide: '',
        temperature: 0.7,
      },
      group: {
        players: [],
        spokesperson: null as unknown as PlayerAgent,
        size: config.groupSize ?? 1,
      },
      maxTurns: config.maxTurns || 100,
      createdAt: startTime,
    } as SessionConfig);

    return {
      sessionId,
      config: errorConfig,
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
