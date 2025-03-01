"use client";

import Image from 'next/image';
import { useMessage } from '@/hooks/use-message';

interface StoryDisplayProps {
  currentMessageId: string | null
}

export function StoryDisplay({ currentMessageId }: StoryDisplayProps) {
  const { message, isLoading, isError } = useMessage(currentMessageId);


  // Handle case where image URL is invalid
  if (isError || isLoading || !message?.imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Awaiting story...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 relative">
      {/* Blurred background image */}
      <div className="fixed inset-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <Image 
          src={message?.imageUrl}
          alt="Background"
          className="w-full h-full object-cover blur-md opacity-20"
          fill
          priority={false}
          quality={30}
        />
      </div>
      
      {/* Main image */}
      <div className="max-w-[90%] max-h-[90%] relative z-10">
        <Image 
          src={message?.imageUrl}
          alt="Story visualization"
          className="rounded-lg shadow-lg object-contain"
          width={800}
          height={600}
        />
      </div>
    </div>
  );
}
