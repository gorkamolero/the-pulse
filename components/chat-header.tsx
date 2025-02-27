"use client";
import { useRouter } from "next/navigation";
import { useWindowSize } from "usehooks-ts";
import { useAtom } from "jotai";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { PlusIcon, BrainIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";
import { memo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import type { VisibilityType } from "./visibility-selector";
import { StorySelector } from "@/components/story-selector";
import { DEFAULT_STORY_ID } from "@/lib/ai/stories";
import { showReasoningAtom } from "../lib/atoms";
import { XIcon } from "lucide-react";

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
  selectedStoryId = DEFAULT_STORY_ID,
  onSelectStory,
  children,
}: {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  selectedStoryId?: string;
  onSelectStory?: (storyId: string) => void;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const [showReasoning, setShowReasoning] = useAtom(showReasoningAtom);

  const { width: windowWidth } = useWindowSize();

  return (
    <header className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2">
      <SidebarToggle />

      {(!open || windowWidth < 768) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-2 md:order-1 md:px-2 px-2 md:h-fit ml-auto md:ml-0"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
            >
              <PlusIcon />
              <span className="md:sr-only">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      )}

      {/* {!isReadonly && (
        <ModelSelector
          selectedModelId={selectedModelId}
          className="order-1 md:order-2"
        />
      )} */}

      {!isReadonly && onSelectStory && (
        <StorySelector
          selectedStoryId={selectedStoryId}
          onSelectStory={onSelectStory}
          className="order-1 md:order-3"
        />
      )}

      {/*  {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
          className="order-1 md:order-4"
        />
      )} */}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className={`${
              showReasoning
                ? "bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900"
                : "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800"
            } order-5 md:ml-auto`}
            onClick={() => setShowReasoning(!showReasoning)}
            size="icon"
          >
            {showReasoning ? <XIcon size={16} /> : <BrainIcon size={16} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {showReasoning ? "Collapse AI reasoning" : "Expand AI reasoning"}
        </TooltipContent>
      </Tooltip>

      {children}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.selectedStoryId === nextProps.selectedStoryId &&
    prevProps.children === nextProps.children
  );
});
