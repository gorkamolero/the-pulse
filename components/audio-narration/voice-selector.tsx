"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MicIcon, CheckIcon } from "lucide-react";
import { DEFAULT_VOICE_ID } from "@/lib/elevenlabs";
import { useAudioNarrationContext } from "./context";

// Voice options
export const voices = [
  {
    id: DEFAULT_VOICE_ID,
    name: "Carter the Mountain King",
    description: "Rich, smooth, & rugged",
  },
  {
    id: "uVKHymY7OYMd6OailpG5",
    name: "Frederick",
    description: "Old Gnarly Narrator",
  },
  {
    id: "dAcds2QMcvmv86jQMC3Y",
    name: "Jayce",
    description: "The Gangster",
  },
  {
    id: "flHkNRp1BlvT73UL6gyz",
    name: "Jessica Anne Bogart",
    description: "Smooth female voice",
  },
  {
    id: "0dPqNXnhg2bmxQv1WKDp",
    name: "Grandpa Oxley",
    description: "Wise elder voice",
  },
];

export function VoiceSelector() {
  const [selectedVoiceId, setSelectedVoiceId] =
    useState<string>(DEFAULT_VOICE_ID);
  const [open, setOpen] = useState(false);
  const { clearAudioCache } = useAudioNarrationContext();

  // Get the selected voice details
  const selectedVoice =
    voices.find((voice) => voice.id === selectedVoiceId) || voices[0];

  // Handle voice selection
  const handleSelectVoice = (voiceId: string) => {
    if (voiceId !== selectedVoiceId) {
      setSelectedVoiceId(voiceId);
      // Clear the audio cache when changing voices
      clearAudioCache();

      // Store the selected voice ID in localStorage for persistence
      localStorage.setItem("selectedVoiceId", voiceId);

      // Dispatch a custom event to notify the AudioNarrationProvider
      window.dispatchEvent(
        new CustomEvent("voice-changed", { detail: { voiceId } })
      );
    }
    setOpen(false);
  };

  // Load the selected voice from localStorage on mount
  useEffect(() => {
    const savedVoiceId = localStorage.getItem("selectedVoiceId");
    if (savedVoiceId) {
      setSelectedVoiceId(savedVoiceId);
      // Dispatch event to update the provider
      window.dispatchEvent(
        new CustomEvent("voice-changed", { detail: { voiceId: savedVoiceId } })
      );
    }
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 rounded-full">
              <MicIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Voice: {selectedVoice.name}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        {voices.map((voice) => (
          <DropdownMenuItem
            key={voice.id}
            onSelect={() => handleSelectVoice(voice.id)}
            className="gap-2 group/item flex flex-row justify-between items-center"
          >
            <div className="flex flex-col gap-1 items-start">
              <div>{voice.name}</div>
              <div className="text-xs text-muted-foreground">
                {voice.description}
              </div>
            </div>
            {voice.id === selectedVoiceId && (
              <CheckIcon className="size-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
