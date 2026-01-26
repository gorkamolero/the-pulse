"use client";

import { useState, useRef, useEffect } from "react";
import { Pause, Play, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useAtom } from "jotai";
import { audioEnabledAtom, selectedVoiceAtom } from "@/lib/atoms";
import { useMessage } from "@/hooks/use-message";

interface AudioPlayerProps {
  content: string;
  autoplay?: boolean;
  chatId: string;
  id: string;
}

export function AudioPlayer({ content, autoplay = false, chatId, id }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioEnabled] = useAtom(audioEnabledAtom);
  const [selectedVoice] = useAtom(selectedVoiceAtom);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoplayedRef = useRef(false);

  // Poll for pre-generated audio URL from database
  const { message, isGeneratingAudio } = useMessage(id);
  const audioUrl = message?.audioUrl;

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
      return;
    }

    try {
      let urlToPlay = audioUrl;

      // Fallback: generate on-demand if no pre-generated audio
      if (!urlToPlay) {
        setIsLoading(true);

        const response = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: content,
            voiceId: selectedVoice,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate audio");
        }

        const blob = await response.blob();
        urlToPlay = URL.createObjectURL(blob);
        setIsLoading(false);
      }

      // Create or update audio element
      if (!audioRef.current) {
        audioRef.current = new Audio(urlToPlay);
        audioRef.current.onended = () => {
          setIsPlaying(false);
        };
      } else {
        audioRef.current.src = urlToPlay;
      }

      // Play the audio
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
      setIsLoading(false);
    }
  };

  // Don't render if audio is disabled
  if (!audioEnabled) return null;

  // Show generating state
  const showGenerating = isGeneratingAudio && !audioUrl;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="py-1 px-2 h-fit text-muted-foreground"
          variant="outline"
          onClick={playAudio}
          disabled={isLoading || showGenerating}
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
  );
}
