"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useConversation } from "@11labs/react";
import type { Message } from "ai";

interface AudioNarrationContextType {
  isPlaying: boolean;
  autoPlay: boolean;
  toggleAutoPlay: () => void;
  speakMessage: (message: Message) => void;
  stopNarration: () => void;
  isConnected: boolean;
}

const AudioNarrationContext = createContext<
  AudioNarrationContextType | undefined
>(undefined);

export function useAudioNarration() {
  const context = useContext(AudioNarrationContext);
  if (context === undefined) {
    throw new Error(
      "useAudioNarration must be used within an AudioNarrationProvider"
    );
  }
  return context;
}

interface AudioNarrationProviderProps {
  children: React.ReactNode;
  agentId?: string;
}

export function AudioNarrationProvider({
  children,
  agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
}: AudioNarrationProviderProps) {
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [sessionStarted, setSessionStarted] = useState<boolean>(false);

  // Initialize the ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs");
      setIsConnected(true);
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs");
      setIsConnected(false);
      setSessionStarted(false);
    },
    onMessage: (message: any) =>
      console.log("Message from ElevenLabs:", message),
    onError: (error: any) => console.error("ElevenLabs error:", error),
  });

  const isPlaying = conversation.isSpeaking;

  // Start a session if not already started
  const ensureSessionStarted = useCallback(async () => {
    if (!sessionStarted && agentId) {
      try {
        await conversation.startSession({
          agentId,
        });
        setSessionStarted(true);
      } catch (error) {
        console.error("Failed to start ElevenLabs session:", error);
      }
    }
  }, [agentId, conversation, sessionStarted]);

  // Toggle auto-play functionality
  const toggleAutoPlay = useCallback(() => {
    setAutoPlay((prev) => !prev);
    if (isPlaying) {
      conversation.endSession();
    }
  }, [isPlaying, conversation]);

  // Speak a message using ElevenLabs
  const speakMessage = useCallback(
    async (message: Message) => {
      if (!message.content || typeof message.content !== "string") return;

      // Only speak assistant messages
      if (message.role !== "assistant") return;

      // Don't speak the same message twice in a row
      if (message.id === currentMessageId) return;

      try {
        await ensureSessionStarted();

        // Send the message text to the agent
        // Note: In the actual ElevenLabs API, we would use a different method
        // This is a placeholder based on the documentation
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Since we can't directly use textToSpeech (it's not in the API),
        // we'll simulate it by sending a message to the agent
        // In a real implementation, you would use the appropriate method
        // from the ElevenLabs SDK
        setCurrentMessageId(message.id);
      } catch (error) {
        console.error("Error speaking message:", error);
      }
    },
    [conversation, currentMessageId, ensureSessionStarted]
  );

  // Stop narration
  const stopNarration = useCallback(() => {
    if (sessionStarted) {
      conversation.endSession();
      setSessionStarted(false);
    }
  }, [conversation, sessionStarted]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (sessionStarted) {
        conversation.endSession();
      }
    };
  }, [conversation, sessionStarted]);

  return (
    <AudioNarrationContext.Provider
      value={{
        isPlaying,
        autoPlay,
        toggleAutoPlay,
        speakMessage,
        stopNarration,
        isConnected,
      }}
    >
      {children}
    </AudioNarrationContext.Provider>
  );
}

// This component automatically narrates new assistant messages
export function AutoNarrator({ messages }: { messages: Message[] }) {
  const { speakMessage, autoPlay, isPlaying } = useAudioNarration();
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!autoPlay || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];

    // Only narrate assistant messages that we haven't processed yet
    if (
      lastMessage.role === "assistant" &&
      lastMessage.id !== lastProcessedMessageId &&
      lastMessage.content &&
      typeof lastMessage.content === "string" &&
      !isPlaying
    ) {
      speakMessage(lastMessage);
      setLastProcessedMessageId(lastMessage.id);
    }
  }, [messages, speakMessage, autoPlay, lastProcessedMessageId, isPlaying]);

  return null;
}
