#!/usr/bin/env npx tsx

/**
 * Metrics CLI
 *
 * View and compare session metrics across runs.
 *
 * Usage:
 *   pnpm cli:metrics                      # Show all sessions
 *   pnpm cli:metrics --story innsmouth    # Filter by story
 *   pnpm cli:metrics --narrator claude    # Filter by narrator
 *   pnpm cli:metrics --since 2025-12-15   # Filter by date
 */

import { readFile, readdir } from 'node:fs/promises';
import { program } from 'commander';
import type { MetricsSummary } from '../report/evaluation';

interface MetricsFilters {
  story?: string;
  narrator?: string;
  since?: string;
}

/**
 * Load metrics from global JSONL or individual session files
 */
async function loadMetrics(): Promise<MetricsSummary[]> {
  const metrics: MetricsSummary[] = [];

  // Try global metrics file first
  try {
    const content = await readFile('sessions/metrics.jsonl', 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        metrics.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // Fall back to reading individual session metrics
    console.log('No global metrics.jsonl found, scanning sessions...\n');
  }

  // Also scan session directories for any metrics not in global log
  const seenIds = new Set(metrics.map((m) => m.sessionId));

  try {
    const sessions = await readdir('sessions', { withFileTypes: true });
    for (const entry of sessions) {
      if (!entry.isDirectory() || entry.name === 'comparisons') continue;

      if (seenIds.has(entry.name)) continue;

      try {
        const metricsPath = `sessions/${entry.name}/metrics.json`;
        const content = await readFile(metricsPath, 'utf-8');
        metrics.push(JSON.parse(content));
      } catch {
        // No metrics.json for this session
      }
    }
  } catch {
    // Sessions directory doesn't exist
  }

  return metrics;
}

/**
 * Filter metrics based on criteria
 */
function filterMetrics(
  metrics: MetricsSummary[],
  filters: MetricsFilters,
): MetricsSummary[] {
  return metrics.filter((m) => {
    if (filters.story && !m.story.toLowerCase().includes(filters.story.toLowerCase())) {
      return false;
    }
    if (filters.narrator && !m.narrator.toLowerCase().includes(filters.narrator.toLowerCase())) {
      return false;
    }
    if (filters.since) {
      const sinceDate = new Date(filters.since);
      const metricDate = new Date(m.timestamp);
      if (metricDate < sinceDate) return false;
    }
    return true;
  });
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m${seconds}s`;
}

/**
 * Truncate string to max length
 */
function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

/**
 * Print metrics table
 */
function printTable(metrics: MetricsSummary[]): void {
  if (metrics.length === 0) {
    console.log('No sessions found matching filters.');
    return;
  }

  // Sort by timestamp descending (most recent first)
  metrics.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Column widths
  const cols = {
    id: 12,
    story: 24,
    narrator: 12,
    score: 6,
    turns: 6,
    issues: 7,
    pacing: 8,
    time: 8,
  };

  // Header
  const header = [
    'Session'.padEnd(cols.id),
    'Story'.padEnd(cols.story),
    'Narrator'.padEnd(cols.narrator),
    'Score'.padEnd(cols.score),
    'Turns'.padEnd(cols.turns),
    'Issues'.padEnd(cols.issues),
    'Pacing'.padEnd(cols.pacing),
    'Time'.padEnd(cols.time),
  ].join(' │ ');

  const separator = [
    '─'.repeat(cols.id),
    '─'.repeat(cols.story),
    '─'.repeat(cols.narrator),
    '─'.repeat(cols.score),
    '─'.repeat(cols.turns),
    '─'.repeat(cols.issues),
    '─'.repeat(cols.pacing),
    '─'.repeat(cols.time),
  ].join('─┼─');

  console.log(header);
  console.log(separator);

  // Rows
  for (const m of metrics) {
    const row = [
      truncate(m.sessionId, cols.id).padEnd(cols.id),
      truncate(m.story, cols.story).padEnd(cols.story),
      truncate(m.narrator, cols.narrator).padEnd(cols.narrator),
      (m.narratorScore !== null ? m.narratorScore.toFixed(1) : 'N/A').padEnd(cols.score),
      String(m.turns).padEnd(cols.turns),
      String(m.contradictions).padEnd(cols.issues),
      (m.pacingConsensus || 'N/A').slice(0, cols.pacing).padEnd(cols.pacing),
      formatDuration(m.duration).padEnd(cols.time),
    ].join(' │ ');
    console.log(row);
  }

  // Summary
  console.log(separator);
  const avgScore =
    metrics.filter((m) => m.narratorScore !== null).reduce((sum, m) => sum + (m.narratorScore ?? 0), 0) /
    metrics.filter((m) => m.narratorScore !== null).length;
  const totalContradictions = metrics.reduce((sum, m) => sum + m.contradictions, 0);
  const avgTurns = metrics.reduce((sum, m) => sum + m.turns, 0) / metrics.length;

  console.log(`\n${metrics.length} sessions | Avg score: ${avgScore.toFixed(2)} | Avg turns: ${avgTurns.toFixed(0)} | Total contradictions: ${totalContradictions}`);
}

/**
 * Print comparison between two stories
 */
function printComparison(metrics: MetricsSummary[]): void {
  const byStory = new Map<string, MetricsSummary[]>();
  for (const m of metrics) {
    const list = byStory.get(m.story) || [];
    list.push(m);
    byStory.set(m.story, list);
  }

  if (byStory.size < 2) {
    console.log('Need at least 2 different stories to compare.');
    return;
  }

  console.log('\n📊 Story Comparison\n');

  const storyStats = Array.from(byStory.entries()).map(([story, runs]) => {
    const scores = runs.filter((r) => r.narratorScore !== null).map((r) => r.narratorScore as number);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const totalContradictions = runs.reduce((sum, r) => sum + r.contradictions, 0);
    const avgTurns = runs.reduce((sum, r) => sum + r.turns, 0) / runs.length;

    return {
      story,
      runs: runs.length,
      avgScore,
      totalContradictions,
      avgTurns,
    };
  });

  // Print comparison table
  console.log('Story                    │ Runs │ Avg Score │ Contradictions │ Avg Turns');
  console.log('─────────────────────────┼──────┼───────────┼────────────────┼──────────');

  for (const stat of storyStats) {
    console.log(
      `${truncate(stat.story, 24).padEnd(24)} │ ${String(stat.runs).padEnd(4)} │ ${stat.avgScore.toFixed(2).padEnd(9)} │ ${String(stat.totalContradictions).padEnd(14)} │ ${stat.avgTurns.toFixed(0)}`,
    );
  }
}

// CLI
program
  .name('metrics')
  .description('View and compare session metrics')
  .option('--story <pattern>', 'Filter by story name')
  .option('--narrator <pattern>', 'Filter by narrator model')
  .option('--since <date>', 'Show sessions since date (YYYY-MM-DD)')
  .option('--compare', 'Show story comparison')
  .action(async (options) => {
    const metrics = await loadMetrics();
    const filtered = filterMetrics(metrics, {
      story: options.story,
      narrator: options.narrator,
      since: options.since,
    });

    printTable(filtered);

    if (options.compare) {
      printComparison(filtered);
    }
  });

program.parse();
