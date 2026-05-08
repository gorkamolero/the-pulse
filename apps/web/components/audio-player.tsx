"use client";

import { useState, useRef, useEffect } from "react";
import { Pause, Play, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./ui/tooltip";
import { useAtom } from "jotai";
import { audioEnabledAtom } from "@/lib/atoms";
import { useMessage } from "@/hooks/use-message";
import type { WordTiming } from "./timed-narration";

interface AudioPlayerProps {
  content: string;
  autoplay?: boolean;
  chatId: string;
  id: string;
  onPlaybackTimeChange?: (timeMs: number) => void;
}

export function AudioPlayer({
  autoplay = false,
  id,
  onPlaybackTimeChange,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioEnabled] = useAtom(audioEnabledAtom);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoplayedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // Poll for pre-generated audio URL from database
  const { message, isGeneratingAudio, updateMessage } = useMessage(id);
  const audioUrl = message?.audioUrl;

  const stopPlaybackClock = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const startPlaybackClock = () => {
    stopPlaybackClock();

    const tick = () => {
      if (audioRef.current) {
        onPlaybackTimeChange?.(audioRef.current.currentTime * 1000);
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
  };

  // Autoplay when audio becomes available
  useEffect(() => {
    if (
      autoplay &&
      audioEnabled &&
      audioUrl &&
      !isPlaying &&
      !hasAutoplayedRef.current
    ) {
      hasAutoplayedRef.current = true;
      playAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, audioUrl, audioEnabled]);

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      stopPlaybackClock();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Function to play audio
  const playAudio = async () => {
    // If already playing, pause the audio
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopPlaybackClock();
      return;
    }

    try {
      let urlToPlay = audioUrl;

      // Fallback: generate on-demand if no pre-generated audio
      if (!urlToPlay) {
        setIsLoading(true);

        const response = await fetch(`/api/messages/${id}/audio`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to generate audio");
        }

        const result = (await response.json()) as {
          audioUrl?: string;
          wordTimings?: WordTiming[] | null;
        };

        if (!result.audioUrl) {
          throw new Error("Audio generation did not return a URL");
        }

        urlToPlay = result.audioUrl;
        updateMessage((currentMessage) => ({
          ...currentMessage,
          audioUrl: result.audioUrl ?? currentMessage.audioUrl,
          wordTimings: result.wordTimings ?? currentMessage.wordTimings,
        }));
        setIsLoading(false);
      }

      // Create or update audio element
      if (!audioRef.current) {
        audioRef.current = new Audio(urlToPlay);
        audioRef.current.onended = () => {
          setIsPlaying(false);
          stopPlaybackClock();
          onPlaybackTimeChange?.(0);
        };
        audioRef.current.onpause = () => {
          if (audioRef.current?.ended) return;
          stopPlaybackClock();
        };
      } else {
        audioRef.current.src = urlToPlay;
      }

      // Play the audio
      await audioRef.current.play();
      setIsPlaying(true);
      startPlaybackClock();
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
      setIsLoading(false);
      stopPlaybackClock();
    }
  };

  // Don't render if audio is disabled
  if (!audioEnabled) return null;

  // Show generating state
  const showGenerating = isGeneratingAudio && !audioUrl;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="py-1 px-2 h-fit text-muted-foreground"
            variant="outline"
            onClick={playAudio}
            disabled={isLoading || showGenerating}
            type="button"
          >
            {isLoading || showGenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {showGenerating
            ? "Generating audio..."
            : isLoading
              ? "Loading audio..."
              : isPlaying
                ? "Pause"
                : "Play narration"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
