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
import { sleep, getFallbackDelay, withModelFallback } from '../utils/retry';
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
import { runDiscussion, type DiscussionProgressCallback } from './discussion';
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
} from '@pulse/core/narrator/validation';

/**
 * Extract usage from streamText result - handles AI Gateway response body format
 */
async function extractUsage(
  result: Awaited<ReturnType<typeof streamText>>,
): Promise<LanguageModelUsage> {
  const sdkUsage = await result.usage;
  const response = await result.response;

  // AI Gateway puts detailed usage in response.body.usage (not exposed in SDK types)
  const bodyUsage = (response as unknown as { body?: { usage?: LanguageModelUsage } })?.body?.usage;

  // Prefer body usage (has actual tokens), fall back to SDK usage
  if (bodyUsage?.inputTokens) {
    const outputTokens = bodyUsage.outputTokens ?? 0;
    return {
      inputTokens: bodyUsage.inputTokens,
      outputTokens,
      totalTokens: bodyUsage.totalTokens ?? (bodyUsage.inputTokens + outputTokens),
      inputTokenDetails: bodyUsage.inputTokenDetails ?? {},
      outputTokenDetails: bodyUsage.outputTokenDetails ?? {},
    };
  }

  return sdkUsage;
}

export type SessionOutcome = 'completed' | 'timeout' | 'failed';

export interface SessionResult {
  sessionId: string;
  config: SessionConfig;
  conversationHistory: Message[];
  outcome: SessionOutcome;
  finalTurn: number;
  duration: number;
  privateMoments: PrivateMoment[];
  tangents: TangentMoment[];
  tangentAnalysis?: TangentAnalysis;
  costBreakdown?: CostBreakdown;
  playerFeedback?: SessionFeedback;
  gameState?: GameState;
  error?: string;
}

/** Progress event types for external consumers (e.g., TUI) */
export type SessionProgressEvent =
  | { type: 'generating-group' }
  | { type: 'group-ready'; players: Array<{ name: string; archetype: string }>; spokesperson: string }
  | { type: 'pre-game' }
  | { type: 'pre-game-message'; player: string; content: string }
  | { type: 'turn-start'; turn: number; maxTurns: number }
  | { type: 'narrator-turn'; turn: number; content: string }
  | { type: 'player-turn'; turn: number; player: string; content: string }
  | { type: 'spokesperson-turn'; turn: number; player: string; content: string }
  | { type: 'completed'; turn: number }
  | { type: 'failed'; error: string };

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
  /** Optional callback for progress events (for TUI integration) */
  onProgress?: (event: SessionProgressEvent) => void;
}

// ============================================================================
// Turn Execution Context - Shared state for turn execution
// ============================================================================

interface TurnExecutionContext {
  sessionId: string;
  sessionConfig: SessionConfig;
  playerAgents: PlayerAgent[];
  spokesperson: PlayerAgent;
  conversationHistory: Message[];
  gameState: GameState;
  costTracker: CostTracker;
  privateMomentTracker: PrivateMomentTracker;
  tangentTracker: TangentTracker;
  onProgress?: (event: SessionProgressEvent) => void;
  /** For checkpoint saving - optional parent checkpoint info */
  checkpointMetadata?: {
    parentCheckpoint?: string;
    branchReason?: string;
  };
}

interface TurnResult {
  shouldEnd: boolean;
  outcome?: SessionOutcome;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

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
 */
function buildNarratorSystemPrompt(systemPrompt: string): string {
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

  const systemPrompt = buildNarratorSystemPrompt(narratorConfig.systemPrompt);

  // Narrator only sees its own outputs and spokesperson syntheses
  // Player discussions are private - narrator only hears what spokesperson relays
  // Exclude turn 0 (pre-game chat - that's players talking before game starts)
  const narratorHistory = conversationHistory.filter(
    (m) => (m.role === 'narrator' || m.role === 'spokesperson') && m.turn > 0,
  );

  // Build messages with proper user/assistant alternation
  // Some response types (private, directed, none) don't add spokesperson messages,
  // which can cause consecutive narrator (assistant) messages - invalid for most APIs
  const messages: Array<UserModelMessage | AssistantModelMessage> = [];
  let lastRole: 'user' | 'assistant' | null = null;

  for (const m of narratorHistory) {
    const newRole = m.role === 'narrator' ? 'assistant' : 'user';
    const content = m.role === 'spokesperson' ? `Players: ${m.content}` : m.content;

    // If we'd create consecutive assistant messages, inject a placeholder user message
    if (newRole === 'assistant' && lastRole === 'assistant') {
      messages.push({
        role: 'user',
        content: '[The players acknowledge and wait for the narrator to continue.]',
      });
    }

    messages.push({ role: newRole, content });
    lastRole = newRole;
  }

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
  const isFirstTurn = messages.length === 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Add delay before retry (not on first attempt)
    if (attempt > 1) {
      const delay = getFallbackDelay(attempt - 2); // attempt 2 → delay 0, attempt 3 → delay 1
      console.log(`   ↻ Retrying narrator in ${(delay / 1000).toFixed(1)}s...`);
      await sleep(delay);
    }

    try {
      const result = streamText({
        model,
        system: fullSystemPrompt,
        ...(isFirstTurn ? { prompt: 'Hi' } : { messages }),
        temperature: narratorConfig.temperature,
        ...(needsThinkMiddleware && {
          providerOptions: {
            deepseek: { reasoning: { enabled: true } },
          },
        }),
      });

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

      if (isGarbageOutput(fullText)) {
        const reason = describeGarbageReason(fullText);
        console.warn(`\n⚠️  Garbage output detected (${reason}), retrying (${attempt}/${maxRetries})...`);
        continue;
      }

      // Extract usage from AI Gateway response
      const usage = await extractUsage(result);

      return { text: fullText, reasoning: reasoning || undefined, usage };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = lastError.message.slice(0, 80);
      console.error(`   ⚠ Narrator error (attempt ${attempt}/${maxRetries}): ${errorMsg}`);
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
  const recentHistory = conversationHistory.slice(-10);

  // Build messages with proper alternation
  const messages: Array<UserModelMessage | AssistantModelMessage> = [];
  let lastRole: 'user' | 'assistant' | null = null;

  for (const m of recentHistory) {
    const newRole = m.role === 'narrator' ? 'assistant' : 'user';

    // Skip consecutive same-role messages (shouldn't happen often but be safe)
    if (newRole === lastRole && newRole === 'assistant') {
      // Inject placeholder to maintain alternation
      messages.push({
        role: 'user',
        content: '[Players acknowledge.]',
      });
    }

    messages.push({ role: newRole, content: m.content });
    lastRole = newRole;
  }

  // Only add narratorOutput if it's not already the last message
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'assistant' || lastMessage.content !== narratorOutput) {
    // Need to ensure we don't create consecutive assistants
    if (lastMessage?.role === 'assistant') {
      messages.push({ role: 'user', content: '[Players listen.]' });
    }
    messages.push({ role: 'assistant', content: narratorOutput });
  }

  // Add the prompt for the player
  messages.push({
    role: 'user',
    content: `${agent.name}, what is your reaction to this? Respond in character.`,
  });

  const { result, modelUsed } = await withModelFallback(
    agent.modelId,
    async (modelId) => {
      const result = streamText({
        model: modelId,
        system: agent.systemPrompt,
        messages,
        temperature: 0.8,
      });

      const modelNote = modelId !== agent.modelId ? ` [${modelId}]` : '';
      let fullText = '';
      process.stdout.write(`\n👤 ${agent.name}${modelNote}: `);
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullText += chunk;
      }
      process.stdout.write('\n');

      const usage = await extractUsage(result);
      return { text: fullText, usage };
    },
    {
      getNextModel: getNextFallbackModel,
      label: agent.name,
    },
  );

  return result;
}

/**
 * Generate directed response for player-specific questions
 */
async function generateDirectedResponse(
  agent: PlayerAgent,
  narratorOutput: string,
  conversationHistory: Message[],
): Promise<{ text: string; usage: LanguageModelUsage }> {
  const recentHistory = conversationHistory.slice(-10);

  // Build messages with proper alternation
  const messages: Array<UserModelMessage | AssistantModelMessage> = [];
  let lastRole: 'user' | 'assistant' | null = null;

  for (const m of recentHistory) {
    const newRole = m.role === 'narrator' ? 'assistant' : 'user';

    // Skip consecutive same-role messages (shouldn't happen often but be safe)
    if (newRole === lastRole && newRole === 'assistant') {
      messages.push({
        role: 'user',
        content: '[Players acknowledge.]',
      });
    }

    messages.push({ role: newRole, content: m.content });
    lastRole = newRole;
  }

  // Only add narratorOutput if it's not already the last message
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'assistant' || lastMessage.content !== narratorOutput) {
    if (lastMessage?.role === 'assistant') {
      messages.push({ role: 'user', content: '[Players listen.]' });
    }
    messages.push({ role: 'assistant', content: narratorOutput });
  }

  // Add the prompt for the player
  messages.push({
    role: 'user',
    content: `The narrator has asked YOU (${agent.name}) specific questions directly.

Answer ONLY the questions addressed to you. Do not answer questions meant for other players.

Respond in character as ${agent.name}.`,
  });

  const { result } = await withModelFallback(
    agent.modelId,
    async (modelId) => {
      const result = streamText({
        model: modelId,
        system: agent.systemPrompt,
        messages,
        temperature: 0.8,
      });

      const modelNote = modelId !== agent.modelId ? ` [${modelId}]` : '';
      let fullText = '';
      process.stdout.write(`\n👤 ${agent.name}${modelNote}: `);
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullText += chunk;
      }
      process.stdout.write('\n');

      const usage = await extractUsage(result);
      return { text: fullText, usage };
    },
    {
      getNextModel: getNextFallbackModel,
      label: `${agent.name} (directed)`,
    },
  );

  return result;
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

  const { result } = await withModelFallback(
    spokesperson.modelId,
    async (modelId) => {
      const result = streamText({
        model: modelId,
        system: spokesperson.systemPrompt,
        messages,
        temperature: 0.7,
      });

      const modelNote = modelId !== spokesperson.modelId ? ` [${modelId}]` : '';
      let fullText = '';
      process.stdout.write(`\n🎙️ ${spokesperson.name}${modelNote} (spokesperson): `);
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullText += chunk;
      }
      process.stdout.write('\n');

      const usage = await extractUsage(result);
      return { text: fullText, usage };
    },
    {
      getNextModel: getNextFallbackModel,
      label: `${spokesperson.name} (spokesperson)`,
    },
  );

  return result;
}

/**
 * Run pre-game discussion
 */
async function runPreGameDiscussion(
  playerAgents: PlayerAgent[],
  spokesperson: PlayerAgent,
  storyTitle: string,
  costTracker: CostTracker,
  onProgress?: DiscussionProgressCallback,
): Promise<Message[]> {
  console.log('\n--- Pre-Game Discussion ---\n');

  const preGamePrompt = `You're about to play "${storyTitle}" with your friends. Chat for a moment before starting.`;

  const result = await runDiscussion(
    preGamePrompt,
    playerAgents,
    spokesperson,
    costTracker,
    { skipSynthesis: true, onProgress },
  );

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

// ============================================================================
// Core Turn Execution - Shared between runSession and resumeSession
// ============================================================================

/**
 * Execute a single turn of the session
 */
async function executeTurn(
  ctx: TurnExecutionContext,
  turn: number,
): Promise<TurnResult> {
  const {
    sessionId,
    sessionConfig,
    playerAgents,
    spokesperson,
    conversationHistory,
    costTracker,
    privateMomentTracker,
    tangentTracker,
    onProgress,
    checkpointMetadata,
  } = ctx;

  console.log(`\n--- Turn ${turn} ---`);
  onProgress?.({ type: 'turn-start', turn, maxTurns: sessionConfig.maxTurns });

  // Generate narrator output
  const { text: narratorOutput, reasoning: narratorReasoning, usage: narratorUsage } =
    await generateNarratorResponse(
      conversationHistory,
      sessionConfig.narratorConfig,
      ctx.gameState,
    );

  costTracker.recordNarratorUsage(narratorUsage);

  // Emit progress: narrator turn complete
  onProgress?.({ type: 'narrator-turn', turn, content: narratorOutput });

  // Classify output
  const { classifyOutput } = await import('./classifier');
  const classification = await classifyOutput(narratorOutput, {
    playerNames: playerAgents.map((a) => a.name),
  });

  if (classification.usage) {
    costTracker.recordClassificationUsage(classification.usage);
  }

  // Log classification
  const endTag = classification.isEnding ? ' [END]' : '';
  console.log(`🏷️  ${classification.responseType}${endTag}`);

  // Add narrator message
  conversationHistory.push({
    role: 'narrator',
    content: narratorOutput,
    turn,
    timestamp: Date.now(),
    classification: classification.type,
    reasoning: narratorReasoning,
  });

  // Update game state
  if (ctx.gameState.characters.length > 0) {
    ctx.gameState = await updateGameState(ctx.gameState, narratorOutput);
  }

  // Check for private moment payoffs
  const payoffs = await privateMomentTracker.checkPayoff(turn, narratorOutput);
  if (payoffs.length > 0) {
    console.log(`💎 Payoffs detected: ${payoffs.map((p) => p.target).join(', ')}`);
  }

  // Route based on responseType
  switch (classification.responseType) {
    case 'discussion': {
      const discussionResult = await runDiscussion(
        narratorOutput,
        playerAgents,
        spokesperson,
        costTracker,
        {
          history: conversationHistory,
          onProgress: (event) => {
            if (event.type === 'player-message') {
              onProgress?.({ type: 'player-turn', turn, player: event.player, content: event.content });
            } else if (event.type === 'spokesperson-message') {
              onProgress?.({ type: 'spokesperson-turn', turn, player: event.player, content: event.content });
            }
          },
        },
      );

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

      for (const targetName of targets) {
        const agent = playerAgents.find(
          (a) => a.name.toLowerCase() === targetName.toLowerCase(),
        );
        if (agent) {
          const { text: response, usage: playerUsage } =
            await generateDirectedResponse(agent, narratorOutput, conversationHistory);

          costTracker.recordPlayerUsage(playerUsage);

          onProgress?.({ type: 'player-turn', turn, player: agent.name, content: response });

          conversationHistory.push({
            role: 'player',
            player: agent.name,
            content: response,
            turn,
            timestamp: Date.now(),
          });
        }
      }
      break;
    }

    case 'private': {
      let targetAgent: PlayerAgent | undefined;

      if (classification.targetPlayers?.[0]) {
        targetAgent = playerAgents.find(
          (a) => a.name.toLowerCase() === classification.targetPlayers?.[0].toLowerCase(),
        );
      }

      if (!targetAgent) {
        const { routePrivateMoment } = await import('./private');
        const privateRouting = routePrivateMoment(narratorOutput, playerAgents);
        targetAgent = privateRouting.targetAgent;
      }

      if (targetAgent) {
        console.log(`🔒 Private moment for ${targetAgent.name}`);

        const { text: response, usage: playerUsage } =
          await generatePlayerResponse(targetAgent, narratorOutput, conversationHistory);

        costTracker.recordPlayerUsage(playerUsage);

        onProgress?.({ type: 'player-turn', turn, player: targetAgent.name, content: response });

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
      console.log(`📖 No response needed`);
      break;
    }

    case 'group':
    default: {
      const playerResponses: Array<{ agent: PlayerAgent; response: string }> = [];

      for (const agent of playerAgents) {
        const result = await generatePlayerResponse(agent, narratorOutput, conversationHistory);
        costTracker.recordPlayerUsage(result.usage);
        playerResponses.push({ agent, response: result.text });

        onProgress?.({ type: 'player-turn', turn, player: agent.name, content: result.text });
      }

      const { text: synthesis, usage: spokespersonUsage } =
        await generateSpokespersonSynthesis(spokesperson, playerResponses, narratorOutput);

      costTracker.recordPlayerUsage(spokespersonUsage);

      onProgress?.({ type: 'spokesperson-turn', turn, player: spokesperson.name, content: synthesis });

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

      tangentTracker.recordTangent(
        turn,
        playerResponses.map((r) => r.response),
        narratorOutput,
        classification,
      );
      break;
    }
  }

  // Extract character mappings
  if (ctx.gameState.characters.length === 0) {
    ctx.gameState = await tryExtractCharacters(
      ctx.gameState,
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
    tangentTracker.getAnalysis().moments,
    privateMomentTracker.getAll(),
    checkpointMetadata,
  );

  await saveCheckpoint(checkpoint);

  // Check if session should end
  const shouldEnd = classification.isEnding || turn >= sessionConfig.maxTurns;

  if (shouldEnd) {
    const outcome: SessionOutcome = classification.isEnding ? 'completed' : 'timeout';
    console.log(`\n✅ Session ended: ${outcome}`);
    onProgress?.({ type: 'completed', turn });
    return { shouldEnd: true, outcome };
  }

  return { shouldEnd: false };
}

/**
 * Run the main session loop
 */
async function runSessionLoop(
  ctx: TurnExecutionContext,
  startTurn: number,
): Promise<SessionOutcome> {
  let outcome: SessionOutcome = 'timeout';

  for (let turn = startTurn; turn <= ctx.sessionConfig.maxTurns; turn++) {
    try {
      const result = await executeTurn(ctx, turn);
      if (result.shouldEnd) {
        outcome = result.outcome || 'completed';
        break;
      }
    } catch (turnError) {
      console.error(`Error in turn ${turn}:`, turnError);
      ctx.onProgress?.({
        type: 'failed',
        error: turnError instanceof Error ? turnError.message : String(turnError),
      });
      outcome = 'failed';
      break;
    }
  }

  return outcome;
}

/**
 * Finalize session and collect feedback
 */
async function finalizeSession(
  ctx: TurnExecutionContext,
  outcome: SessionOutcome,
  startTime: number,
): Promise<SessionResult> {
  const duration = Date.now() - startTime;

  ctx.tangentTracker.finalize();
  const tangentAnalysis = ctx.tangentTracker.getAnalysis();

  let playerFeedback: SessionFeedback | undefined;
  if (outcome === 'completed') {
    try {
      const feedbackList = await collectPlayerFeedback(
        ctx.playerAgents,
        ctx.conversationHistory,
        ctx.costTracker,
      );
      playerFeedback = synthesizeFeedback(ctx.sessionId, feedbackList);
    } catch (feedbackError) {
      console.error('Feedback collection error:', feedbackError);
    }
  }

  return {
    sessionId: ctx.sessionId,
    config: ctx.sessionConfig,
    conversationHistory: ctx.conversationHistory,
    outcome,
    finalTurn: ctx.conversationHistory[ctx.conversationHistory.length - 1]?.turn || 0,
    duration,
    privateMoments: ctx.privateMomentTracker.getAll(),
    tangents: tangentAnalysis.moments,
    tangentAnalysis,
    costBreakdown: ctx.costTracker.getBreakdown(),
    playerFeedback,
    gameState: ctx.gameState,
  };
}

// ============================================================================
// Public API
// ============================================================================

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
    const costTracker = new CostTracker(
      NARRATOR_MODEL_MAP[sessionConfig.narratorConfig.model] || '',
      playerAgents.map((a) => a.modelId),
    );

    const ctx: TurnExecutionContext = {
      sessionId: checkpoint.sessionId,
      sessionConfig,
      playerAgents,
      spokesperson,
      conversationHistory: [...checkpoint.conversationHistory],
      gameState: createInitialState(),
      costTracker,
      privateMomentTracker,
      tangentTracker,
      checkpointMetadata: {
        parentCheckpoint: checkpoint.metadata.parentCheckpoint,
        branchReason: checkpoint.metadata.branchReason,
      },
    };

    const startTurn = checkpoint.turn + 1;
    const outcome = await runSessionLoop(ctx, startTurn);

    return finalizeSession(ctx, outcome, startTime);
  } catch (error) {
    console.error('Session replay error:', error);
    return {
      sessionId: checkpoint.sessionId,
      config: checkpoint.sessionConfig,
      conversationHistory: checkpoint.conversationHistory,
      outcome: 'failed',
      finalTurn: checkpoint.turn,
      duration: Date.now() - startTime,
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
    // 1. Generate group composition
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
    sessionConfig = createSessionConfig(config, playerAgents, spokesperson);
    sessionId = sessionConfig.sessionId;

    // Emit progress: group generated
    config.onProgress?.({ type: 'generating-group' });
    config.onProgress?.({
      type: 'group-ready',
      players: playerAgents.map((a) => ({ name: a.name, archetype: a.archetype })),
      spokesperson: spokesperson.name,
    });

    console.log(`\n🎬 ${sessionId}`);
    console.log(`📖 ${config.story.storyTitle} | 🤖 ${config.narratorModel}`);
    console.log(`👥 ${playerAgents.map((a) => `${a.name} (${a.archetype})`).join(', ')}`);
    console.log(`🎙️  Spokesperson: ${spokesperson.name}\n`);

    // 4. Initialize trackers
    const costTracker = new CostTracker(
      NARRATOR_MODEL_MAP[config.narratorModel] || '',
      playerAgents.map((a) => a.modelId),
    );
    const privateMomentTracker = new PrivateMomentTracker();
    const tangentTracker = new TangentTracker();

    // 5. Pre-game discussion
    config.onProgress?.({ type: 'pre-game' });
    const preGameMessages = await runPreGameDiscussion(
      playerAgents,
      spokesperson,
      config.story.storyTitle,
      costTracker,
      (event) => {
        config.onProgress?.({
          type: 'pre-game-message',
          player: event.player,
          content: event.content,
        });
      },
    );

    // 6. Create execution context
    const ctx: TurnExecutionContext = {
      sessionId,
      sessionConfig,
      playerAgents,
      spokesperson,
      conversationHistory: [...preGameMessages],
      gameState: createInitialState(),
      costTracker,
      privateMomentTracker,
      tangentTracker,
      onProgress: config.onProgress,
    };

    // 7. Run session loop
    const outcome = await runSessionLoop(ctx, 1);

    return finalizeSession(ctx, outcome, startTime);
  } catch (error) {
    console.error('Session error:', error);

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
      privateMoments: [],
      tangents: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
