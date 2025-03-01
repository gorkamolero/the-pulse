"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stories } from "@/lib/ai/stories";
import { cn } from "@/lib/utils";

import { CheckCircleFillIcon, ChevronDownIcon } from "./icons";

export function StorySelector({
  selectedStoryId,
  onSelectStory,
  className,
}: {
  selectedStoryId: string;
  onSelectStory: (storyId: string) => void;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);

  // Load the story preference from cookies on component mount
  useEffect(() => {
    const storyCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("selectedStory="));

    if (storyCookie) {
      const storyId = storyCookie.split("=")[1];
      if (storyId !== selectedStoryId) {
        onSelectStory(storyId);
      }
    }
  }, [selectedStoryId, onSelectStory]);

  // Save story selection to cookie
  const handleSelectStory = useCallback((storyId: string) => {
    // Set a cookie to remember the story preference
    document.cookie = `selectedStory=${storyId}; path=/; max-age=31536000`; // 1 year
    onSelectStory(storyId);
    
    // Find the selected story to display its title in the toast
    const story = stories.find(s => s.id === storyId);
    if (story) {
      toast.success(`Story selected: "${story.title}"`);
    }
  }, [onSelectStory]);

  const selectedStory = useMemo(
    () => stories.find((story) => story.id === selectedStoryId),
    [selectedStoryId]
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          "w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
          className
        )}
      >
        <Button variant="outline" className="md:px-2 md:h-[34px]">
          {selectedStory?.title || "Select a story"}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[300px]">
        {stories.map((story) => {
          const { id } = story;

          return (
            <DropdownMenuItem
              key={id}
              onSelect={() => {
                setOpen(false);
                handleSelectStory(id);
              }}
              className="gap-4 group/item flex flex-row justify-between items-center"
              data-active={id === selectedStoryId}
            >
              <div className="flex flex-col gap-1 items-start">
                <div>{story.title}</div>
                <div className="text-xs text-muted-foreground">
                  {story.description}
                </div>
              </div>

              <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                <CheckCircleFillIcon />
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
