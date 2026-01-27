"use client";

import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, RefObject } from "react";
import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// SCROLL CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

interface ScrollContextType {
  isAtBottom: boolean;
  scrollToBottom: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

const ScrollContext = createContext<ScrollContextType | null>(null);

export const useScrollContext = () => {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error("Scroll components must be used within Conversation");
  }
  return context;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION
// Main container for the chat conversation with auto-scroll
// ─────────────────────────────────────────────────────────────────────────────

export type ConversationProps = HTMLAttributes<HTMLDivElement> & {
  autoScroll?: boolean;
};

export const Conversation = ({
  className,
  children,
  autoScroll = true,
  ...props
}: ConversationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
      setUserHasScrolled(false);
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);

      // If user scrolls up, mark as user-initiated scroll
      if (!atBottom) {
        setUserHasScrolled(true);
      }
    }
  }, []);

  // Auto-scroll on content change if at bottom or auto-scroll enabled
  useEffect(() => {
    if (autoScroll && isAtBottom && !userHasScrolled) {
      scrollToBottom("instant");
    }
  }, [children, autoScroll, isAtBottom, userHasScrolled, scrollToBottom]);

  return (
    <ScrollContext.Provider
      value={{ isAtBottom, scrollToBottom, containerRef }}
    >
      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 overflow-y-auto scroll-smooth",
          // Atmospheric scrollbar styling
          "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20",
          className
        )}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        {...props}
      >
        {children}
      </div>
    </ScrollContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION CONTENT
// Inner content wrapper with proper spacing
// ─────────────────────────────────────────────────────────────────────────────

export type ConversationContentProps = HTMLAttributes<HTMLDivElement>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <div
    className={cn(
      "flex flex-col gap-8 p-4 md:p-6",
      "pb-32", // Extra padding at bottom for input overlay
      className
    )}
    {...props}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION SCROLL ANCHOR
// Invisible element that gets scrolled into view
// ─────────────────────────────────────────────────────────────────────────────

export const ConversationScrollAnchor = () => {
  const { containerRef, isAtBottom } = useScrollContext();
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAtBottom && anchorRef.current) {
      anchorRef.current.scrollIntoView({ behavior: "instant" });
    }
  }, [isAtBottom]);

  return <div ref={anchorRef} className="h-px w-full" aria-hidden="true" />;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION SCROLL BUTTON
// Floating button to scroll to bottom when not at bottom
// ─────────────────────────────────────────────────────────────────────────────

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useScrollContext();

  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10"
        >
          <Button
            className={cn(
              "rounded-full shadow-lg",
              "bg-background/80 backdrop-blur-sm border border-border/50",
              "hover:bg-background hover:scale-105",
              "transition-transform",
              className
            )}
            onClick={() => scrollToBottom()}
            size="icon"
            type="button"
            variant="outline"
            {...props}
          >
            <ArrowDownIcon className="size-4" />
            <span className="sr-only">Scroll to bottom</span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION DIVIDER
// Visual separator between message groups or sections
// ─────────────────────────────────────────────────────────────────────────────

export type ConversationDividerProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
};

export const ConversationDivider = ({
  className,
  label,
  ...props
}: ConversationDividerProps) => (
  <div
    className={cn(
      "flex items-center gap-4 py-4",
      className
    )}
    role="separator"
    {...props}
  >
    <div className="flex-1 h-px bg-border/30" />
    {label && (
      <span className="text-xs text-muted-foreground/50 font-serif italic">
        {label}
      </span>
    )}
    <div className="flex-1 h-px bg-border/30" />
  </div>
);
