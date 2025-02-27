"use client";

import type { Attachment, Message } from "ai";
import { useChat } from "ai/react";
import { useState, useCallback, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";

import { ChatHeader } from "@/components/chat-header";
import type { Vote } from "@/lib/db/schema";
import { fetcher, generateUUID } from "@/lib/utils";
import { DEFAULT_STORY_ID } from "@/lib/ai/stories";

import { Artifact } from "./artifact";
import { MultimodalInput } from "./multimodal-input";
import { Messages } from "./messages";
import type { VisibilityType } from "./visibility-selector";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { toast } from "sonner";
import {
  AudioNarrationProvider,
  AutoNarrator,
  AudioNarrationControls,
  useAudioNarrationContext,
  VoiceSelector,
} from "./audio-narration";
import { AudioWave } from "./audio-narration/audio-wave";
import { Button } from "@/components/ui/button";
import { PauseIcon } from "lucide-react";
import { voices } from "./audio-narration/voice-selector";

// Audio status indicator component
function AudioStatusIndicator() {
  const { isPlaying, currentMessageId, stopSpeaking, voiceId } =
    useAudioNarrationContext();

  // Get the current voice name
  const currentVoice = voices.find((voice) => voice.id === voiceId);
  const voiceName = currentVoice?.name || "Audio";

  // Access the AudioManager directly to check queue status
  const hasQueuedMessages =
    typeof window !== "undefined" &&
    window.AudioManager &&
    window.AudioManager.pendingRequests &&
    window.AudioManager.pendingRequests.length > 0;

  if (!isPlaying && !hasQueuedMessages) return null;

  // Direct pause handler
  const handlePause = () => {
    console.log("Status indicator pause button clicked");

    // First try the stopSpeaking function from the context
    // This will ensure all state is properly updated
    stopSpeaking();

    // As a backup, also try direct methods if available
    if (typeof window !== "undefined" && window.AudioManager) {
      if (window.AudioManager.pausePlayback) {
        console.log("Using AudioManager.pausePlayback from status indicator");
        const paused = window.AudioManager.pausePlayback();
        console.log("Pause result:", paused);
      } else if (window.AudioManager.currentAudio) {
        // Fallback to direct pause
        console.log(
          "Directly pausing audio via window.AudioManager from status indicator"
        );
        window.AudioManager.currentAudio.pause();
        window.AudioManager.isPlaying = false;
      }

      // Also clear the queue to prevent further playback
      if (window.AudioManager.clearQueue) {
        window.AudioManager.clearQueue();
      }
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-3 py-2 rounded-full shadow-lg z-50 flex items-center gap-2">
      <AudioWave isPlaying={true} className="text-primary-foreground" />
      <span className="text-sm">
        {hasQueuedMessages && window.AudioManager
          ? `${voiceName} speaking (${window.AudioManager.pendingRequests.length} in queue)`
          : `${voiceName} speaking`}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="ml-2 p-1 size-6 rounded-full bg-primary-foreground/20 hover:bg-primary-foreground/30"
        onClick={handlePause}
      >
        <PauseIcon className="size-3 text-primary-foreground" />
      </Button>
    </div>
  );
}

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

  const { data: votes } = useSWR<Array<Vote>>(
    `/api/vote?chatId=${id}`,
    fetcher
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  return (
    <AudioNarrationProvider>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
          selectedStoryId={selectedStoryId}
          onSelectStory={handleStorySelection}
        >
          <div className="flex items-center gap-1">
            <VoiceSelector />
            <AudioNarrationControls />
          </div>
        </ChatHeader>

        <Messages
          chatId={id}
          isLoading={isLoading}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
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
        votes={votes}
        isReadonly={isReadonly}
      />

      {/* Audio status indicator */}
      <AudioStatusIndicator />

      {/* This component will automatically narrate new assistant messages */}
      <AutoNarrator messages={messages} />
    </AudioNarrationProvider>
  );
}
