"use client";

import { useRef, useCallback, useState, useEffect } from "react";

interface UseStreamingAudioOptions {
  onTextChunk?: (text: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

interface StreamingAudioState {
  isPlaying: boolean;
  isStreaming: boolean;
  isBuffering: boolean;
}

// Protocol markers for multiplexed stream
const TEXT_MARKER = "T:";
const AUDIO_MARKER = "A:";
const DONE_MARKER = "D:";

/**
 * Hook for handling streaming audio from the chat-stream endpoint.
 * Parses the multiplexed stream and plays audio chunks in real-time.
 */
export function useStreamingAudio(options: UseStreamingAudioOptions = {}) {
  const { onTextChunk, onComplete, onError } = options;

  const [state, setState] = useState<StreamingAudioState>({
    isPlaying: false,
    isStreaming: false,
    isBuffering: false,
  });

  // Audio context and nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingQueueRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scheduledEndTimeRef = useRef(0);

  // Full text accumulator
  const fullTextRef = useRef("");

  // Initialize AudioContext on first interaction
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  // Decode base64 MP3 to AudioBuffer
  const decodeAudioData = useCallback(
    async (base64Audio: string): Promise<AudioBuffer | null> => {
      try {
        const audioContext = initAudioContext();
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        return audioBuffer;
      } catch (error) {
        console.error("[Streaming Audio] Failed to decode audio:", error);
        return null;
      }
    },
    [initAudioContext]
  );

  // Play audio buffer
  const playAudioBuffer = useCallback(
    (audioBuffer: AudioBuffer) => {
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      // Schedule playback
      const currentTime = audioContext.currentTime;
      const startTime = Math.max(currentTime, scheduledEndTimeRef.current);
      source.start(startTime);
      scheduledEndTimeRef.current = startTime + audioBuffer.duration;

      source.onended = () => {
        // Check if there are more buffers to play
        const nextBuffer = audioQueueRef.current.shift();
        if (nextBuffer) {
          playAudioBuffer(nextBuffer);
        } else {
          isPlayingQueueRef.current = false;
          setState((prev) => ({ ...prev, isPlaying: false }));
        }
      };

      currentSourceRef.current = source;
      setState((prev) => ({ ...prev, isPlaying: true }));
    },
    []
  );

  // Queue audio for playback
  const queueAudio = useCallback(
    async (base64Audio: string) => {
      const audioBuffer = await decodeAudioData(base64Audio);
      if (!audioBuffer) return;

      audioQueueRef.current.push(audioBuffer);

      // Start playing if not already
      if (!isPlayingQueueRef.current) {
        isPlayingQueueRef.current = true;
        const buffer = audioQueueRef.current.shift();
        if (buffer) {
          playAudioBuffer(buffer);
        }
      }
    },
    [decodeAudioData, playAudioBuffer]
  );

  // Process a line from the stream
  const processLine = useCallback(
    async (line: string) => {
      if (line.startsWith(TEXT_MARKER)) {
        const text = line.slice(TEXT_MARKER.length);
        fullTextRef.current += text;
        onTextChunk?.(text);
      } else if (line.startsWith(AUDIO_MARKER)) {
        const base64Audio = line.slice(AUDIO_MARKER.length);
        await queueAudio(base64Audio);
      } else if (line.startsWith(DONE_MARKER)) {
        onComplete?.(fullTextRef.current);
        setState((prev) => ({ ...prev, isStreaming: false }));
      }
    },
    [onTextChunk, onComplete, queueAudio]
  );

  // Start streaming from the chat-stream endpoint
  const startStream = useCallback(
    async (
      chatId: string,
      messages: Array<{ role: string; content: unknown }>,
      options?: {
        selectedStoryId?: string;
        language?: string;
        enableAudio?: boolean;
      }
    ) => {
      // Reset state
      fullTextRef.current = "";
      audioQueueRef.current = [];
      scheduledEndTimeRef.current = 0;
      setState({
        isPlaying: false,
        isStreaming: true,
        isBuffering: true,
      });

      try {
        // Resume audio context if suspended
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume();
        }

        const response = await fetch("/api/pulse-stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: chatId,
            messages,
            selectedStoryId: options?.selectedStoryId,
            language: options?.language,
            enableAudio: options?.enableAudio ?? true,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        setState((prev) => ({ ...prev, isBuffering: false }));

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              await processLine(line);
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          await processLine(buffer);
        }
      } catch (error) {
        console.error("[Streaming Audio] Stream error:", error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
        setState((prev) => ({ ...prev, isStreaming: false }));
      }
    },
    [processLine, onError]
  );

  // Stop audio playback
  const stopAudio = useCallback(() => {
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
    scheduledEndTimeRef.current = 0;
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopAudio]);

  return {
    ...state,
    startStream,
    stopAudio,
    fullText: fullTextRef.current,
  };
}
