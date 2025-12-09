/**
 * Save Checkpoints
 *
 * Save checkpoint to file after each turn.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Checkpoint } from './schema';
import { getCheckpointFilename, serializeCheckpoint } from './schema';

/**
 * Save checkpoint to file
 */
export async function saveCheckpoint(checkpoint: Checkpoint): Promise<string> {
  const filename = getCheckpointFilename(checkpoint.sessionId, checkpoint.turn);

  // Ensure directory exists
  const dir = dirname(filename);
  await mkdir(dir, { recursive: true });

  // Write checkpoint
  const json = serializeCheckpoint(checkpoint);
  await writeFile(filename, json, 'utf-8');

  return filename;
}

/**
 * Save multiple checkpoints in batch
 */
export async function saveCheckpoints(checkpoints: Checkpoint[]): Promise<string[]> {
  return Promise.all(checkpoints.map(saveCheckpoint));
}

/**
 * Get session directory for checkpoints
 */
export function getSessionDirectory(sessionId: string): string {
  return `sessions/${sessionId}`;
}
