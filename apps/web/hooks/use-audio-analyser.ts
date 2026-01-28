"use client";

import { useCallback, useRef, useEffect } from "react";
import { useAtomValue } from "jotai";
import { audioElementAtom, audioPlayingAtom } from "@/lib/atoms";

/**
 * Hook that connects to the global audio element and provides
 * a callback for getting the current output volume (0-1 range).
 *
 * Uses Web Audio API's AnalyserNode for real-time frequency analysis.
 */
export function useAudioAnalyser() {
  const audioElement = useAtomValue(audioElementAtom);
  const isPlaying = useAtomValue(audioPlayingAtom);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const connectedElementRef = useRef<HTMLAudioElement | null>(null);
  const isConnectedRef = useRef(false);

  // Connect to audio element when it starts playing
  // This ensures we have user interaction context for AudioContext
  useEffect(() => {
    if (!audioElement || !isPlaying) {
      return;
    }

    // Already connected to this element
    if (connectedElementRef.current === audioElement && isConnectedRef.current) {
      // Just resume if suspended
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume();
      }
      return;
    }

    try {
      // Create audio context on first use (requires user interaction)
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const ctx = audioContextRef.current;

      // Resume if suspended (browser autoplay policy)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Create analyser node
      if (!analyserRef.current) {
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.7;
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
      }

      // Only create source if not already connected to this element
      // createMediaElementSource can only be called once per element
      if (connectedElementRef.current !== audioElement) {
        // Disconnect previous source if exists
        if (sourceRef.current) {
          try {
            sourceRef.current.disconnect();
          } catch {
            // Ignore disconnect errors
          }
        }

        // Create new media element source
        sourceRef.current = ctx.createMediaElementSource(audioElement);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);

        connectedElementRef.current = audioElement;
        isConnectedRef.current = true;
      }
    } catch (error) {
      // If already connected error, that's fine - audio still plays
      if (error instanceof Error && error.message.includes("already connected")) {
        isConnectedRef.current = true;
      } else {
        console.error("Audio analyser setup error:", error);
      }
    }
  }, [audioElement, isPlaying]);

  /**
   * Get the current output volume as a normalized value (0-1).
   * This is called on every frame by the Orb component.
   */
  const getOutputVolume = useCallback((): number => {
    if (!analyserRef.current || !dataArrayRef.current || !isPlaying || !isConnectedRef.current) {
      return 0;
    }

    try {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current as Uint8Array<ArrayBuffer>);

      // Calculate average volume from frequency data
      let sum = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        sum += dataArrayRef.current[i];
      }
      const average = sum / dataArrayRef.current.length;

      // Normalize to 0-1 range (frequency data is 0-255)
      return Math.min(average / 128, 1);
    } catch {
      return 0;
    }
  }, [isPlaying]);

  return { getOutputVolume, isPlaying };
}
