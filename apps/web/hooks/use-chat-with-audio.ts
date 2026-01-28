"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import type { UIMessage } from "ai";

interface AudioChunk {
  buffer: AudioBuffer;
  scheduledTime: number;
}

interface UseChatWithAudioOptions {
  chatId: string;
  onTextChunk?: (text: string, fullText: string) => void;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  onAmbienceUrl?: (url: string) => void; // Called when scene ambience is ready
  enabled?: boolean;
}

interface ChatWithAudioState {
  isStreaming: boolean;
  isPlaying: boolean;
  fullText: string;
}

// Protocol markers
const TEXT_MARKER = "T:";
const AUDIO_MARKER = "A:";
const SFX_MARKER = "S:"; // Sound effect / ambience URL
const DONE_MARKER = "D:";

/**
 * Hook for streaming chat with real-time audio narration.
 * Uses the /api/pulse-stream endpoint which provides multiplexed text and audio.
 */
export function useChatWithAudio(options: UseChatWithAudioOptions) {
  const {
    chatId,
    onTextChunk,
    onAudioStart,
    onAudioEnd,
    onComplete,
    onError,
    onAmbienceUrl,
    enabled = true,
  } = options;

  const [state, setState] = useState<ChatWithAudioState>({
    isStreaming: false,
    isPlaying: false,
    fullText: "",
  });

  // Audio context and playback state
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize audio context
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  // Decode base64 audio to AudioBuffer
  const decodeAudio = useCallback(
    async (base64: string): Promise<AudioBuffer | null> => {
      try {
        const ctx = getAudioContext();
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return await ctx.decodeAudioData(bytes.buffer.slice(0));
      } catch (e) {
        console.error("[Audio] Decode error:", e);
        return null;
      }
    },
    [getAudioContext]
  );

  // Play queued audio buffers
  const playNextBuffer = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setState((s) => ({ ...s, isPlaying: false }));
      onAudioEnd?.();
      return;
    }

    const ctx = audioContextRef.current;
    if (!ctx) return;

    const buffer = audioQueueRef.current.shift();
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;

    source.onended = playNextBuffer;
  }, [onAudioEnd]);

  // Queue audio buffer for playback
  const queueAudioBuffer = useCallback(
    (buffer: AudioBuffer) => {
      audioQueueRef.current.push(buffer);

      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        setState((s) => ({ ...s, isPlaying: true }));
        onAudioStart?.();
        playNextBuffer();
      }
    },
    [onAudioStart, playNextBuffer]
  );

  // Send message with streaming audio
  const sendMessage = useCallback(
    async (
      messages: UIMessage[],
      options?: {
        selectedStoryId?: string;
        language?: string;
      }
    ) => {
      if (!enabled) return null;

      // Cancel any existing stream
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Reset state
      audioQueueRef.current = [];
      nextPlayTimeRef.current = 0;
      setState({
        isStreaming: true,
        isPlaying: false,
        fullText: "",
      });

      try {
        // Resume audio context if needed
        const ctx = getAudioContext();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        const response = await fetch("/api/pulse-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: chatId,
            messages,
            selectedStoryId: options?.selectedStoryId,
            language: options?.language,
            enableAudio: true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            if (line.startsWith(TEXT_MARKER)) {
              const text = line.slice(TEXT_MARKER.length);
              fullText += text;
              setState((s) => ({ ...s, fullText }));
              onTextChunk?.(text, fullText);
            } else if (line.startsWith(AUDIO_MARKER)) {
              const base64 = line.slice(AUDIO_MARKER.length);
              const audioBuffer = await decodeAudio(base64);
              if (audioBuffer) {
                queueAudioBuffer(audioBuffer);
              }
            } else if (line.startsWith(SFX_MARKER)) {
              const url = line.slice(SFX_MARKER.length);
              onAmbienceUrl?.(url);
            } else if (line.startsWith(DONE_MARKER)) {
              onComplete?.(fullText);
            }
          }
        }

        setState((s) => ({ ...s, isStreaming: false }));
        return fullText;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return null;
        }
        console.error("[Chat Audio] Error:", error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
        setState((s) => ({ ...s, isStreaming: false }));
        return null;
      }
    },
    [
      chatId,
      enabled,
      getAudioContext,
      decodeAudio,
      queueAudioBuffer,
      onTextChunk,
      onComplete,
      onError,
    ]
  );

  // Stop current stream and audio
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextPlayTimeRef.current = 0;
    setState((s) => ({ ...s, isStreaming: false, isPlaying: false }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      audioContextRef.current?.close();
    };
  }, []);

  return {
    ...state,
    sendMessage,
    stop,
  };
}
