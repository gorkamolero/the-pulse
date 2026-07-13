'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Story } from '@pulse/core/ai/stories';
import { storyTitleStyle } from '@/lib/story-fonts';
import { coverSrc, Ornament, STORY_META } from './story-index';

// Dynamic import for WebGL component
const StoryOrb = dynamic(
  () => import('./story-orb').then((mod) => ({ default: mod.StoryOrb })),
  { ssr: false, loading: () => <div className="w-40 h-40" /> },
);

const LOADING_PHRASES = [
  'The narrator clears its throat...',
  'Setting the scene...',
  'Choosing its words...',
  'Turning to the first page...',
  'Lighting the lamps...',
];

const READY_PHRASES = [
  'Ready when you are.',
  'The first page is open.',
  'It starts when you decide.',
];

interface StoryLoadingModalProps {
  isVisible: boolean;
  isReady: boolean; // narrator response + audio available
  story?: Story;
  onBegin: () => void;
}

export function StoryLoadingModal({
  isVisible,
  isReady,
  story,
  onBegin,
}: StoryLoadingModalProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const phrases = isReady ? READY_PHRASES : LOADING_PHRASES;

  const accent = story?.theme?.accentHex || '#8fa4b8';
  const genre = story ? STORY_META[story.id]?.genre : undefined;
  const storyFont = story
    ? storyTitleStyle(story.id)
    : { fontFamily: 'var(--font-serif-family)' };

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
          transition={{ duration: 0.8 }}
        >
          {/* Solid black ground */}
          <div className="absolute inset-0 bg-black" />

          {/* The story's cover plate, breathing */}
          {story && (
            <motion.img
              src={coverSrc(story.id)}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover object-center"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: 0.4, scale: 1.08 }}
              transition={{
                opacity: { duration: 2, ease: 'easeOut' },
                scale: { duration: 30, ease: 'linear' },
              }}
            />
          )}

          {/* Vignette to keep the title page legible */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 55% 60% at 50% 50%, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.1) 100%)',
            }}
          />

          {/* Content — the title page */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-6 p-8 text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            {/* Genre credit line */}
            {genre && (
              <p
                className="text-[10px] uppercase tracking-[0.35em] pl-[0.35em]"
                style={{ color: accent }}
              >
                {genre}
              </p>
            )}

            {/* Title in the story's own script */}
            {story && (
              <h1
                className="uppercase tracking-[0.15em] text-2xl md:text-4xl leading-snug text-white/95 text-balance max-w-xl"
                style={storyFont}
              >
                {story.title}
              </h1>
            )}

            <div style={{ color: accent }}>
              <Ornament />
            </div>

            {/* The narrator manifesting */}
            <div className="my-2">
              <StoryOrb size="lg" />
            </div>

            {/* Atmospheric phrase */}
            <AnimatePresence mode="wait">
              <motion.p
                key={phraseIndex}
                className="italic text-sm md:text-base text-white/50 h-8"
                style={{ fontFamily: storyFont.fontFamily }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
              >
                {phrases[phraseIndex]}
              </motion.p>
            </AnimatePresence>

            {/* Heartbeat or Begin */}
            <div className="h-16 flex items-center justify-center">
              {isReady ? (
                <motion.button
                  type="button"
                  onClick={onBegin}
                  className="px-12 py-4 font-mono text-[11px] uppercase tracking-[0.4em] pl-[calc(3rem+0.4em)] border transition-colors duration-300 text-white/90 hover:text-white cursor-pointer"
                  style={{
                    borderColor: `${accent}aa`,
                    backgroundColor: `${accent}1a`,
                  }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Begin
                </motion.button>
              ) : (
                <div className="flex gap-3" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rotate-45"
                      style={{ backgroundColor: accent }}
                      animate={{
                        opacity: [0.25, 0.9, 0.25],
                        scale: [1, 1.25, 1],
                      }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.2,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: 'easeInOut',
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
