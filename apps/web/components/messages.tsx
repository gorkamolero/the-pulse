"use client";

import type { UIMessage } from "ai";
import { memo, useCallback, useState, useRef, useEffect } from "react";
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
import { getValidWordTimings, TimedNarration } from "@/components/timed-narration";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface MessagesProps {
  chatId: string;
  isLoading: boolean;
  storyId: string;
  messages: Array<UIMessage>;
  setupMode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// NARRATION BUTTON
// Inline audio playback control for assistant messages
// ─────────────────────────────────────────────────────────────────────────────

function NarrationButton({
  messageId,
  autoplay,
  onPlaybackTimeChange,
}: {
  messageId: string;
  autoplay?: boolean;
  onPlaybackTimeChange?: (timeMs: number) => void;
}) {
  const [audioEnabled] = useAtom(audioEnabledAtom);
  const [storyBegun] = useAtom(storyBegunAtom);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoplayedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const activeTimingKeyRef = useRef<string | null>(null);

  // Global audio state for Orb visualization
  const setAudioElement = useSetAtom(audioElementAtom);
  const setAudioPlaying = useSetAtom(audioPlayingAtom);
  const setNarratorState = useSetAtom(narratorStateAtom);

  const {
    message,
    isGeneratingAudio,
    isAudioUnavailable,
    updateMessage,
  } = useMessage(messageId);
  const audioUrl = message?.audioUrl;
  const wordTimings = getValidWordTimings(message.wordTimings);
  const [isRetryingAudio, setIsRetryingAudio] = useState(false);
  const hasRetriedAudioRef = useRef(false);

  const stopPlaybackClock = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const startPlaybackClock = useCallback(() => {
    stopPlaybackClock();

    const tick = () => {
      if (audioRef.current) {
        const currentTimeMs = audioRef.current.currentTime * 1000;
        const activeTiming = wordTimings.find(
          (timing) => timing.startMs <= currentTimeMs && currentTimeMs < timing.endMs
        );
        const activeTimingKey = activeTiming
          ? `${activeTiming.startChar}-${activeTiming.endChar}`
          : null;

        if (activeTimingKeyRef.current !== activeTimingKey) {
          activeTimingKeyRef.current = activeTimingKey;
          onPlaybackTimeChange?.(activeTiming ? currentTimeMs : -1);
        }
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, [onPlaybackTimeChange, stopPlaybackClock, wordTimings]);

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
      stopPlaybackClock();
      if (audioRef.current) {
        audioRef.current.pause();
        setAudioPlaying(false);
        setNarratorState(null);
        audioRef.current = null;
      }
    };
  }, [setAudioPlaying, setNarratorState, stopPlaybackClock]);

  const playAudio = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setAudioPlaying(false);
      setNarratorState(null);
      stopPlaybackClock();
      activeTimingKeyRef.current = null;
      onPlaybackTimeChange?.(-1);
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
          stopPlaybackClock();
          activeTimingKeyRef.current = null;
          onPlaybackTimeChange?.(-1);
        };
        audioRef.current.onpause = () => {
          if (audioRef.current?.ended) return;
          stopPlaybackClock();
          activeTimingKeyRef.current = null;
          onPlaybackTimeChange?.(-1);
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
      startPlaybackClock();
    } catch (error) {
      console.error("Error playing audio:", error);
      setAudioPlaying(false);
      setNarratorState(null);
      stopPlaybackClock();
      activeTimingKeyRef.current = null;
      onPlaybackTimeChange?.(-1);
    } finally {
      setIsLoading(false);
    }
  };

  const retryAudio = useCallback(async () => {
    if (!messageId || isRetryingAudio) return;

    try {
      setIsRetryingAudio(true);
      const response = await fetch(`/api/messages/${messageId}/audio`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to regenerate audio");
      }

      const data = (await response.json()) as { audioUrl?: string; wordTimings?: unknown };
      if (data.audioUrl) {
        updateMessage((currentMessage) => ({
          ...currentMessage,
          audioUrl: data.audioUrl ?? currentMessage.audioUrl,
          wordTimings: data.wordTimings ?? currentMessage.wordTimings,
        }));
      }
    } catch (error) {
      console.error("Error regenerating audio:", error);
    } finally {
      setIsRetryingAudio(false);
    }
  }, [isRetryingAudio, messageId, updateMessage]);

  useEffect(() => {
    if (!isAudioUnavailable || hasRetriedAudioRef.current) return;
    hasRetriedAudioRef.current = true;
    retryAudio();
  }, [isAudioUnavailable, retryAudio]);

  if (!audioEnabled) return null;

  const showGenerating = (isGeneratingAudio || isRetryingAudio) && !audioUrl;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={isAudioUnavailable ? retryAudio : playAudio}
      disabled={isLoading || showGenerating || (!audioUrl && !isAudioUnavailable)}
      className={cn(
        "h-9 min-w-10 px-3 gap-2 text-sm rounded-full",
        "text-foreground/70 hover:text-foreground/90",
        "transition-colors duration-200",
        "disabled:text-foreground/55 disabled:opacity-100",
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
        {showGenerating
          ? "Conjuring voice..."
          : isAudioUnavailable
            ? "Retry voice"
            : isPlaying
              ? "Pause"
              : "Listen"}
      </span>
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE MESSAGES
// The main messages container component
// ─────────────────────────────────────────────────────────────────────────────

function VisibleMessage({
  autoplay,
  content,
  isLastAssistant,
  messageId,
  role,
  setupMode,
}: {
  autoplay: boolean;
  content: string;
  isLastAssistant: boolean;
  messageId: string;
  role: UIMessage["role"];
  setupMode: boolean;
}) {
  const [playbackTimeMs, setPlaybackTimeMs] = useState(-1);
  const { message: storedMessage } = useMessage(role === "assistant" ? messageId : null);
  const wordTimings = getValidWordTimings(storedMessage.wordTimings);

  const handlePlaybackTimeChange = useCallback(
    (timeMs: number) => {
      setPlaybackTimeMs(timeMs);
    },
    []
  );

  return (
    <Message
      from={role}
      isLast={isLastAssistant}
      className={setupMode ? "items-center" : undefined}
    >
      <MessageContent
        className={cn(
          role === "user" &&
            "bg-secondary/50 px-4 py-3 rounded-2xl rounded-tr-sm",
          setupMode && role === "assistant" && "text-center"
        )}
      >
        {role === "assistant" ? (
          wordTimings.length > 0 ? (
            <TimedNarration
              currentTimeMs={playbackTimeMs}
              text={content}
              wordTimings={wordTimings}
            />
          ) : (
            <MessageResponse>{content}</MessageResponse>
          )
        ) : (
          <span className="text-sm">{content}</span>
        )}
      </MessageContent>

      {role === "assistant" && (
        <MessageActions>
          <NarrationButton
            autoplay={autoplay}
            messageId={messageId}
            onPlaybackTimeChange={handlePlaybackTimeChange}
          />
        </MessageActions>
      )}
    </Message>
  );
}

function PureMessages({ chatId, isLoading, messages, setupMode = false }: MessagesProps) {
  const setNarratorState = useSetAtom(narratorStateAtom);
  const storyBegun = useAtomValue(storyBegunAtom);

  // Filter out system messages like "Let's start the story"
  const visibleMessages = messages.filter((m) => {
    if (m.role === "user") {
      const content = getUIMessageContent(m);
      const normalizedContent = content.toLowerCase();
      if (
        normalizedContent.includes("let's start the story") ||
        normalizedContent.includes("let's start the group session")
      ) {
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
    <Conversation className="h-full relative z-10">
      <ConversationContent
        className={cn(
          "gap-8 px-5 py-10 md:px-8 md:py-12 mx-auto",
          setupMode
            ? "min-h-full max-w-2xl justify-center pb-36 text-center"
            : "max-w-3xl"
        )}
      >
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((message) => {
            const content = getUIMessageContent(message);
            const isLastAssistant =
              lastAssistantMessage && message.id === lastAssistantMessage.id;

            return (
              <VisibleMessage
                autoplay={Boolean(isLastAssistant && storyBegun)}
                content={content}
                isLastAssistant={Boolean(isLastAssistant)}
                key={message.id}
                messageId={message.id}
                role={message.role}
                setupMode={setupMode}
              />
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
