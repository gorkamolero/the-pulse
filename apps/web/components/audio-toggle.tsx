"use client";

import { useAtom } from "jotai";
import { audioEnabledAtom } from "@/lib/atoms";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Volume2, VolumeX } from "lucide-react";
import { memo } from "react";

function AudioToggleComponent() {
  const [audioEnabled, setAudioEnabled] = useAtom(audioEnabledAtom);

  const handleToggle = () => {
    setAudioEnabled(!audioEnabled);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className={`py-1 px-2 h-fit ${
            audioEnabled
              ? "bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900"
              : "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800"
          }`}
          variant="outline"
          onClick={handleToggle}
        >
          {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {audioEnabled ? "Disable audio narration" : "Enable audio narration"}
      </TooltipContent>
    </Tooltip>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
export const AudioToggle = memo(AudioToggleComponent);
