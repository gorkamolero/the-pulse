"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Play } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamic import for WebGL component
const StoryOrb = dynamic(
  () => import("./story-orb").then((mod) => ({ default: mod.StoryOrb })),
  { ssr: false, loading: () => <div className="w-32 h-32" /> }
);

const LOADING_PHRASES = [
  "The fog rolls in...",
  "Something stirs in the darkness...",
  "Listen closely...",
  "The threshold beckons...",
  "Ancient echoes call...",
];

const READY_PHRASES = [
  "The story awaits your presence...",
  "Step into the darkness...",
  "Your journey begins...",
];

interface StoryLoadingModalProps {
  isVisible: boolean;
  isReady: boolean; // narrator response + audio available
  storyTitle?: string;
  onBegin: () => void;
}

export function StoryLoadingModal({
  isVisible,
  isReady,
  storyTitle,
  onBegin,
}: StoryLoadingModalProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const phrases = isReady ? READY_PHRASES : LOADING_PHRASES;

  // Cycle through phrases
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [isVisible, phrases.length]);

  // Reset phrase when ready state changes
  useEffect(() => {
    setPhraseIndex(0);
  }, [isReady]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Solid black backdrop - completely opaque */}
          <div className="absolute inset-0 bg-black" />

          {/* Vignette effect */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, transparent 20%, hsl(var(--background)) 80%)",
            }}
          />

          {/* Content */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-8 p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {/* Story title */}
            {storyTitle && (
              <motion.h1
                className="text-2xl md:text-3xl font-serif text-center text-foreground/80"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {storyTitle}
              </motion.h1>
            )}

            {/* The Orb */}
            <div className="my-4">
              <StoryOrb size="lg" />
            </div>

            {/* Atmospheric phrase */}
            <AnimatePresence mode="wait">
              <motion.p
                key={phraseIndex}
                className="text-sm md:text-base text-muted-foreground/70 font-serif italic text-center h-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
              >
                {phrases[phraseIndex]}
              </motion.p>
            </AnimatePresence>

            {/* Loading dots or Begin button */}
            <div className="h-16 flex items-center justify-center">
              {isReady ? (
                <motion.button
                  type="button"
                  onClick={onBegin}
                  className="
                    flex items-center gap-3 px-8 py-4
                    bg-foreground/10 hover:bg-foreground/20
                    border border-foreground/20 hover:border-foreground/40
                    rounded-full text-foreground/80 hover:text-foreground
                    font-serif text-lg
                    transition-all duration-300
                    group
                  "
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Play className="w-5 h-5 group-hover:text-foreground transition-colors" />
                  <span>Begin</span>
                </motion.button>
              ) : (
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-foreground/30"
                      animate={{
                        opacity: [0.3, 0.8, 0.3],
                        scale: [1, 1.3, 1],
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
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
