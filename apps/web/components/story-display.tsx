"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { useMessage } from '@/hooks/use-message';
import { currentBackgroundImageAtom } from '@/lib/atoms';
import { StoryImage } from './story-image';

interface StoryDisplayProps {
  currentMessageId: string | null
}

export function StoryDisplay({ currentMessageId }: StoryDisplayProps) {
  const { message, isLoading, isGeneratingImage } = useMessage(currentMessageId);
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

  // Initial state - minimal placeholder while waiting for first image
  // (The main loading experience is handled by StoryLoadingModal)
  if (!currentMessageId && !displayImageUrl) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-black/50" />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4 relative overflow-hidden">
      {/* Blurred background image overlay - fills entire screen */}
      <AnimatePresence mode="wait">
        {displayImageUrl && (
          <motion.div
            key={`bg-${displayImageUrl}`}
            className="story-background-overlay fixed inset-0 z-0 overflow-hidden pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImageUrl}
              alt=""
              className="w-full h-full object-cover blur-2xl scale-110 opacity-50"
            />
            {/* Subtle gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-background/40 pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main image with cinematic reveal */}
      <AnimatePresence mode="wait">
        {displayImageUrl && (
          <StoryImage
            key={displayImageUrl}
            src={displayImageUrl}
            dimmed={isWaitingForImage}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
