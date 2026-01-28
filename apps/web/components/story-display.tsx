"use client";

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { useMessage } from '@/hooks/use-message';
import { currentBackgroundImageAtom } from '@/lib/atoms';

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
