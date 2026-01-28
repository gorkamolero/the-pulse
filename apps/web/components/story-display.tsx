"use client";

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useMessage } from '@/hooks/use-message';
import { StoryAwaiting } from './story-awaiting';
import { currentBackgroundImageAtom } from '@/lib/atoms';

// Dynamic import with SSR disabled for WebGL component
const StoryOrb = dynamic(() => import('./story-orb').then(mod => ({ default: mod.StoryOrb })), {
  ssr: false,
});

// Atmospheric phrases for loading states
const LOADING_PHRASES = [
  "The story deepens...",
  "Shadows shift...",
  "Something stirs...",
  "Listen closely...",
  "The veil thins...",
];

const IMAGE_PHRASES = [
  "A vision forms...",
  "Shadows coalesce...",
  "The scene emerges...",
  "Darkness parts...",
];

function TypewriterText({ phrases }: { phrases: string[] }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];
    let currentIndex = 0;
    setIsTyping(true);
    setDisplayText("");

    const typeInterval = setInterval(() => {
      if (currentIndex <= currentPhrase.length) {
        setDisplayText(currentPhrase.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        // Hold, then move to next phrase
        setTimeout(() => {
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
        }, 2500);
      }
    }, 70);

    return () => clearInterval(typeInterval);
  }, [phraseIndex, phrases]);

  return (
    <span className="inline-flex items-center">
      {displayText}
      {isTyping && (
        <motion.span
          className="inline-block w-px h-4 bg-foreground/50 ml-0.5"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
        />
      )}
    </span>
  );
}

interface StoryDisplayProps {
  currentMessageId: string | null
}

export function StoryDisplay({ currentMessageId }: StoryDisplayProps) {
  const { message, isLoading, isError, isGeneratingImage } = useMessage(currentMessageId);
  const setBackgroundImage = useSetAtom(currentBackgroundImageAtom);

  // Keep track of the last valid image to show during loading/generation
  const lastImageUrlRef = useRef<string | null>(null);

  // Update last image when we have a valid one
  useEffect(() => {
    if (message?.imageUrl) {
      lastImageUrlRef.current = message.imageUrl;
    }
  }, [message?.imageUrl]);

  const currentImageUrl = message?.imageUrl;
  const displayImageUrl = currentImageUrl || lastImageUrlRef.current;
  const isWaitingForImage = !currentImageUrl && (isLoading || isGeneratingImage);

  // Update the global background image atom for contrast-aware input styling
  useEffect(() => {
    setBackgroundImage(displayImageUrl || null);
  }, [displayImageUrl, setBackgroundImage]);

  // Initial state - immersive waiting experience
  if (!currentMessageId && !displayImageUrl) {
    return <StoryAwaiting />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4 relative overflow-hidden">
      {/* Blurred background image overlay - fills entire screen */}
      {displayImageUrl && (
        <div className="story-background-overlay fixed inset-0 z-0 overflow-hidden pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImageUrl}
            alt=""
            className="w-full h-full object-cover blur-2xl scale-110 opacity-50"
          />
          {/* Subtle gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-background/40 pointer-events-none" />
        </div>
      )}

      {/* Loading overlay when waiting for new image - atmospheric transition */}
      <AnimatePresence>
        {isWaitingForImage && (
          <motion.div
            className="fixed inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Darkening veil with vignette */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at 50% 50%, hsl(var(--background) / 0.75) 0%, hsl(var(--background) / 0.92) 100%)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />

            {/* Central loading indicator */}
            <div className="relative z-10 flex flex-col items-center gap-8">
              {/* The Orb - atmospheric WebGL visualization */}
              <StoryOrb size="md" />

              {/* Atmospheric typewriter text */}
              <motion.p
                className="text-sm text-muted-foreground/80 font-serif italic h-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <TypewriterText phrases={isLoading ? LOADING_PHRASES : IMAGE_PHRASES} />
              </motion.p>

              {/* Subtle pulsing dots */}
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 rounded-full bg-foreground/20"
                    animate={{
                      opacity: [0.2, 0.5, 0.2],
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.2,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main image with fade-in animation - tall vertical orientation for 50/50 split */}
      <AnimatePresence mode="wait">
        {displayImageUrl && (
          <motion.div
            key={displayImageUrl}
            className="relative z-10 w-full h-full flex items-center justify-center p-2"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: isWaitingForImage ? 0.3 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Image
              src={displayImageUrl}
              alt="Story visualization"
              className="rounded-lg shadow-2xl object-contain max-h-[90vh] max-w-[70%]"
              width={360}
              height={960}
              quality={85}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
