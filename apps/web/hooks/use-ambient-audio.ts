"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAtom } from "jotai";
import { audioEnabledAtom } from "@/lib/atoms";
import type { AmbientAudioConfig } from "@pulse/core/ai/stories";

/**
 * Hook to play ambient audio in background with fade-in effect
 * Respects the global audio toggle and loops seamlessly
 */
export function useAmbientAudio(config: AmbientAudioConfig | undefined) {
  const [audioEnabled] = useAtom(audioEnabledAtom);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const targetVolume = config?.volume ?? 0.3;
  const fadeInMs = config?.fadeInMs ?? 3000;

  const fadeIn = useCallback(
    (audio: HTMLAudioElement) => {
      const steps = 30;
      const stepMs = fadeInMs / steps;
      const volumeStep = targetVolume / steps;
      let currentStep = 0;

      audio.volume = 0;

      fadeIntervalRef.current = setInterval(() => {
        currentStep++;
        audio.volume = Math.min(volumeStep * currentStep, targetVolume);

        if (currentStep >= steps) {
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
        }
      }, stepMs);
    },
    [fadeInMs, targetVolume]
  );

  const fadeOut = useCallback(
    (audio: HTMLAudioElement, onComplete?: () => void) => {
      const steps = 15;
      const stepMs = 500 / steps;
      const volumeStep = audio.volume / steps;
      let currentStep = 0;

      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }

      fadeIntervalRef.current = setInterval(() => {
        currentStep++;
        audio.volume = Math.max(audio.volume - volumeStep, 0);

        if (currentStep >= steps) {
          if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
          audio.pause();
          onComplete?.();
        }
      }, stepMs);
    },
    []
  );

  useEffect(() => {
    if (!config?.src) return;

    // Create audio element if needed
    if (!audioRef.current) {
      audioRef.current = new Audio(config.src);
      audioRef.current.loop = true;
      audioRef.current.volume = 0;
    }

    const audio = audioRef.current;

    if (audioEnabled) {
      // Start playing with fade-in
      audio
        .play()
        .then(() => fadeIn(audio))
        .catch((err) => {
          // Autoplay blocked - will play on next user interaction
          console.debug("Ambient audio autoplay blocked:", err.message);
        });
    } else {
      // Fade out and pause
      if (!audio.paused) {
        fadeOut(audio);
      }
    }

    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, [config?.src, audioEnabled, fadeIn, fadeOut]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    isPlaying: audioRef.current ? !audioRef.current.paused : false,
  };
}
