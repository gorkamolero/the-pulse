"use client";

import { useAudioNarrationContext } from "./context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Volume2Icon, VolumeXIcon, PauseCircleIcon } from "lucide-react";
import { AudioWave } from "./audio-wave";

export function AudioNarrationControls() {
  const { isPlaying, autoPlay, toggleAutoPlay, stopSpeaking } =
    useAudioNarrationContext();

  // Enhanced stop handler
  const handleStop = () => {
    // Call stopSpeaking from the context
    stopSpeaking();

    // As a backup, also try direct methods
    if (typeof window !== "undefined" && window.AudioManager) {
      // Try pausePlayback first
      if (window.AudioManager.pausePlayback) {
        window.AudioManager.pausePlayback();
      }

      // Also clear the queue
      if (window.AudioManager.clearQueue) {
        window.AudioManager.clearQueue();
      }
    }
  };

  return (
    <div className="flex items-center gap-1">
      {isPlaying && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={handleStop}
            >
              <div className="relative flex items-center justify-center">
                <PauseCircleIcon className="size-4 text-primary" />
                <AudioWave
                  isPlaying={true}
                  className="absolute -bottom-2 text-primary"
                />
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Stop narration</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            onClick={toggleAutoPlay}
          >
            {autoPlay ? (
              <div className="relative flex items-center justify-center">
                <Volume2Icon
                  className={`size-4 ${isPlaying ? "text-primary" : ""}`}
                />
                {isPlaying && (
                  <AudioWave
                    isPlaying={true}
                    className="absolute -bottom-2 text-primary"
                  />
                )}
              </div>
            ) : (
              <VolumeXIcon className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {autoPlay ? "Disable audio narration" : "Enable audio narration"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
