"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes, KeyboardEvent, ChangeEvent } from "react";
import { forwardRef, useRef, useCallback, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SendHorizonal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT INPUT
// Main container for the story prompt input
// ─────────────────────────────────────────────────────────────────────────────

export type PromptInputProps = HTMLAttributes<HTMLDivElement>;

export const PromptInput = ({ className, children, ...props }: PromptInputProps) => (
  <div
    className={cn(
      "flex flex-col gap-2 w-full",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT TEXTAREA
// Auto-resizing textarea for story input
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxRows?: number;
  className?: string;
}

export const PromptTextarea = forwardRef<HTMLTextAreaElement, PromptTextareaProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      placeholder = "What do you do?",
      disabled = false,
      maxRows = 6,
      className,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

    const handleChange = useCallback(
      (e: ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);

        // Auto-resize
        const textarea = e.target;
        textarea.style.height = "auto";
        const lineHeight = 24; // Approximate line height
        const maxHeight = lineHeight * maxRows;
        textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
      },
      [onChange, maxRows]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit?.();
        }
      },
      [onSubmit]
    );

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          "w-full resize-none bg-transparent text-foreground",
          "placeholder:text-muted-foreground/50",
          "focus:outline-none",
          "text-base leading-6",
          // Literary feel
          "font-serif",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        aria-label="Your response"
      />
    );
  }
);

PromptTextarea.displayName = "PromptTextarea";

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT ACTIONS
// Container for action buttons (send, stop, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export type PromptActionsProps = HTMLAttributes<HTMLDivElement>;

export const PromptActions = ({
  className,
  children,
  ...props
}: PromptActionsProps) => (
  <div
    className={cn("flex items-center gap-2", className)}
    {...props}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT SEND BUTTON
// Animated send button with loading/stop states
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptSendButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  onStop?: () => void;
  className?: string;
}

export const PromptSendButton = ({
  onClick,
  disabled = false,
  isLoading = false,
  onStop,
  className,
}: PromptSendButtonProps) => {
  const handleClick = useCallback(() => {
    if (isLoading && onStop) {
      onStop();
    } else if (!isLoading && onClick) {
      onClick();
    }
  }, [isLoading, onClick, onStop]);

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={disabled && !isLoading}
      variant="ghost"
      size="icon"
      className={cn(
        "h-9 w-9 shrink-0 rounded-full",
        "transition-all duration-200",
        !disabled && !isLoading && "hover:bg-foreground/5",
        isLoading && "text-destructive hover:bg-destructive/10",
        className
      )}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="stop"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <Square className="size-4 fill-current" />
          </motion.div>
        ) : (
          <motion.div
            key="send"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <SendHorizonal className="size-4" />
          </motion.div>
        )}
      </AnimatePresence>
      <span className="sr-only">{isLoading ? "Stop" : "Send"}</span>
    </Button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT CONTAINER
// Pre-styled container with border and background
// ─────────────────────────────────────────────────────────────────────────────

export type PromptContainerProps = HTMLAttributes<HTMLDivElement> & {
  focused?: boolean;
};

export const PromptContainer = ({
  className,
  focused,
  children,
  ...props
}: PromptContainerProps) => (
  <div
    className={cn(
      "flex items-end gap-3 p-3 rounded-xl",
      "border border-border/50 bg-background/50 backdrop-blur-sm",
      "transition-all duration-200",
      "focus-within:border-border focus-within:bg-background/80",
      focused && "border-border bg-background/80",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT HINT
// Helper text below the input
// ─────────────────────────────────────────────────────────────────────────────

export type PromptHintProps = HTMLAttributes<HTMLParagraphElement>;

export const PromptHint = ({ className, children, ...props }: PromptHintProps) => (
  <p
    className={cn(
      "text-xs text-muted-foreground/40 text-center",
      className
    )}
    {...props}
  >
    {children}
  </p>
);
