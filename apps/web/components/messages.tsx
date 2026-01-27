"use client";

import type { UIMessage } from "ai";
import { memo } from "react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { Play, Pause, Loader2 } from "lucide-react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { getUIMessageContent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useMessage } from "@/hooks/use-message";
import { useAtom } from "jotai";
import { audioEnabledAtom } from "@/lib/atoms";
import { useState, useRef, useEffect } from "react";

interface MessagesProps {
  chatId: string;
  isLoading: boolean;
  storyId: string;
  messages: Array<UIMessage>;
}

// Simple inline audio button for messages
function NarrationButton({
  messageId,
  autoplay,
}: {
  messageId: string;
  autoplay?: boolean;
}) {
  const [audioEnabled] = useAtom(audioEnabledAtom);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoplayedRef = useRef(false);

  const { message, isGeneratingAudio } = useMessage(messageId);
  const audioUrl = message?.audioUrl;

  // Autoplay when audio becomes available
  useEffect(() => {
    if (autoplay && audioEnabled && audioUrl && !isPlaying && !hasAutoplayedRef.current) {
      hasAutoplayedRef.current = true;
      playAudio();
    }
  }, [autoplay, audioUrl, audioEnabled]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playAudio = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (!audioUrl) return;

    try {
      setIsLoading(true);
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
      } else {
        audioRef.current.src = audioUrl;
      }
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing audio:", error);
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
      className="h-7 px-2 text-xs text-muted-foreground/60 hover:text-muted-foreground"
    >
      {isLoading || showGenerating ? (
        <Loader2 size={12} className="animate-spin mr-1" />
      ) : isPlaying ? (
        <Pause size={12} className="mr-1" />
      ) : (
        <Play size={12} className="mr-1" />
      )}
      {showGenerating ? "Generating..." : isPlaying ? "Pause" : "Listen"}
    </Button>
  );
}

// Thinking indicator
function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4"
    >
      <Message from="assistant">
        <MessageContent>
          <div className="flex items-center gap-2 text-muted-foreground/60 font-serif italic">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
            >
              The story awaits...
            </motion.span>
          </div>
        </MessageContent>
      </Message>
    </motion.div>
  );
}

function PureMessages({ chatId, isLoading, messages }: MessagesProps) {
  const lastAssistantMessage = messages.filter((m) => m.role === "assistant").pop();

  return (
    <Conversation className="h-full">
      <ConversationContent className="gap-6 px-4 py-6 max-w-3xl mx-auto">
        {messages.map((message) => {
          const content = getUIMessageContent(message);
          const isLastAssistant =
            lastAssistantMessage &&
            message.id === lastAssistantMessage.id;

          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Message from={message.role}>
                <MessageContent
                  className={cn(
                    message.role === "user" && "font-medium",
                    message.role === "assistant" && "font-serif leading-relaxed text-base"
                  )}
                >
                  {message.role === "assistant" ? (
                    <MessageResponse>{content}</MessageResponse>
                  ) : (
                    <span>{content}</span>
                  )}
                </MessageContent>

                {message.role === "assistant" && (
                  <div className="mt-2">
                    <NarrationButton
                      messageId={message.id}
                      autoplay={isLastAssistant}
                    />
                  </div>
                )}
              </Message>
            </motion.div>
          );
        })}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && <ThinkingIndicator />}
      </ConversationContent>
    </Conversation>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isLoading && nextProps.isLoading) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  return true;
});
