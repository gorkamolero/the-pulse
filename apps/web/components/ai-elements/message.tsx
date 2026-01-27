"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";
import { createContext, useContext, memo } from "react";
import { motion } from "framer-motion";
import { Markdown } from "@/components/markdown";

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE CONTEXT
// Provides message metadata to child components
// ─────────────────────────────────────────────────────────────────────────────

interface MessageContextType {
  from: "user" | "assistant" | "system";
  isLast?: boolean;
}

const MessageContext = createContext<MessageContextType | null>(null);

export const useMessageContext = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("Message components must be used within Message");
  }
  return context;
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE
// Root component for a single message in the conversation
// ─────────────────────────────────────────────────────────────────────────────

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
  isLast?: boolean;
  animate?: boolean;
};

export const Message = ({
  className,
  from,
  isLast,
  animate = true,
  children,
  ...props
}: MessageProps) => {
  const content = (
    <MessageContext.Provider value={{ from, isLast }}>
      <div
        className={cn(
          "group flex w-full flex-col gap-2",
          // User messages align right, assistant left
          from === "user" && "is-user items-end",
          from === "assistant" && "is-assistant items-start",
          from === "system" && "is-system items-center",
          className
        )}
        data-role={from}
        {...props}
      >
        {children}
      </div>
    </MessageContext.Provider>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuad
      }}
    >
      {content}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE CONTENT
// Container for the message text/content with role-specific styling
// ─────────────────────────────────────────────────────────────────────────────

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  className,
  children,
  ...props
}: MessageContentProps) => {
  const { from } = useMessageContext();

  return (
    <div
      className={cn(
        "max-w-[90%] md:max-w-[85%]",
        // User messages: minimal, confident
        from === "user" &&
          "text-right text-foreground/90 font-medium",
        // Assistant messages: literary, immersive
        from === "assistant" &&
          "text-foreground/85 font-serif leading-[1.8] text-[1.05rem] tracking-[0.01em]",
        // System messages: subtle, informative
        from === "system" &&
          "text-center text-muted-foreground/60 text-sm italic",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE RESPONSE
// Renders markdown content with streaming support
// ─────────────────────────────────────────────────────────────────────────────

export type MessageResponseProps = {
  children: ReactNode;
  className?: string;
};

export const MessageResponse = memo(
  ({ children, className }: MessageResponseProps) => {
    const content = typeof children === "string" ? children : String(children);

    return (
      <div
        className={cn(
          // Prose styling for markdown
          "prose prose-sm md:prose-base dark:prose-invert max-w-none",
          // Literary styling
          "prose-p:leading-[1.8] prose-p:mb-4 prose-p:last:mb-0",
          "prose-p:text-foreground/85",
          // Emphasis styling
          "prose-em:text-foreground/70 prose-em:not-italic prose-em:font-light",
          "prose-strong:font-semibold prose-strong:text-foreground",
          // Quote styling for story narration
          "prose-blockquote:border-l-foreground/20 prose-blockquote:text-foreground/70",
          "prose-blockquote:italic prose-blockquote:font-serif",
          className
        )}
      >
        <Markdown>{content}</Markdown>
      </div>
    );
  },
  (prevProps, nextProps) => {
    const prevContent =
      typeof prevProps.children === "string"
        ? prevProps.children
        : String(prevProps.children);
    const nextContent =
      typeof nextProps.children === "string"
        ? nextProps.children
        : String(nextProps.children);
    return prevContent === nextContent;
  }
);

MessageResponse.displayName = "MessageResponse";

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE ACTIONS
// Container for action buttons below a message
// ─────────────────────────────────────────────────────────────────────────────

export type MessageActionsProps = HTMLAttributes<HTMLDivElement>;

export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => {
  const { from } = useMessageContext();

  return (
    <div
      className={cn(
        "flex items-center gap-1 mt-2",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
        from === "user" && "justify-end",
        from === "assistant" && "justify-start",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE TIMESTAMP
// Displays the time a message was sent
// ─────────────────────────────────────────────────────────────────────────────

export type MessageTimestampProps = HTMLAttributes<HTMLSpanElement> & {
  time: Date | string;
};

export const MessageTimestamp = ({
  className,
  time,
  ...props
}: MessageTimestampProps) => {
  const date = typeof time === "string" ? new Date(time) : time;
  const formatted = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <span
      className={cn(
        "text-[10px] text-muted-foreground/40",
        "opacity-0 group-hover:opacity-100 transition-opacity",
        className
      )}
      {...props}
    >
      {formatted}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE SYSTEM
// Special styling for system/narrator messages
// ─────────────────────────────────────────────────────────────────────────────

export type MessageSystemProps = HTMLAttributes<HTMLDivElement>;

export const MessageSystem = ({
  className,
  children,
  ...props
}: MessageSystemProps) => (
  <div
    className={cn(
      "text-center py-4 text-muted-foreground/50 text-sm font-serif italic",
      className
    )}
    role="status"
    {...props}
  >
    {children}
  </div>
);
