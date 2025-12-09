/**
 * Load & Replay
 *
 * Load checkpoint from file and resume session with optionally modified config.
 */

import { readFile, readdir } from 'node:fs/promises';
import type { Checkpoint, } from './schema';
import { deserializeCheckpoint, getCheckpointFilename } from './schema';
import type { NarratorConfig } from '../agents/narrator';

/**
 * Load checkpoint from file
 */
export async function loadCheckpoint(filename: string): Promise<Checkpoint> {
  const json = await readFile(filename, 'utf-8');
  return deserializeCheckpoint(json);
}

/**
 * Load checkpoint by session ID and turn
 */
export async function loadCheckpointByTurn(
  sessionId: string,
  turn: number,
): Promise<Checkpoint> {
  const filename = getCheckpointFilename(sessionId, turn);
  return loadCheckpoint(filename);
}

/**
 * Load latest checkpoint for a session
 */
export async function loadLatestCheckpoint(sessionId: string): Promise<Checkpoint> {
  const dir = `sessions/${sessionId}`;
  const files = await readdir(dir);

  // Find highest turn number
  const turnFiles = files.filter((f) => f.startsWith('turn-') && f.endsWith('.json'));

  if (turnFiles.length === 0) {
    throw new Error(`No checkpoints found for session ${sessionId}`);
  }

  const turns = turnFiles
    .map((f) => {
      const match = f.match(/turn-(\d+)\.json/);
      return match ? Number.parseInt(match[1] || '0', 10) : 0;
    })
    .filter((t) => t > 0);

  const latestTurn = Math.max(...turns);
  return loadCheckpointByTurn(sessionId, latestTurn);
}

/**
 * Configuration overrides for replay
 */
export interface ReplayConfig {
  systemPrompt?: string;
  storyGuide?: string;
  narratorModel?: NarratorConfig['model'];
  temperature?: number;
  maxTokens?: number;
}

/**
 * Apply config overrides to checkpoint for replay
 */
export function applyReplayConfig(
  checkpoint: Checkpoint,
  config: ReplayConfig,
): Checkpoint {
  const updated = { ...checkpoint };

  if (config.systemPrompt) {
    updated.sessionConfig.systemPrompt = config.systemPrompt;
  }

  if (config.storyGuide) {
    updated.sessionConfig.storyGuide = config.storyGuide;
  }

  if (config.narratorModel) {
    updated.sessionConfig.narratorConfig.model = config.narratorModel;
  }

  if (config.temperature !== undefined) {
    updated.sessionConfig.narratorConfig.temperature = config.temperature;
  }

  if (config.maxTokens !== undefined) {
    updated.sessionConfig.narratorConfig.maxTokens = config.maxTokens;
  }

  // Mark as branched
  if (Object.keys(config).length > 0) {
    updated.metadata.parentCheckpoint = `${checkpoint.sessionId}/turn-${checkpoint.turn}`;
    updated.metadata.branchReason = generateBranchReason(config);
    updated.sessionId = `${checkpoint.sessionId}-branch-${Date.now()}`;
  }

  return updated;
}

/**
 * Generate branch reason from config changes
 */
function generateBranchReason(config: ReplayConfig): string {
  const changes: string[] = [];

  if (config.systemPrompt) changes.push('system prompt');
  if (config.storyGuide) changes.push('story guide');
  if (config.narratorModel) changes.push(`narrator model → ${config.narratorModel}`);
  if (config.temperature !== undefined) changes.push(`temperature → ${config.temperature}`);
  if (config.maxTokens !== undefined) changes.push(`max tokens → ${config.maxTokens}`);

  return `Modified: ${changes.join(', ')}`;
}

/**
 * List all checkpoints for a session
 */
export async function listCheckpoints(sessionId: string): Promise<number[]> {
  const dir = `sessions/${sessionId}`;
  const files = await readdir(dir);

  const turns = files
    .filter((f) => f.startsWith('turn-') && f.endsWith('.json'))
    .map((f) => {
      const match = f.match(/turn-(\d+)\.json/);
      return match ? Number.parseInt(match[1] || '0', 10) : 0;
    })
    .filter((t) => t > 0)
    .sort((a, b) => a - b);

  return turns;
}
