"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, RefObject } from "react";
import { createContext, useContext, useCallback, useState, useRef } from "react";

interface ScrollContextType {
  isAtBottom: boolean;
  scrollToBottom: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

const ScrollContext = createContext<ScrollContextType | null>(null);

const useScrollContext = () => {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error("Scroll components must be used within Conversation");
  }
  return context;
};

export type ConversationProps = HTMLAttributes<HTMLDivElement>;

export const Conversation = ({ className, children, ...props }: ConversationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
    }
  }, []);

  return (
    <ScrollContext.Provider value={{ isAtBottom, scrollToBottom, containerRef }}>
      <div
        ref={containerRef}
        className={cn("relative flex-1 overflow-y-auto", className)}
        onScroll={handleScroll}
        role="log"
        {...props}
      >
        {children}
      </div>
    </ScrollContext.Provider>
  );
};

export type ConversationContentProps = HTMLAttributes<HTMLDivElement>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <div className={cn("flex flex-col gap-8 p-4", className)} {...props} />
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useScrollContext();

  if (isAtBottom) return null;

  return (
    <Button
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full",
        className
      )}
      onClick={scrollToBottom}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};
