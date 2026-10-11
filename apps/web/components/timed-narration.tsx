"use client";

import type React from "react";
import { cn } from "@/lib/utils";

export type WordTiming = {
  word: string;
  startMs: number;
  endMs: number;
  startChar: number;
  endChar: number;
};

function isWordTiming(value: unknown): value is WordTiming {
  if (!value || typeof value !== "object") return false;

  const timing = value as Record<string, unknown>;
  return (
    typeof timing.word === "string" &&
    typeof timing.startMs === "number" &&
    typeof timing.endMs === "number" &&
    typeof timing.startChar === "number" &&
    typeof timing.endChar === "number"
  );
}

export function getValidWordTimings(value: unknown): WordTiming[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isWordTiming);
}

// How long the last word stays lit after the voice finishes it
const LAST_WORD_HOLD_MS = 300;

/**
 * The word the voice is on: the latest word to start, kept lit through the pause after it
 * until the next word starts. -1 before the first word and once the last one has ended.
 */
export function activeWordIndex(wordTimings: WordTiming[], timeMs: number): number {
  let active = -1;
  let nextStart = Number.POSITIVE_INFINITY;
  wordTimings.forEach((timing, i) => {
    if (timing.startMs <= timeMs) {
      if (active === -1 || timing.startMs >= wordTimings[active].startMs) active = i;
    } else if (timing.startMs < nextStart) {
      nextStart = timing.startMs;
    }
  });
  if (active === -1) return -1;
  const until = Number.isFinite(nextStart) ? nextStart : wordTimings[active].endMs + LAST_WORD_HOLD_MS;
  return timeMs < until ? active : -1;
}

export function TimedNarration({
  text,
  wordTimings,
  currentTimeMs,
}: {
  text: string;
  wordTimings: WordTiming[];
  currentTimeMs: number;
}) {
  if (wordTimings.length === 0) {
    return (
      <div className="prose prose-base dark:prose-invert max-w-none prose-p:leading-[1.72] prose-p:mb-5 prose-p:last:mb-0 prose-p:text-[hsl(var(--foreground)/0.9)] prose-p:text-pretty">
        <p>{text}</p>
      </div>
    );
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  const active = activeWordIndex(wordTimings, currentTimeMs);

  for (const [index, timing] of wordTimings.entries()) {
    if (
      timing.startChar < cursor ||
      timing.endChar > text.length ||
      timing.startChar >= timing.endChar
    ) {
      continue;
    }

    if (timing.startChar > cursor) {
      nodes.push(text.slice(cursor, timing.startChar));
    }

    const isActive = index === active;

    nodes.push(
      <span
        className={cn(isActive && "spoken-word-active")}
        key={`${timing.startChar}-${timing.endChar}`}
      >
        {text.slice(timing.startChar, timing.endChar)}
      </span>
    );

    cursor = timing.endChar;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return (
    <div className="prose prose-base dark:prose-invert max-w-none prose-p:leading-[1.72] prose-p:mb-5 prose-p:last:mb-0 prose-p:text-[hsl(var(--foreground)/0.9)] prose-p:text-pretty">
      <p>{nodes}</p>
    </div>
  );
}
