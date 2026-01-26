"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { VOICES } from "@/lib/tts-service";
import { useAtom } from "jotai";
import { audioEnabledAtom, selectedVoiceAtom } from "@/lib/atoms";

export function VoiceSelector({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  const [audioEnabled] = useAtom(audioEnabledAtom);
  const [selectedVoice, setSelectedVoice] = useAtom(selectedVoiceAtom);

  // Find the currently selected voice
  const currentVoice = VOICES.find((voice) => voice.id === selectedVoice);

  // Handle voice selection
  const handleSelect = useCallback(
    (value: string) => {
      setSelectedVoice(value);
      setOpen(false);

      // Save to localStorage
      try {
        localStorage.setItem("audioNarrationVoiceId", value);
      } catch {
        // Ignore localStorage errors (private browsing, etc.)
      }
    },
    [setSelectedVoice]
  );

  // Load saved voice on mount
  useEffect(() => {
    try {
      const savedVoice = localStorage.getItem("audioNarrationVoiceId");

      if (savedVoice) {
        // Verify the saved voice exists in our current options
        const voiceExists = VOICES.some((voice) => voice.id === savedVoice);

        if (voiceExists) {
          setSelectedVoice(savedVoice);
        }
      }
    } catch {
      // Ignore localStorage errors (private browsing, etc.)
    }
  }, [setSelectedVoice]);

  if (!audioEnabled) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            type="button"
          >
            {currentVoice ? currentVoice.name : "Select voice..."}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Search voices..." />
            <CommandList>
              <CommandEmpty>No voice found.</CommandEmpty>
              <CommandGroup heading="ElevenLabs">
                {VOICES.map((voice) => (
                  <CommandItem
                    key={voice.id}
                    value={voice.id}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedVoice === voice.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{voice.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {voice.description}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
