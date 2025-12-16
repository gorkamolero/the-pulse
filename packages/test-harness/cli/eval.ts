#!/usr/bin/env npx tsx

/**
 * Gemini Evaluation CLI
 *
 * Run Gemini Pro evaluation on existing sessions.
 *
 * Usage:
 *   pnpm cli:eval <sessionId>           # Evaluate a single session
 *   pnpm cli:eval --all                 # Evaluate all sessions without gemini-eval.json
 *   pnpm cli:eval --latest              # Evaluate most recent session
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { deserializeCheckpoint } from '../checkpoint/schema';
import { evaluateWithGemini, saveGeminiEvaluation, type GeminiEvaluation } from '../report/gemini-eval';
import type { SessionResult } from '../session/runner';

/**
 * Load session result from checkpoint files
 */
async function loadSessionResult(sessionId: string): Promise<SessionResult> {
  const sessionDir = `sessions/${sessionId}`;

  // Find the highest turn checkpoint
  const files = await readdir(sessionDir);
  const turnFiles = files
    .filter((f) => f.startsWith('turn-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (turnFiles.length === 0) {
    throw new Error(`No checkpoint files found in ${sessionDir}`);
  }

  const latestCheckpoint = turnFiles[0];
  const checkpointPath = `${sessionDir}/${latestCheckpoint}`;
  const content = await readFile(checkpointPath, 'utf-8');
  const checkpoint = deserializeCheckpoint(content);

  // Reconstruct SessionResult from checkpoint
  return {
    sessionId: checkpoint.sessionId,
    config: checkpoint.sessionConfig,
    conversationHistory: checkpoint.conversationHistory,
    outcome: 'completed', // Assume completed if we have checkpoints
    finalTurn: checkpoint.turn,
    duration: 0, // Not available from checkpoint
    privateMoments: checkpoint.privateMoments,
    tangents: checkpoint.detectedTangents,
  };
}

/**
 * Check if session already has Gemini evaluation
 */
async function hasGeminiEval(sessionId: string): Promise<boolean> {
  try {
    await stat(`sessions/${sessionId}/gemini-eval.json`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all session IDs
 */
async function getAllSessionIds(): Promise<string[]> {
  const entries = await readdir('sessions', { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name !== 'comparisons')
    .map((e) => e.name);
}

/**
 * Get most recent session
 */
async function getLatestSessionId(): Promise<string | null> {
  const sessions = await getAllSessionIds();
  if (sessions.length === 0) return null;

  // Find most recently modified
  let latest: { id: string; mtime: number } | null = null;

  for (const id of sessions) {
    try {
      const stats = await stat(`sessions/${id}`);
      if (!latest || stats.mtimeMs > latest.mtime) {
        latest = { id, mtime: stats.mtimeMs };
      }
    } catch {
      // Skip
    }
  }

  return latest?.id ?? null;
}

/**
 * Run evaluation on a single session
 */
async function evaluateSession(sessionId: string): Promise<GeminiEvaluation> {
  const spinner = ora(`Loading session ${sessionId}...`).start();

  const result = await loadSessionResult(sessionId);
  spinner.text = `Evaluating with Gemini Pro (${result.conversationHistory.length} messages)...`;

  const evaluation = await evaluateWithGemini(
    result,
    result.config.systemPrompt,
    result.config.storyGuide,
  );

  spinner.text = 'Saving evaluation...';
  await saveGeminiEvaluation(evaluation, `sessions/${sessionId}`, {
    outcome: result.outcome,
    finalTurn: result.finalTurn,
    maxTurns: result.config.maxTurns,
    error: result.error,
  });

  spinner.succeed(`${sessionId}: ${evaluation.overall.score}/10 (${evaluation.overall.verdict})`);

  return evaluation;
}

/**
 * Print evaluation summary
 */
function printSummary(evaluation: GeminiEvaluation): void {
  console.log(`\n${chalk.bold('═══════════════════════════════════════════════')}`);
  console.log(chalk.bold(`Overall: ${evaluation.overall.score}/10 (${evaluation.overall.verdict})`));
  console.log(chalk.dim(evaluation.overall.summary));
  console.log(chalk.bold('═══════════════════════════════════════════════'));

  console.log(`\n${chalk.bold('Scores:')}`);
  console.log(`  Agency Respect:        ${evaluation.agencyRespect.score}/10`);
  console.log(`  Equipment Engagement:  ${evaluation.equipmentEngagement.score}/10`);
  console.log(`  NPC Dialogue:          ${evaluation.npcDialogue.score}/10`);
  console.log(`  Spatial Consistency:   ${evaluation.spatialConsistency.score}/10`);
  console.log(`  Character Creation:    ${evaluation.characterCreation.score}/10`);
  console.log(`  Invitation Architecture: ${evaluation.invitationArchitecture.score}/10`);
  console.log(`  Atmosphere & Feeling:  ${evaluation.atmosphere.score}/10`);
  console.log(`  Curiosity Following:   ${evaluation.curiosityFollowing.score}/10`);
  console.log(`  Pacing & Breath:       ${evaluation.pacingBreath.score}/10`);

  if (evaluation.agencyViolations.length > 0) {
    console.log(`\n${chalk.red(`Agency Violations (${evaluation.agencyViolations.length}):`)}`);

    for (const violation of evaluation.agencyViolations.slice(0, 3)) {
      console.log(`  Turn ${violation.turn}: "${violation.quote.slice(0, 40)}..."`);
    }
    if (evaluation.agencyViolations.length > 3) {
      console.log(`  ... and ${evaluation.agencyViolations.length - 3} more`);
    }
  }

  if (evaluation.strengths.length > 0) {
    console.log(`\n${chalk.green('Strengths:')}`);
    for (const strength of evaluation.strengths.slice(0, 2)) {
      console.log(`  Turn ${strength.turn}: ${strength.description.slice(0, 60)}...`);
    }
  }

  console.log(`\n${chalk.dim('Full report saved to gemini-eval.md')}`);
}

// CLI
program
  .name('eval')
  .description('Run Gemini Pro evaluation on sessions')
  .argument('[sessionId]', 'Session ID to evaluate')
  .option('--all', 'Evaluate all sessions without existing evaluation')
  .option('--latest', 'Evaluate most recent session')
  .option('--force', 'Re-evaluate even if evaluation exists')
  .action(async (sessionId, options) => {
    try {
      if (options.latest) {
        const latest = await getLatestSessionId();
        if (!latest) {
          console.log(chalk.red('No sessions found'));
          process.exit(1);
        }
        console.log(chalk.dim(`Evaluating latest session: ${latest}`));
        const evaluation = await evaluateSession(latest);
        printSummary(evaluation);
      } else if (options.all) {
        const sessions = await getAllSessionIds();
        let evaluated = 0;
        let skipped = 0;

        for (const id of sessions) {
          if (!options.force && (await hasGeminiEval(id))) {
            skipped++;
            continue;
          }

          try {
            await evaluateSession(id);
            evaluated++;
          } catch (error) {
            console.log(chalk.red(`Failed to evaluate ${id}: ${error}`));
          }
        }

        console.log(`\nEvaluated ${evaluated} sessions, skipped ${skipped} (already evaluated)`);
      } else if (sessionId) {
        if (!options.force && (await hasGeminiEval(sessionId))) {
          console.log(chalk.yellow(`Session ${sessionId} already has evaluation. Use --force to re-evaluate.`));

          // Load and display existing evaluation
          const existing = JSON.parse(
            await readFile(`sessions/${sessionId}/gemini-eval.json`, 'utf-8'),
          ) as GeminiEvaluation;
          printSummary(existing);
        } else {
          const evaluation = await evaluateSession(sessionId);
          printSummary(evaluation);
        }
      } else {
        program.help();
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program.parse();
