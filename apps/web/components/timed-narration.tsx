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

  for (const timing of wordTimings) {
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

    const isActive = timing.startMs <= currentTimeMs && currentTimeMs < timing.endMs;

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
