"use client";

import type { UIMessage } from "ai";
import { memo, useState, useRef, useEffect } from "react";
import equal from "fast-deep-equal";
import { Pause, Loader2, Volume2 } from "lucide-react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence } from "framer-motion";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  ThinkingIndicator,
} from "@/components/ai-elements";
import { Button } from "@/components/ui/button";
import { getUIMessageContent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useMessage } from "@/hooks/use-message";
import {
  audioEnabledAtom,
  audioElementAtom,
  audioPlayingAtom,
  narratorStateAtom,
  storyBegunAtom,
} from "@/lib/atoms";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface MessagesProps {
  chatId: string;
  isLoading: boolean;
  storyId: string;
  messages: Array<UIMessage>;
}

// ─────────────────────────────────────────────────────────────────────────────
// NARRATION BUTTON
// Inline audio playback control for assistant messages
// ─────────────────────────────────────────────────────────────────────────────

function NarrationButton({
  messageId,
  autoplay,
}: {
  messageId: string;
  autoplay?: boolean;
}) {
  const [audioEnabled] = useAtom(audioEnabledAtom);
  const [storyBegun] = useAtom(storyBegunAtom);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoplayedRef = useRef(false);

  // Global audio state for Orb visualization
  const setAudioElement = useSetAtom(audioElementAtom);
  const setAudioPlaying = useSetAtom(audioPlayingAtom);
  const setNarratorState = useSetAtom(narratorStateAtom);

  const { message, isGeneratingAudio } = useMessage(messageId);
  const audioUrl = message?.audioUrl;

  // Autoplay when audio becomes available AND story has begun (user clicked "Begin")
  useEffect(() => {
    if (
      autoplay &&
      audioEnabled &&
      storyBegun && // Wait for user to dismiss loading modal
      audioUrl &&
      !isPlaying &&
      !hasAutoplayedRef.current
    ) {
      hasAutoplayedRef.current = true;
      playAudio();
    }
  }, [autoplay, audioUrl, audioEnabled, storyBegun]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        setAudioPlaying(false);
        setNarratorState(null);
        audioRef.current = null;
      }
    };
  }, [setAudioPlaying, setNarratorState]);

  const playAudio = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setAudioPlaying(false);
      setNarratorState(null);
      return;
    }

    if (!audioUrl) return;

    try {
      setIsLoading(true);

      // Proxy audio through our API to enable CORS for Web Audio analysis
      const proxyUrl = `/api/audio-proxy?url=${encodeURIComponent(audioUrl)}`;

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.crossOrigin = "anonymous";
        audioRef.current.src = proxyUrl;
        audioRef.current.onended = () => {
          setIsPlaying(false);
          setAudioPlaying(false);
          setNarratorState(null);
        };
        // Share audio element for Orb visualization
        setAudioElement(audioRef.current);
      } else {
        audioRef.current.src = proxyUrl;
      }
      await audioRef.current.play();
      setIsPlaying(true);
      setAudioPlaying(true);
      setNarratorState("talking");
    } catch (error) {
      console.error("Error playing audio:", error);
      setAudioPlaying(false);
      setNarratorState(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!audioEnabled) return null;

  const showGenerating = isGeneratingAudio && !audioUrl;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={playAudio}
      disabled={isLoading || showGenerating || !audioUrl}
      className={cn(
        "h-7 px-2 gap-1.5 text-xs rounded-full",
        "text-muted-foreground/50 hover:text-muted-foreground/80",
        "transition-all duration-200",
        isPlaying && "text-foreground/70 bg-foreground/5"
      )}
    >
      {isLoading || showGenerating ? (
        <Loader2 size={12} className="animate-spin" />
      ) : isPlaying ? (
        <Pause size={12} />
      ) : (
        <Volume2 size={12} />
      )}
      <span className="font-serif italic">
        {showGenerating ? "Conjuring voice..." : isPlaying ? "Pause" : "Listen"}
      </span>
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE MESSAGES
// The main messages container component
// ─────────────────────────────────────────────────────────────────────────────

function PureMessages({ chatId, isLoading, messages }: MessagesProps) {
  const setNarratorState = useSetAtom(narratorStateAtom);
  const storyBegun = useAtomValue(storyBegunAtom);

  // Filter out system messages like "Let's start the story"
  const visibleMessages = messages.filter((m) => {
    if (m.role === "user") {
      const content = getUIMessageContent(m);
      if (content.toLowerCase().includes("let's start the story")) {
        return false;
      }
    }
    return true;
  });

  const lastAssistantMessage = visibleMessages
    .filter((m) => m.role === "assistant")
    .pop();

  // Use original messages (not filtered) for thinking indicator
  // since hidden messages like "Let's start the story" still need thinking shown
  const showThinking =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "user";

  // Update global narrator state for Orb visualization
  useEffect(() => {
    if (showThinking) {
      setNarratorState("thinking");
    }
    // Note: Don't reset to null here - let audio playback handle that
  }, [showThinking, setNarratorState]);

  return (
    <Conversation className="h-full relative">
      <ConversationContent className="gap-8 px-4 py-8 max-w-3xl mx-auto">
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((message) => {
            const content = getUIMessageContent(message);
            const isLastAssistant =
              lastAssistantMessage && message.id === lastAssistantMessage.id;

            return (
              <Message
                key={message.id}
                from={message.role}
                isLast={isLastAssistant}
              >
                <MessageContent
                  className={cn(
                    message.role === "user" &&
                      "bg-secondary/50 px-4 py-3 rounded-2xl rounded-tr-sm"
                  )}
                >
                  {message.role === "assistant" ? (
                    <MessageResponse>{content}</MessageResponse>
                  ) : (
                    <span className="text-sm">{content}</span>
                  )}
                </MessageContent>

                {message.role === "assistant" && (
                  <MessageActions>
                    <NarrationButton
                      messageId={message.id}
                      autoplay={isLastAssistant && storyBegun}
                    />
                  </MessageActions>
                )}
              </Message>
            );
          })}

          {showThinking && (
            <Message from="assistant" key="thinking">
              <MessageContent>
                <ThinkingIndicator />
              </MessageContent>
            </Message>
          )}
        </AnimatePresence>
      </ConversationContent>

      <ConversationScrollButton />
    </Conversation>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MEMOIZED EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isLoading && nextProps.isLoading) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  return true;
});
