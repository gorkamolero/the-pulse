"use client";

import type { UIMessage, CreateUIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";

type Attachment = {
  url: string;
  name?: string;
  contentType?: string;
};
import { useState, useCallback, useEffect, useMemo } from "react";
import { useSWRConfig } from "swr";
import { useAtomValue, useSetAtom } from "jotai";
import { stories } from "@pulse/core/ai/stories";
import { initStoryTypography, resetStoryTypography } from "@/lib/font-loader";

import { StoryDisplay } from "@/components/story-display";
import { StoryLoadingModal } from "@/components/story-loading-modal";
import { audioEnabledAtom, storyBegunAtom } from "@/lib/atoms";
import { ChatHeader } from "@/components/chat-header";
import { getUIMessageContent } from "@/lib/utils";
import { DEFAULT_STORY_ID } from "@pulse/core/ai/stories";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useAmbientAudio } from "@/hooks/use-ambient-audio";
import { SoftGateModal } from "./soft-gate-modal";

import { Overview } from "./overview";
import { MultimodalInput } from "./multimodal-input";
import { Messages } from "./messages";
import type { VisibilityType } from "./visibility-selector";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export function Chat({
  id,
  initialMessages,
  selectedVisibilityType,
  isReadonly,
  user,
  disabled,
  disabledReason,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { mutate } = useSWRConfig();
  const [selectedStoryId, setSelectedStoryId] = useState(DEFAULT_STORY_ID);
  const [isSoloMode, setIsSoloMode] = useState(true);
  const [language, setLanguage] = useState<string>("en");
  const [selectedStoryTitle, setSelectedStoryTitle] = useState<string>("");
  const audioEnabled = useAtomValue(audioEnabledAtom);
  const setStoryBegun = useSetAtom(storyBegunAtom);

  // Simple 3-phase UI state (no race conditions):
  // - 'overview': Story selection screen
  // - 'loading': Black screen + loading modal (story starting)
  // - 'chat': Full chat interface
  const [phase, setPhase] = useState<'overview' | 'loading' | 'chat'>(
    initialMessages.length > 0 ? 'chat' : 'overview'
  );

  // If returning to existing session, mark story as begun for audio autoplay
  useEffect(() => {
    if (initialMessages.length > 0) {
      setStoryBegun(true);
    }
  }, [initialMessages.length, setStoryBegun]);

  // Get selected story for ambient audio
  const selectedStory = useMemo(
    () => stories.find((s) => s.id === selectedStoryId),
    [selectedStoryId]
  );

  // Play ambient audio when in chat phase
  useAmbientAudio(phase === "chat" ? selectedStory?.ambientAudio : undefined);

  // Guest session tracking
  const isGuest = !user?.id;
  const {
    session: guestSession,
    initSession,
    addMessage: addGuestMessage,
    shouldShowSoftGate,
    markSoftGateShown,
    pulseCount,
    maxPulses,
  } = useGuestSession();
  const [showSoftGate, setShowSoftGate] = useState(false);

  // Initialize guest session on mount if guest
  useEffect(() => {
    if (isGuest && !guestSession) {
      initSession();
    }
  }, [isGuest, guestSession, initSession]);

  // Check for soft gate after pulse count changes
  useEffect(() => {
    if (isGuest && shouldShowSoftGate()) {
      setShowSoftGate(true);
      markSoftGateShown();
    }
  }, [isGuest, shouldShowSoftGate, markSoftGateShown, pulseCount]);

  // Load the language preference from cookies on component mount
  useEffect(() => {
    const languageCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("language="));

    if (languageCookie) {
      const language = languageCookie.split("=")[1];
      setLanguage(language);
    }
  }, []);

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  // Guest limit check
  const guestLimitReached = isGuest && pulseCount >= maxPulses;

  // Create transport with custom API endpoint and body
  // This is the solo play flow - multiplayer uses a different route
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/pulse',
    body: {
      selectedStoryId,
      language,
      solo: isSoloMode, // Solo mode - skips multi-player character creation
      ...(isGuest && { guestPulseCount: pulseCount }),
    },
  }), [isGuest, pulseCount, selectedStoryId, language, isSoloMode]);

  // Track when audio is ready from the stream data
  const [audioReady, setAudioReady] = useState(false);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
  } = useChat({
    id,
    transport,
    messages: initialMessages,
    experimental_throttle: 100,
    // Handle custom data parts from the stream
    onData: (dataPart) => {
      // Check for audio-ready signal
      if (dataPart && typeof dataPart === 'object' && 'type' in dataPart) {
        if ((dataPart as { type: string }).type === 'data-audio-ready') {
          setAudioReady(true);
        }
      }
    },
    // Track assistant responses for guest pulse counting
    onFinish: ({ message }) => {
      if (isGuest && message.role === 'assistant') {
        addGuestMessage({ role: 'assistant', content: '' });
      }
    },
  });

  const handleStorySelection = useCallback(
    async (storyId: string, solo: boolean) => {
      setSelectedStoryId(storyId);
      setIsSoloMode(solo);

      // Get story title and immediately switch to loading phase
      const story = stories.find(s => s.id === storyId);
      if (story) {
        setSelectedStoryTitle(story.title);
        setPhase('loading'); // Instantly show loading screen + modal

        // Lazy-load story-specific typography (non-blocking)
        initStoryTypography(story.theme?.typography);
      }

      mutate("/api/history");
    },
    [mutate]
  );

  // Load story typography when returning to existing session
  useEffect(() => {
    if (initialMessages.length > 0 && selectedStory?.theme?.typography) {
      initStoryTypography(selectedStory.theme.typography);
    }

    // Cleanup on unmount
    return () => resetStoryTypography();
  }, [initialMessages.length, selectedStory?.theme?.typography]);

  // Create wrapper functions to match the old API
  const handleSubmit = useCallback(
    (event?: { preventDefault?: () => void }, chatRequestOptions?: { experimental_attachments?: Array<Attachment> }) => {
      event?.preventDefault?.();
      if (!input.trim() && !attachments.length) return;

      // Convert attachments to files format if needed
      // For now, sending just text - file handling needs to be implemented
      sendMessage({
        text: input,
      });

      setInput("");
      setAttachments([]);
      mutate("/api/history");
    },
    [input, attachments, sendMessage, mutate]
  );

  const append = useCallback(
    async (message: UIMessage | CreateUIMessage<UIMessage>, chatRequestOptions?: { experimental_attachments?: Array<Attachment> }) => {
      const textContent = getUIMessageContent(message as UIMessage);
      await sendMessage({
        text: textContent,
      });
      return null;
    },
    [sendMessage]
  );

  const reload = useCallback(
    async (chatRequestOptions?: { experimental_attachments?: Array<Attachment> }) => {
      await regenerate();
      return null;
    },
    [regenerate]
  );

  const isLoading = status === 'streaming';

  const currentMessageId = useMemo(() => {
    // Get the most recent assistant message ID for image/audio display
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop()
    return lastAssistantMessage?.id ?? null
  }, [messages]);

  // Check if narrator has responded
  const hasNarratorResponse = useMemo(() => {
    return messages.some(m => m.role === 'assistant');
  }, [messages]);

  // Story is ready when:
  // - Narrator has responded AND
  // - Audio is ready (signaled via stream data) OR audio is disabled
  const isStoryReady = useMemo(() => {
    if (!hasNarratorResponse) return false;
    if (!audioEnabled) return true;
    return audioReady;
  }, [hasNarratorResponse, audioEnabled, audioReady]);

  const handleBeginStory = useCallback(() => {
    setStoryBegun(true); // Enable audio autoplay
    setPhase('chat');    // Transition to chat interface
  }, [setStoryBegun]);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          user={user}
          isGuest={isGuest}
          pulseCount={pulseCount}
          maxPulses={maxPulses}
          storyTitle={phase !== 'overview' ? selectedStory?.title : undefined}
        />

        
      {/*
        Simple 3-phase layout (no race conditions):
        - 'overview': Story selection screen
        - 'loading': Black screen (modal covers this)
        - 'chat': Full chat interface
      */}
      {phase === 'overview' && (
        <Overview
          chatId={id}
          append={append}
          onSelectStory={handleStorySelection}
          user={user}
        />
      )}
      {phase === 'loading' && (
        <div className="flex-1 bg-black" />
      )}
      {phase === 'chat' && (
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={50}>
            <Messages
              chatId={id}
              isLoading={isLoading}
              messages={messages}
              storyId={selectedStoryId}
            />
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={50}>
            <div className="flex flex-col items-center justify-center h-full overflow-hidden">
              <StoryDisplay currentMessageId={currentMessageId} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

        

        {phase === 'chat' && !isReadonly && (
          <form
            className="flex mx-auto bg-background p-4 md:p-6 gap-2 w-full md:max-w-3xl"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
              disabled={disabled || guestLimitReached}
              disabledReason={guestLimitReached ? "Create an account to continue your adventure" : disabledReason}
            />
          </form>
        )}

      </div>

      {/* Soft Gate Modal for guests */}
      {showSoftGate && (
        <SoftGateModal
          onClose={() => setShowSoftGate(false)}
          pulseCount={pulseCount}
        />
      )}

      {/* Story Loading Modal - appears immediately on story selection */}
      <StoryLoadingModal
        isVisible={phase === 'loading'}
        isReady={isStoryReady}
        storyTitle={selectedStoryTitle}
        onBegin={handleBeginStory}
      />
    </>
  );
}
