"use client";

import Image from 'next/image';
import { useState } from 'react';

export function StoryDisplay({ currentPulseImage }: { currentPulseImage?: { imageUrl: string, prompt: string } | null }) {
  const [imageError, setImageError] = useState(false);

  if (!currentPulseImage) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">The story visualization will appear here...</p>
      </div>
    );
  }

  // Handle case where image URL is invalid (contains "undefined")
  if (imageError || currentPulseImage.imageUrl.includes('base64,undefined')) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Image generation failed</p>
          <p className="text-sm text-muted-foreground">Unable to load the visualization for this story pulse.</p>
          {currentPulseImage.prompt && (
            <p className="mt-4 text-sm text-muted-foreground text-center">Prompt: {currentPulseImage.prompt}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="max-w-[90%] max-h-[90%] relative">
        <Image 
          src={currentPulseImage.imageUrl}
          alt="Story visualization"
          className="rounded-lg shadow-lg object-contain"
          width={800}
          height={600}
          onError={() => setImageError(true)}
        />
      </div>
    </div>
  );
}
