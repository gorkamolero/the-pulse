"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PlayerChatMessage } from "@/lib/multiplayer/types";
import { cn } from "@/lib/utils";

const fadeIn = { opacity: 0 };
const fadeInVisible = { opacity: 1 };
const slideUp = { opacity: 0, y: 10 };
const slideUpVisible = { opacity: 1, y: 0 };

const SendIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
);

interface PlayerChatProps {
  messages: PlayerChatMessage[];
  onSendMessage: (content: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  currentPlayerId: string;
  className?: string;
}

const ChatMessage = memo(function ChatMessage({
  msg,
  isOwn,
  showName,
}: {
  msg: PlayerChatMessage;
  isOwn: boolean;
  showName: boolean;
}) {
  return (
    <motion.div
      initial={slideUp}
      animate={slideUpVisible}
      transition={{ duration: 0.2 }}
      className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}
    >
      {/* Sender name - only show when sender changes */}
      {showName ? (
        <span
          className={cn(
            "text-[10px] mb-1 tracking-wide",
            isOwn ? "text-muted-foreground/50" : "text-muted-foreground/60"
          )}
        >
          {isOwn ? "you" : msg.fromName?.toLowerCase()}
        </span>
      ) : null}

      {/* Message bubble */}
      <div
        className={cn(
          "px-3 py-2 rounded-sm max-w-[85%] text-sm leading-relaxed",
          isOwn
            ? "bg-foreground/10 text-foreground/90"
            : "bg-muted/50 text-foreground/80 border-l-2 border-muted-foreground/20"
        )}
      >
        {msg.content}
      </div>
    </motion.div>
  );
});

const EmptyState = (
  <motion.div
    initial={fadeIn}
    animate={fadeInVisible}
    className="h-full flex flex-col items-center justify-center text-center py-8"
  >
    <p className="text-xs text-muted-foreground/40 italic max-w-[200px]">
      Confer with your companions here. The narrator cannot hear these whispers.
    </p>
  </motion.div>
);

export function PlayerChat({
  messages,
  onSendMessage,
  onTypingChange,
  currentPlayerId,
  className,
}: PlayerChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const messagesLength = messages.length;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesLength]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      onTypingChange?.(true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        onTypingChange?.(false);
      }, 1000);
    },
    [onTypingChange]
  );

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;

    onSendMessage(input.trim());
    setInput("");
    onTypingChange?.(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [input, onSendMessage, onTypingChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const hasInput = input.trim().length > 0;

  return (
    <div className={cn("flex flex-col h-full bg-background/50", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-muted-foreground/10">
        <h3 className="font-serif text-sm tracking-wide">Party Whispers</h3>
        <p className="text-[10px] text-muted-foreground/50 italic mt-0.5">
          Hidden from the narrator
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            EmptyState
          ) : (
            messages.map((msg, index) => {
              const isOwn = msg.from === currentPlayerId;
              const showName =
                index === 0 || messages[index - 1]?.from !== msg.from;

              return (
                <ChatMessage
                  key={msg.id}
                  msg={msg}
                  isOwn={isOwn}
                  showName={showName}
                />
              );
            })
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-muted-foreground/10">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Whisper to your party..."
            className="min-h-[38px] max-h-[100px] resize-none text-sm bg-transparent border-muted-foreground/20 focus:border-foreground/30 placeholder:text-muted-foreground/30 placeholder:italic"
            rows={1}
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!hasInput}
            size="sm"
            variant="ghost"
            className={cn(
              "shrink-0 h-[38px] px-3 transition-all",
              hasInput
                ? "text-foreground/80 hover:text-foreground"
                : "text-muted-foreground/30"
            )}
          >
            {SendIcon}
          </Button>
        </div>
      </div>
    </div>
  );
}
