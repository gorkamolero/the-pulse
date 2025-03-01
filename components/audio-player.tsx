"use client";

import { useState, useRef, useEffect } from "react";
import { Pause, Play, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useAtom } from "jotai";
import { audioEnabledAtom, selectedVoiceAtom } from "@/lib/atoms";

interface AudioPlayerProps {
  content: string;
  autoplay?: boolean;
  chatId: string;
}

export function AudioPlayer({ content, autoplay = false, chatId }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioEnabled] = useAtom(audioEnabledAtom);
  const [selectedVoice] = useAtom(selectedVoiceAtom);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Add useEffect for autoplay
  useEffect(() => {
    if (autoplay && content && !isPlaying && !isLoading) {
      playAudio();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, content]);

  // Generate a cache key based on content and voice settings
  const getCacheKey = () => {
    return `audio-${selectedVoice.provider}-${
      selectedVoice.voiceId
    }-${content.substring(0, 100)}`;
  };

  // Check if audio is cached
  const getFromCache = () => {
    const cacheKey = getCacheKey();
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
      try {
        return new Blob([Buffer.from(cachedItem, "base64")], {
          type: "audio/mpeg",
        });
      } catch (e) {
        console.error("Failed to retrieve from cache:", e);
        return null;
      }
    }
    return null;
  };

  // Save audio to cache
  const saveToCache = (blob: Blob) => {
    const cacheKey = getCacheKey();
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = (reader.result as string).split(",")[1];
        localStorage.setItem(cacheKey, base64data);
      };
    } catch (e) {
      console.error("Failed to save to cache:", e);
    }
  };

  // Function to play audio
  const playAudio = async () => {
    // If already playing, pause the audio
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      // Check cache first
      let blob = audioBlob || getFromCache();

      if (!blob) {
        // Show loading state while fetching audio
        setIsLoading(true);

        // Generate audio if not cached
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: content,
            provider: selectedVoice.provider,
            voiceId: selectedVoice.voiceId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate audio");
        }

        blob = await response.blob();
        setAudioBlob(blob);
        saveToCache(blob);

        // Hide loading state after fetching
        setIsLoading(false);
      }

      const url = URL.createObjectURL(blob);

      // Create new audio element if needed
      if (!audioRef.current) {
        audioRef.current = new Audio(url);

        // Set up event listeners
        audioRef.current.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(url);
        };
      } else {
        // Update source if we already have an audio element
        audioRef.current.src = url;
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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="py-1 px-2 h-fit text-muted-foreground"
          variant="outline"
          onClick={playAudio}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={16} />
          ) : (
            <Play size={16} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isLoading
          ? "Loading audio..."
          : isPlaying
          ? "Stop audio"
          : "Play audio"}
      </TooltipContent>
    </Tooltip>
  );
}
