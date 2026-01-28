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

import { StoryDisplay } from "@/components/story-display";
import { ChatHeader } from "@/components/chat-header";
import { getUIMessageContent } from "@/lib/utils";
import { DEFAULT_STORY_ID } from "@pulse/core/ai/stories";
import { useGuestSession } from "@/hooks/use-guest-session";
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
  const [language, setLanguage] = useState<string>("en");

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
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/pulse',
    body: isGuest ? {
      guestPulseCount: pulseCount,
      selectedStoryId,
      language,
    } : {
      selectedStoryId,
      language,
    },
  }), [isGuest, pulseCount, selectedStoryId, language]);

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
    // Track assistant responses for guest pulse counting
    onFinish: ({ message }) => {
      if (isGuest && message.role === 'assistant') {
        addGuestMessage({ role: 'assistant', content: '' });
      }
    },
  });

  const handleStorySelection = useCallback(
    async (storyId: string) => {
      setSelectedStoryId(storyId);

      // Only update the title if there are no messages yet (new chat)
      if (messages.length === 0) {
        // We don't need to update the title in the database here
        // as it will be set when the first message is sent
        mutate("/api/history");
      }
    },
    [messages.length, mutate]
  );

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

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          user={user}
          isGuest={isGuest}
          pulseCount={pulseCount}
          maxPulses={maxPulses}
        />

        
      {messages.length === 0 ? (
        <Overview
          chatId={id}
          append={append}
          onSelectStory={handleStorySelection}
          user={user}
        />
      ) : (<ResizablePanelGroup direction="horizontal" className=" h-full" >
          <ResizablePanel  defaultSize={50}>
            <Messages
              chatId={id}
              isLoading={isLoading}
              messages={messages}
              storyId={selectedStoryId}
            />
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={50}>
            <div className='flex flex-col items-center justify-center h-full overflow-hidden'>
              <StoryDisplay currentMessageId={currentMessageId} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>)}

        

        {messages.length > 0 && !isReadonly && (
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

        {/* Guest pulse progress bar */}
        {isGuest && messages.length > 0 && (
          <div className="mx-auto max-w-3xl w-full px-4 pb-4">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground/30 transition-all duration-300"
                style={{ width: `${(pulseCount / maxPulses) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground/60 mt-1 text-center">
              {pulseCount < maxPulses
                ? `${maxPulses - pulseCount} free pulses remaining`
                : "Create an account to continue your adventure"}
            </p>
          </div>
        )}
      </div>

      {/* Soft Gate Modal for guests */}
      {showSoftGate && (
        <SoftGateModal
          onClose={() => setShowSoftGate(false)}
          pulseCount={pulseCount}
        />
      )}
    </>
  );
}
