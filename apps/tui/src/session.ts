/**
 * TUI Session Orchestrator
 *
 * Wraps the test-harness session runner with an event-based interface
 * suitable for reactive UI updates.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';

// Find monorepo root by looking for package.json with name "the-pulse"
function findMonorepoRoot(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const pkgPath = resolve(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === 'the-pulse') {
          return dir;
        }
      } catch {}
    }
    dir = resolve(dir, '..');
  }
  return process.cwd();
}

// Load environment variables from monorepo root .env.local
const monorepoRoot = findMonorepoRoot();
const envPath = resolve(monorepoRoot, '.env.local');
config({ path: envPath });
import type { PromptStyle } from '@pulse/test-harness/prompts/loader';
import type { NarratorModel } from '@pulse/test-harness/agents/narrator';
import { getStory } from '@pulse/test-harness/stories/loader';
import { getSystemPrompt } from '@pulse/test-harness/prompts/loader';
import {
  runSession,
  generateGroupComposition,
  type SessionRunnerConfig,
  type SessionResult,
  type SessionProgressEvent,
} from '@pulse/test-harness/session/runner';
import {
  generateGroup,
  type GeneratedGroup,
  type StoryContext as GeneratorStoryContext,
} from '@pulse/test-harness/agents/character-generator';

// ============================================================================
// Event Types
// ============================================================================

export type SessionPhase =
  | 'initializing'
  | 'generating-group'
  | 'group-ready'
  | 'pre-game'
  | 'pre-game-message'
  | 'running'
  | 'narrator-turn'
  | 'player-turn'
  | 'spokesperson-turn'
  | 'completed'
  | 'failed';

export type ComparisonMode = 'prompts' | 'models';

/** Unique key for a session - either prompt style or model depending on mode */
export type SessionKey = string;

export interface SessionProgress {
  sessionId: string;
  sessionKey: SessionKey; // The prompt style OR model being tested
  phase: SessionPhase;
  turn: number;
  maxTurns: number;
  pulses: number;
  currentSpeaker?: string;
  lastMessage?: string;
  error?: string;
  /** Group info (available after group-ready phase) */
  group?: {
    players: Array<{ name: string; archetype: string }>;
    spokesperson: string;
  };
}

export interface SessionComplete {
  sessionId: string;
  sessionKey: SessionKey; // The prompt style OR model being tested
  turns: number;
  pulses: number;
  score: number;
  cost: number;
  duration: number;
}

export interface TuiSessionEvents {
  'session:progress': (data: SessionProgress) => void;
  'session:message': (data: { sessionId: string; role: string; content: string; turn: number }) => void;
  'session:complete': (data: SessionComplete) => void;
  'session:error': (data: { sessionId: string; error: string }) => void;
  'all:complete': (results: SessionComplete[]) => void;
}

// ============================================================================
// Session Config
// ============================================================================

export interface TuiSessionConfig {
  storyId: string;
  comparisonMode: ComparisonMode;
  // For prompt comparison
  model: NarratorModel;
  promptStyles: PromptStyle[];
  // For model comparison
  promptStyle: PromptStyle;
  models: NarratorModel[];
  maxTurns?: number;
  language?: string;
}

// ============================================================================
// Real Session Runner
// ============================================================================

/**
 * Run a real session using the test-harness runner
 */
async function runRealSession(
  config: TuiSessionConfig,
  sessionKey: SessionKey,
  emitter: EventEmitter,
  sharedGroup: GeneratedGroup,
): Promise<SessionComplete> {
  const startTime = Date.now();
  const maxTurns = config.maxTurns || 20;

  // Determine model and prompt based on comparison mode
  const narratorModel = config.comparisonMode === 'models'
    ? (sessionKey as NarratorModel)
    : config.model;
  const promptStyle = config.comparisonMode === 'prompts'
    ? (sessionKey as PromptStyle)
    : config.promptStyle;

  // Get story
  const story = getStory(config.storyId);
  if (!story) {
    throw new Error(`Story not found: ${config.storyId}`);
  }

  // Get system prompt
  const systemPrompt = getSystemPrompt(story.storyGuide, config.language, promptStyle);

  // Track progress
  let currentTurn = 0;
  let pulseCount = 0;
  const sessionId = `${sessionKey}-${Date.now()}`;

  // Track group info
  let groupInfo: { players: Array<{ name: string; archetype: string }>; spokesperson: string } | undefined;

  // Create progress handler
  const onProgress = (event: SessionProgressEvent) => {
    switch (event.type) {
      case 'generating-group':
        emitter.emit('session:progress', {
          sessionId,
          sessionKey,
          phase: 'generating-group',
          turn: 0,
          maxTurns,
          pulses: 0,
        } satisfies SessionProgress);
        break;

      case 'group-ready': {
        groupInfo = { players: event.players, spokesperson: event.spokesperson };
        emitter.emit('session:progress', {
          sessionId,
          sessionKey,
          phase: 'group-ready',
          turn: 0,
          maxTurns,
          pulses: 0,
          group: groupInfo,
        } satisfies SessionProgress);
        // Log group creation as a message
        const playerList = event.players.map(p => `${p.name} (${p.archetype})`).join(', ');
        emitter.emit('session:message', {
          sessionId: sessionKey, // Use sessionKey for consistent lookup
          role: 'system',
          content: `=== GROUP CREATED ===\nPlayers: ${playerList}\nSpokesperson: ${event.spokesperson}`,
          turn: 0,
        });
        break;
      }

      case 'pre-game':
        emitter.emit('session:progress', {
          sessionId,
          sessionKey,
          phase: 'pre-game',
          turn: 0,
          maxTurns,
          pulses: pulseCount,
          group: groupInfo,
        } satisfies SessionProgress);
        break;

      case 'pre-game-message':
        emitter.emit('session:progress', {
          sessionId,
          sessionKey,
          phase: 'pre-game-message',
          turn: 0,
          maxTurns,
          pulses: pulseCount,
          currentSpeaker: event.player,
          lastMessage: event.content,
          group: groupInfo,
        } satisfies SessionProgress);
        // Also emit as a message for the log
        emitter.emit('session:message', {
          sessionId: sessionKey,
          role: 'player',
          content: `[Pre-game] ${event.player}: ${event.content}`,
          turn: 0,
        });
        break;

      case 'turn-start':
        currentTurn = event.turn;
        emitter.emit('session:progress', {
          sessionId,
          sessionKey,
          phase: 'running',
          turn: event.turn,
          maxTurns: event.maxTurns,
          pulses: pulseCount,
          group: groupInfo,
        } satisfies SessionProgress);
        break;

      case 'narrator-turn':
        emitter.emit('session:progress', {
          sessionId,
          sessionKey,
          phase: 'narrator-turn',
          turn: event.turn,
          maxTurns,
          pulses: pulseCount,
          currentSpeaker: 'Narrator',
          lastMessage: event.content,
          group: groupInfo,
        } satisfies SessionProgress);
        // Emit as message
        emitter.emit('session:message', {
          sessionId: sessionKey,
          role: 'narrator',
          content: event.content,
          turn: event.turn,
        });
        break;

      case 'player-turn':
        emitter.emit('session:progress', {
          sessionId,
          sessionKey,
          phase: 'player-turn',
          turn: event.turn,
          maxTurns,
          pulses: pulseCount,
          currentSpeaker: event.player,
          lastMessage: event.content,
          group: groupInfo,
        } satisfies SessionProgress);
        // Emit as message
        emitter.emit('session:message', {
          sessionId: sessionKey,
          role: 'player',
          content: `${event.player}: ${event.content}`,
          turn: event.turn,
        });
        break;

      case 'spokesperson-turn':
        emitter.emit('session:progress', {
          sessionId,
          sessionKey,
          phase: 'spokesperson-turn',
          turn: event.turn,
          maxTurns,
          pulses: pulseCount,
          currentSpeaker: event.player,
          lastMessage: event.content,
          group: groupInfo,
        } satisfies SessionProgress);
        // Emit as message
        emitter.emit('session:message', {
          sessionId: sessionKey,
          role: 'spokesperson',
          content: `[Spokesperson] ${event.player}: ${event.content}`,
          turn: event.turn,
        });
        break;

      case 'pulse':
        pulseCount = event.pulseCount;
        break;

      case 'completed':
        emitter.emit('session:progress', {
          sessionId,
          sessionKey,
          phase: 'completed',
          turn: event.turn,
          maxTurns,
          pulses: event.pulses,
          group: groupInfo,
        } satisfies SessionProgress);
        break;

      case 'failed':
        emitter.emit('session:progress', {
          sessionId,
          sessionKey,
          phase: 'failed',
          turn: currentTurn,
          maxTurns,
          pulses: pulseCount,
          error: event.error,
          group: groupInfo,
        } satisfies SessionProgress);
        break;
    }
  };

  // Build runner config
  const runnerConfig: SessionRunnerConfig = {
    story: {
      storyId: story.id,
      storyTitle: story.title,
      storySetting: story.description || 'A mysterious setting',
      storyGenre: 'horror', // Default genre for test-harness
    },
    systemPrompt,
    storyGuide: story.storyGuide,
    narratorModel,
    maxTurns,
    language: config.language,
    promptStyle,
    onProgress,
    preGeneratedGroup: sharedGroup, // Use shared group for fair comparison
  };

  // Suppress console output during session run (the runner uses ora spinners + console.log)
  // IMPORTANT: Do NOT suppress process.stdout/stderr.write - the AI SDK needs those for streaming!
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  // Only suppress console methods, not raw stdout/stderr
  const noop = () => {};
  console.log = noop;
  console.error = noop;
  console.warn = noop;
  console.info = noop;

  const restoreConsole = () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    console.info = originalInfo;
  };

  // Run the session
  let result: SessionResult;
  try {
    result = await runSession(runnerConfig);
    restoreConsole();
  } catch (error) {
    restoreConsole();
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[TUI] Session ${sessionKey} failed:`, errorMsg);
    emitter.emit('session:progress', {
      sessionId,
      sessionKey,
      phase: 'failed',
      turn: 0,
      maxTurns,
      pulses: 0,
      error: errorMsg,
    } satisfies SessionProgress);
    throw error;
  }

  const duration = Date.now() - startTime;

  // Check if session failed internally
  if (result.error) {
    console.error(`[TUI] Session ${sessionKey} internal error:`, result.error);
    emitter.emit('session:progress', {
      sessionId: result.sessionId,
      sessionKey,
      phase: 'failed',
      turn: result.finalTurn,
      maxTurns,
      pulses: result.detectedPulses.length,
      error: result.error,
    } satisfies SessionProgress);
  }

  // Calculate score from feedback if available
  const score = result.playerFeedback?.narratorScore ?? 7.5;

  // Calculate cost from breakdown if available
  const cost = result.costBreakdown?.total.cost ?? 0;

  const complete: SessionComplete = {
    sessionId: result.sessionId,
    sessionKey,
    turns: result.finalTurn,
    pulses: result.detectedPulses.length,
    score: Math.round(score * 10) / 10,
    cost: Math.round(cost * 1000) / 1000,
    duration,
  };

  emitter.emit('session:complete', complete);

  return complete;
}

// ============================================================================
// Session Orchestrator
// ============================================================================

export class TuiSessionOrchestrator extends EventEmitter {
  private config: TuiSessionConfig;
  private sessions: Map<SessionKey, SessionProgress> = new Map();
  private results: SessionComplete[] = [];
  private isRunning = false;

  constructor(config: TuiSessionConfig) {
    super();
    this.config = config;
  }

  /** Get the list of session keys based on comparison mode */
  getSessionKeys(): SessionKey[] {
    return this.config.comparisonMode === 'prompts'
      ? this.config.promptStyles
      : this.config.models;
  }

  getProgress(key: SessionKey): SessionProgress | undefined {
    return this.sessions.get(key);
  }

  getAllProgress(): Map<SessionKey, SessionProgress> {
    return new Map(this.sessions);
  }

  getResults(): SessionComplete[] {
    return [...this.results];
  }

  isActive(): boolean {
    return this.isRunning;
  }

  async start(): Promise<SessionComplete[]> {
    if (this.isRunning) {
      throw new Error('Sessions already running');
    }

    this.isRunning = true;
    this.sessions.clear();
    this.results = [];

    const sessionKeys = this.getSessionKeys();

    // Initialize all sessions
    for (const key of sessionKeys) {
      this.sessions.set(key, {
        sessionId: `pending-${key}`,
        sessionKey: key,
        phase: 'initializing',
        turn: 0,
        maxTurns: this.config.maxTurns || 20,
        pulses: 0,
      });
    }

    // Set up progress listeners
    this.on('session:progress', (progress: SessionProgress) => {
      this.sessions.set(progress.sessionKey, progress);
    });

    // Generate ONE shared group for all sessions (fair comparison)
    const story = getStory(this.config.storyId);
    if (!story) {
      throw new Error(`Story not found: ${this.config.storyId}`);
    }

    const generatorContext: GeneratorStoryContext = {
      storyId: story.id,
      title: story.title,
      description: story.description || 'A mysterious setting',
      genre: 'horror',
    };

    const archetypeIds = generateGroupComposition();
    const sharedGroup = await generateGroup(
      generatorContext,
      archetypeIds,
      this.config.language,
    );

    // Run all sessions in parallel with the SAME group
    const promises = sessionKeys.map((key) =>
      runRealSession(this.config, key, this, sharedGroup)
    );

    try {
      this.results = await Promise.all(promises);
      this.emit('all:complete', this.results);
      return this.results;
    } finally {
      this.isRunning = false;
    }
  }

  abort(): void {
    // TODO: Implement abort logic with AbortController
    this.isRunning = false;
  }
}
