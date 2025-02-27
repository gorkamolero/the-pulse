"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAudioNarration } from "@/hooks/use-audio-narration";
import type { Message } from "ai";
import { DEFAULT_VOICE_ID } from "@/lib/elevenlabs";

// Define the context type
interface AudioNarrationContextType {
  isPlaying: boolean;
  autoPlay: boolean;
  toggleAutoPlay: () => void;
  speakMessage: (message: Message) => Promise<void>;
  stopSpeaking: () => void;
  clearAudioCache: () => void;
  currentMessageId: string | null;
  voiceId: string;
}

// Create the context
const AudioNarrationContext = createContext<
  AudioNarrationContextType | undefined
>(undefined);

// Hook to use the audio narration context
export function useAudioNarrationContext() {
  const context = useContext(AudioNarrationContext);
  if (context === undefined) {
    throw new Error(
      "useAudioNarrationContext must be used within an AudioNarrationProvider"
    );
  }
  return context;
}

// Provider component props
interface AudioNarrationProviderProps {
  children: React.ReactNode;
  initialVoiceId?: string;
  apiKey?: string;
}

// Provider component
export function AudioNarrationProvider({
  children,
  initialVoiceId = DEFAULT_VOICE_ID,
  apiKey,
}: AudioNarrationProviderProps) {
  const [voiceId, setVoiceId] = useState<string>(initialVoiceId);

  const {
    isPlaying,
    autoPlay,
    toggleAutoPlay,
    speakMessage,
    stopSpeaking,
    clearAudioCache,
    currentMessageId,
  } = useAudioNarration({
    voiceId,
    apiKey,
  });

  // Listen for voice change events
  useEffect(() => {
    const handleVoiceChange = (event: CustomEvent) => {
      const newVoiceId = event.detail?.voiceId;
      if (newVoiceId && newVoiceId !== voiceId) {
        setVoiceId(newVoiceId);
        // Stop any current playback when voice changes
        if (isPlaying) {
          stopSpeaking();
        }
      }
    };

    // Add event listener
    window.addEventListener(
      "voice-changed",
      handleVoiceChange as EventListener
    );

    // Clean up
    return () => {
      window.removeEventListener(
        "voice-changed",
        handleVoiceChange as EventListener
      );
    };
  }, [voiceId, isPlaying, stopSpeaking]);

  // Initialize from localStorage if available
  useEffect(() => {
    const savedVoiceId = localStorage.getItem("selectedVoiceId");
    if (savedVoiceId) {
      setVoiceId(savedVoiceId);
    }
  }, []);

  return (
    <AudioNarrationContext.Provider
      value={{
        isPlaying,
        autoPlay,
        toggleAutoPlay,
        speakMessage,
        stopSpeaking,
        clearAudioCache,
        currentMessageId,
        voiceId,
      }}
    >
      {children}
    </AudioNarrationContext.Provider>
  );
}

// Component to automatically narrate new messages
export function AutoNarrator({ messages }: { messages: Message[] }) {
  const { speakMessage, autoPlay, isPlaying, currentMessageId } =
    useAudioNarrationContext();
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<
    string | null
  >(null);
  const [isQueueing, setIsQueueing] = useState(false);

  useEffect(() => {
    if (!autoPlay || messages.length === 0) return;

    // Check if there are pending requests in the queue
    const hasPendingRequests =
      typeof window !== "undefined" &&
      window.AudioManager &&
      window.AudioManager.pendingRequests &&
      window.AudioManager.pendingRequests.length > 0;

    // Don't add more messages if we're already queueing or if there are pending requests
    if (isQueueing || hasPendingRequests) return;

    const lastMessage = messages[messages.length - 1];

    // Only narrate assistant messages that we haven't processed yet
    if (
      lastMessage.role === "assistant" &&
      lastMessage.id !== lastProcessedMessageId &&
      lastMessage.id !== currentMessageId &&
      lastMessage.content &&
      typeof lastMessage.content === "string"
    ) {
      setIsQueueing(true);
      speakMessage(lastMessage).finally(() => {
        setIsQueueing(false);
        setLastProcessedMessageId(lastMessage.id);
      });
    }
  }, [
    messages,
    speakMessage,
    autoPlay,
    lastProcessedMessageId,
    isPlaying,
    currentMessageId,
    isQueueing,
  ]);

  return null;
}
