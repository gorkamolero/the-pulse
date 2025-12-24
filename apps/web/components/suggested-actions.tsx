"use client";

import { motion } from "framer-motion";
import { Button } from "./ui/button";
import type { CreateUIMessage, UIMessage } from "ai";
import type { Attachment } from "@/lib/types/message";
import { memo } from "react";
import { stories } from "@pulse/core/ai/stories";

type ChatRequestOptions = {
  experimental_attachments?: Attachment[];
};

interface SuggestedActionsProps {
  chatId: string;
  append: (
    message: UIMessage | CreateUIMessage<UIMessage>,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  onSelectStory?: (storyId: string) => void;
}

function PureSuggestedActions({
  chatId,
  append,
  onSelectStory,
}: SuggestedActionsProps) {
  const storyActions = stories.map((story) => ({
    id: story.id,
    title: story.title,
    label: story.description,
    action: `Let's start the story "${story.title}".`,
  }));

  return (
    <div className="grid sm:grid-cols-2 gap-2 w-full">
      {storyActions.map((storyAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${storyAction.title}-${index}`}
          className={index > 1 ? "hidden sm:block" : "block"}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, "", `/pulse/${chatId}`);

              if (onSelectStory) {
                onSelectStory(storyAction.id);
              }

              append({
                role: "user",
                parts: [{ type: "text", text: storyAction.action }],
              });
            }}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto min-h-[120px] justify-start items-start"
          >
            <span className="font-medium w-full">{storyAction.title}</span>
            <span className="text-muted-foreground w-full break-words whitespace-normal">
              {storyAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
