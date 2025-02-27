"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAudioNarration } from "@/hooks/use-audio-narration";
import type { Message } from "ai";

// Define the context type
interface AudioNarrationContextType {
  isPlaying: boolean;
  autoPlay: boolean;
  toggleAutoPlay: () => void;
  speakMessage: (message: Message) => Promise<void>;
  stopSpeaking: () => void;
  clearAudioCache: () => void;
  currentMessageId: string | null;
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
  voiceId?: string;
  apiKey?: string;
}

// Provider component
export function AudioNarrationProvider({
  children,
  voiceId,
  apiKey,
}: AudioNarrationProviderProps) {
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
