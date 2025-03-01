"use client";

import type { Attachment, Message } from "ai";
import { useChat } from "ai/react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useSWRConfig } from "swr";

import { StoryDisplay } from "@/components/story-display";
import { ChatHeader } from "@/components/chat-header";
import { generateUUID } from "@/lib/utils";
import { DEFAULT_STORY_ID } from "@/lib/ai/stories";

import { Artifact } from "./artifact";
import { MultimodalInput } from "./multimodal-input";
import { Messages } from "./messages";
import type { VisibilityType } from "./visibility-selector";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { toast } from "sonner";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"


export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
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

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel, selectedStoryId, language },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate("/api/history");
    },
    onError: (error) => {
      toast.error(`An error occured, please try again! ${error}`);
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

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  const currentMessageId = useMemo(() => {
    // Start from the most recent message and work backwards
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop()
    return lastAssistantMessage?.id ?? null
  }, [messages]);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
          selectedStoryId={selectedStoryId}
          onSelectStory={handleStorySelection}
        />

        <ResizablePanelGroup direction="horizontal" className=" h-full" >

          <ResizablePanel  defaultSize={50}>
            <div className="overflow-y-scroll h-full">
            <Messages
              chatId={id}
              isLoading={isLoading}
              messages={messages}
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
              isArtifactVisible={isArtifactVisible}
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
        </ResizablePanelGroup>

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

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        isReadonly={isReadonly}
      />
    </>
  );
}
