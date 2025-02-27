"use client";
import { cn } from "@/lib/utils";

interface AudioWaveProps {
  isPlaying: boolean;
  className?: string;
}

export function AudioWave({ isPlaying, className }: AudioWaveProps) {
  const bars = 5; // Number of bars in the wave

  return (
    <div className={cn("flex items-center gap-[2px] h-4", className)}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-[2px] bg-current rounded-full transition-all duration-300",
            isPlaying ? `animate-sound-wave-${(i % 3) + 1}` : "h-[4px]"
          )}
        />
      ))}
    </div>
  );
}
