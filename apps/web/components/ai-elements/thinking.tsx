"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";
import { motion } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// THINKING INDICATOR
// Atmospheric loading state for the narrator
// ─────────────────────────────────────────────────────────────────────────────

const THINKING_PHRASES = [
  "The story awaits...",
  "Shadows gather...",
  "A whisper forms...",
  "The tale unfolds...",
  "Darkness stirs...",
];

export type ThinkingIndicatorProps = {
  phrase?: string;
  className?: string;
};

export const ThinkingIndicator = ({
  className,
  phrase,
}: ThinkingIndicatorProps) => {
  // Use provided phrase or random one
  const displayPhrase =
    phrase ?? THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={cn("flex items-start gap-2", className)}
    >
      <div className="flex items-center gap-3 text-muted-foreground/60">
        {/* Pulsing dots */}
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-current"
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1, 0.8],
              }}
              transition={{
                duration: 1.2,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Phrase */}
        <motion.span
          className="font-serif italic text-sm"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          {displayPhrase}
        </motion.span>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// THINKING DOTS
// Minimal version - just the animated dots
// ─────────────────────────────────────────────────────────────────────────────

export type ThinkingDotsProps = HTMLAttributes<HTMLDivElement>;

export const ThinkingDots = ({ className, ...props }: ThinkingDotsProps) => (
  <div
    className={cn("flex items-center gap-1", className)}
    role="status"
    aria-label="Loading"
    {...props}
  >
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
        animate={{
          opacity: [0.3, 1, 0.3],
          scale: [0.8, 1, 0.8],
        }}
        transition={{
          duration: 1.2,
          repeat: Number.POSITIVE_INFINITY,
          delay: i * 0.15,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TYPING CURSOR
// Blinking cursor for streaming text effect
// ─────────────────────────────────────────────────────────────────────────────

export type TypingCursorProps = {
  className?: string;
};

export const TypingCursor = ({ className }: TypingCursorProps) => (
  <motion.span
    className={cn(
      "inline-block w-0.5 h-[1.1em] bg-foreground/60 ml-0.5 align-middle",
      className
    )}
    animate={{ opacity: [1, 0, 1] }}
    transition={{
      duration: 0.8,
      repeat: Number.POSITIVE_INFINITY,
      ease: "steps(2)",
    }}
    aria-hidden="true"
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// STREAMING TEXT
// Wrapper that adds typing cursor to streaming content
// ─────────────────────────────────────────────────────────────────────────────

export type StreamingTextProps = HTMLAttributes<HTMLDivElement> & {
  isStreaming?: boolean;
};

export const StreamingText = ({
  className,
  isStreaming = false,
  children,
  ...props
}: StreamingTextProps) => (
  <div className={cn("inline", className)} {...props}>
    {children}
    {isStreaming && <TypingCursor />}
  </div>
);
