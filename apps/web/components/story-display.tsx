"use client";

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { useMessage } from '@/hooks/use-message';
import { Pulse } from './ui/pulse';

interface StoryDisplayProps {
  currentMessageId: string | null
}

export function StoryDisplay({ currentMessageId }: StoryDisplayProps) {
  const { message, isLoading, isError, isGeneratingImage } = useMessage(currentMessageId);

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

  // Initial state - no previous image to show
  if (!currentMessageId && !displayImageUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-center space-y-4">
          <Pulse />
          <p className="text-sm text-muted-foreground/60 font-serif italic">
            The story awaits...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4 relative overflow-hidden">
      {/* Blurred background image overlay - fills entire screen */}
      {displayImageUrl && (
        <div className="story-background-overlay fixed inset-0 z-0 overflow-hidden">
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

      {/* Loading overlay when waiting for new image */}
      <AnimatePresence>
        {isWaitingForImage && (
          <motion.div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center space-y-6">
              <Pulse />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-serif italic">
                  {isLoading ? "The story unfolds..." : "Visualizing the scene..."}
                </p>
                <motion.div className="w-48 h-1 bg-muted rounded-full mx-auto overflow-hidden">
                  <motion.div
                    className="h-full bg-foreground/20 rounded-full"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{
                      duration: 1.5,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut"
                    }}
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main image with fade-in animation - vertical orientation for 50/50 split */}
      <AnimatePresence mode="wait">
        {displayImageUrl && (
          <motion.div
            key={displayImageUrl}
            className="relative z-10 w-full h-full flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: isWaitingForImage ? 0.3 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Image
              src={displayImageUrl}
              alt="Story visualization"
              className="rounded-lg shadow-2xl object-contain max-h-[85vh]"
              width={600}
              height={900}
              quality={85}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
