"use client";

import { useAtomValue } from "jotai";
import { Orb } from "@/components/ui/orb";
import { useAudioAnalyser } from "@/hooks/use-audio-analyser";
import { narratorStateAtom } from "@/lib/atoms";
import { cn } from "@/lib/utils";

/**
 * Atmospheric color palettes for the Orb.
 * Ethereal, ghostly tones that evoke mystery and the supernatural.
 */
const ORB_COLORS = {
  // Default: pale ghostly blue-grey (visible against dark backgrounds)
  idle: ["#8fa4b8", "#6b8299"] as [string, string],
  // Thinking: muted violet pulse (contemplative, mysterious)
  thinking: ["#9a8ba8", "#7a6b88"] as [string, string],
  // Talking: warmer ethereal tones (alive, present)
  talking: ["#a8b4c4", "#8899aa"] as [string, string],
};

interface StoryOrbProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * The Pulse's audio-reactive orb visualization.
 *
 * Connects to global narrator state and audio playback for:
 * - Visual state changes (idle, thinking, talking)
 * - Audio-reactive pulsing during TTS playback (via proxy for CORS)
 */
export function StoryOrb({ className, size = "md" }: StoryOrbProps) {
  const narratorState = useAtomValue(narratorStateAtom);
  const { getOutputVolume, isPlaying } = useAudioAnalyser();

  // Select colors based on state
  const colors = narratorState === "thinking"
    ? ORB_COLORS.thinking
    : isPlaying
      ? ORB_COLORS.talking
      : ORB_COLORS.idle;

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-32 h-32",
    lg: "w-48 h-48",
  };

  return (
    <div className={cn(sizeClasses[size], className)}>
      <Orb
        colors={colors}
        agentState={narratorState}
        getOutputVolume={getOutputVolume}
        className="w-full h-full"
      />
    </div>
  );
}
