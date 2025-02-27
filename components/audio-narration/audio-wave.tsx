"use client";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface AudioWaveProps {
  isPlaying: boolean;
  className?: string;
}

export function AudioWave({ isPlaying, className }: AudioWaveProps) {
  const bars = 5; // Number of bars in the wave

  // Generate stable unique IDs for each bar
  const barIds = useMemo(
    () =>
      Array.from({ length: bars }).map(() =>
        Math.random().toString(36).substring(2, 10)
      ),
    [bars]
  );

  return (
    <div className={cn("flex items-center gap-[2px] h-4", className)}>
      {barIds.map((id, i) => (
        <div
          key={id}
          className={cn(
            "w-[2px] bg-current rounded-full transition-all duration-300",
            isPlaying ? `animate-sound-wave-${(i % 3) + 1}` : "h-[4px]"
          )}
        />
      ))}
    </div>
  );
}
