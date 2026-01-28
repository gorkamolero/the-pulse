"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Atmospheric fragments that fade in/out during the waiting state
 * These set the mood before the story begins
 */
const ATMOSPHERIC_FRAGMENTS = [
  "The fog rolls in...",
  "Something stirs in the darkness...",
  "Listen closely...",
  "The threshold beckons...",
  "What waits beyond?",
  "The veil grows thin...",
  "Ancient echoes call...",
  "The story breathes...",
];

/**
 * Esoteric symbols that flicker in the background
 * Unicode characters that evoke mystery and the occult
 */
const ARCANE_SYMBOLS = ["◈", "◇", "△", "○", "☽", "✧", "⬡", "⟁", "⌘", "※"];

function ArcaneSymbol({ delay, x, y, symbol }: { delay: number; x: number; y: number; symbol: string }) {

  return (
    <motion.span
      className="absolute text-foreground/5 text-2xl font-light select-none pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{
        opacity: [0, 0.15, 0],
        scale: [0.5, 1, 0.8],
      }}
      transition={{
        duration: 4,
        delay,
        repeat: Number.POSITIVE_INFINITY,
        repeatDelay: Math.random() * 3,
      }}
    >
      {symbol}
    </motion.span>
  );
}

function FogLayer({ opacity, speed }: { opacity: number; speed: number }) {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at 50% 100%, hsl(var(--foreground) / ${opacity}) 0%, transparent 70%)`,
      }}
      animate={{
        opacity: [0.3, 0.7, 0.3],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: speed,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
    />
  );
}

/**
 * The heartbeat pulse - more organic than a simple pulsing circle
 * Mimics an actual heartbeat rhythm (lub-dub pattern)
 */
function HeartbeatPulse() {
  return (
    <div className="relative">
      {/* Outer glow rings */}
      <motion.div
        className="absolute inset-0 rounded-full bg-foreground/10"
        style={{ width: 80, height: 80, margin: "auto", left: 0, right: 0, top: 0, bottom: 0 }}
        animate={{
          scale: [1, 2.5, 1],
          opacity: [0.3, 0, 0.3],
        }}
        transition={{
          duration: 1.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: [0.4, 0, 0.2, 1],
        }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-foreground/10"
        style={{ width: 80, height: 80, margin: "auto", left: 0, right: 0, top: 0, bottom: 0 }}
        animate={{
          scale: [1, 2, 1],
          opacity: [0.2, 0, 0.2],
        }}
        transition={{
          duration: 1.5,
          delay: 0.15,
          repeat: Number.POSITIVE_INFINITY,
          ease: [0.4, 0, 0.2, 1],
        }}
      />

      {/* Core pulse - heartbeat rhythm */}
      <motion.div
        className="relative w-12 h-12 rounded-full bg-gradient-to-br from-foreground/40 to-foreground/20 shadow-lg"
        animate={{
          scale: [1, 1.15, 1, 1.1, 1], // lub-dub pattern
        }}
        transition={{
          duration: 1.2,
          repeat: Number.POSITIVE_INFINITY,
          times: [0, 0.15, 0.3, 0.45, 1],
          ease: "easeOut",
        }}
      >
        {/* Inner light */}
        <motion.div
          className="absolute inset-2 rounded-full bg-foreground/30"
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </div>
  );
}

/**
 * Animated text that types out then fades
 */
function TypewriterFragment({ text, onComplete }: { text: string; onComplete: () => void }) {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayText(text.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        // Hold for a moment then signal completion
        setTimeout(onComplete, 2000);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [text, onComplete]);

  return (
    <motion.p
      className="text-sm text-muted-foreground/70 font-serif italic tracking-wide h-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: isComplete ? [1, 0] : 1 }}
      transition={{ duration: isComplete ? 1 : 0.3 }}
    >
      {displayText}
      {!isComplete && (
        <motion.span
          className="inline-block w-px h-4 bg-foreground/40 ml-0.5"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
        />
      )}
    </motion.p>
  );
}

export function StoryAwaiting() {
  const [fragmentIndex, setFragmentIndex] = useState(0);
  const [symbolPositions] = useState(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: `symbol-${i}`,
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10,
      delay: Math.random() * 2,
      symbol: ARCANE_SYMBOLS[i % ARCANE_SYMBOLS.length],
    }))
  );

  const handleFragmentComplete = () => {
    setFragmentIndex((prev) => (prev + 1) % ATMOSPHERIC_FRAGMENTS.length);
  };

  return (
    <div className="relative flex items-center justify-center h-full w-full overflow-hidden">
      {/* Deep background - vignette effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 20%, hsl(var(--background)) 80%)",
        }}
      />

      {/* Fog layers - subtle atmospheric depth */}
      <FogLayer opacity={0.03} speed={8} />
      <FogLayer opacity={0.02} speed={12} />

      {/* Floating arcane symbols */}
      {symbolPositions.map((pos) => (
        <ArcaneSymbol key={pos.id} delay={pos.delay} x={pos.x} y={pos.y} symbol={pos.symbol} />
      ))}

      {/* Central content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* The pulse - center of attention */}
        <HeartbeatPulse />

        {/* Atmospheric text rotation */}
        <div className="h-8 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <TypewriterFragment
              key={fragmentIndex}
              text={ATMOSPHERIC_FRAGMENTS[fragmentIndex]}
              onComplete={handleFragmentComplete}
            />
          </AnimatePresence>
        </div>

        {/* Subtle progress indicator - three dots that pulse in sequence */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-foreground/20"
              animate={{
                opacity: [0.2, 0.6, 0.2],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 1.5,
                delay: i * 0.2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: "linear-gradient(to top, hsl(var(--background)) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
