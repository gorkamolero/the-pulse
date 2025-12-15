"use client";

import type { UIMessage, CreateUIMessage } from "ai";
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
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  user?: {
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
}) {
  const { mutate } = useSWRConfig();
  const [selectedStoryId, setSelectedStoryId] = useState(DEFAULT_STORY_ID);
  const [language, setLanguage] = useState<string>("en");

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

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
  } = useChat({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
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
    // Start from the most recent message and work backwards
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop()
    return lastAssistantMessage?.id ?? null
  }, [messages]);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          user={user}
          chatId={id}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
          selectedStoryId={selectedStoryId}
          onSelectStory={handleStorySelection}
        />

        
      {messages.length === 0 ? <Overview /> : (<ResizablePanelGroup direction="horizontal" className=" h-full" >
          <ResizablePanel  defaultSize={50}>
            <div className="overflow-y-scroll h-full">
            <Messages
              chatId={id}
              isLoading={isLoading}
              messages={messages}
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
              storyId={selectedStoryId}
            />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={50}>
            <div className='flex flex-col items-center justify-center h-full'>
              <StoryDisplay currentMessageId={currentMessageId} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>)}

        

        <form 
          className="flex mx-auto bg-background p-4 md:p-6 gap-2 w-full md:max-w-3xl"
          onSubmit={(e) => {
            // Prevent default form submission
            e.preventDefault();
          }}
        >
          {!isReadonly && (
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
              onSelectStory={handleStorySelection}
            />
          )}
        </form>
      </div>
    </>
  );
}
