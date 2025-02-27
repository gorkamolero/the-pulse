"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
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
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ELEVENLABS_VOICES,
  OPENAI_VOICES,
  Provider,
} from "@/lib/orate-service";
import { useAtom } from "jotai";
import { audioEnabledAtom, selectedVoiceAtom } from "@/lib/atoms";

// Combine all voice options
const allVoices = [
  {
    provider: "elevenlabs" as Provider,
    label: "ElevenLabs",
    voices: ELEVENLABS_VOICES,
  },
  {
    provider: "openai" as Provider,
    label: "OpenAI",
    voices: OPENAI_VOICES,
  },
];

// Define the voice type based on the structure in orate-service.ts
interface Voice {
  id: string;
  name: string;
  description: string;
}

export function VoiceSelector() {
  const [open, setOpen] = useState(false);
  const [audioEnabled] = useAtom(audioEnabledAtom);
  const [selectedVoice, setSelectedVoice] = useAtom(selectedVoiceAtom);

  const voiceId = selectedVoice.voiceId;
  const provider = selectedVoice.provider;

  console.log("Current voice state:", { voiceId, provider });

  // Find the currently selected voice
  const currentVoice = allVoices
    .find((group) => group.provider === provider)
    ?.voices.find((voice: Voice) => voice.id === voiceId);

  console.log("Current voice found:", currentVoice);

  // Handle voice selection
  const handleSelect = useCallback(
    (value: string) => {
      // The value format is "provider-id"
      const [providerValue, voiceId] = value.split("-");
      const providerType = providerValue as Provider;

      console.log("Selecting voice:", { voiceId, provider: providerType });

      setSelectedVoice({
        provider: providerType,
        voiceId,
      });
      setOpen(false);

      // Save to localStorage
      try {
        localStorage.setItem("audioNarrationVoiceId", voiceId);
        localStorage.setItem("audioNarrationProvider", providerType);
        console.log("Saved voice selection to localStorage");
      } catch (e) {
        console.error("Error saving voice selection to localStorage:", e);
      }
    },
    [setSelectedVoice]
  );

  // Load saved voice on mount
  useEffect(() => {
    try {
      const savedVoice = localStorage.getItem("audioNarrationVoiceId");
      const savedProvider = localStorage.getItem(
        "audioNarrationProvider"
      ) as Provider | null;

      if (savedVoice && savedProvider) {
        // Verify the saved voice exists in our current options
        const providerExists = allVoices.some(
          (group) => group.provider === savedProvider
        );

        const voiceExists = allVoices
          .find((group) => group.provider === savedProvider)
          ?.voices.some((voice: Voice) => voice.id === savedVoice);

        if (providerExists && voiceExists) {
          setSelectedVoice({
            provider: savedProvider,
            voiceId: savedVoice,
          });
        }
      }
    } catch (e) {
      console.error("Error loading voice selection from localStorage:", e);
    }
  }, [setSelectedVoice]);

  if (!audioEnabled) return null;

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {currentVoice ? currentVoice.name : "Select voice..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Search voices..." />
            <CommandList>
              <CommandEmpty>No voice found.</CommandEmpty>
              {allVoices.map((group, index) => (
                <Fragment key={group.provider}>
                  {index > 0 && <CommandSeparator />}
                  <CommandGroup heading={group.label}>
                    {group.voices.map((voice: Voice) => {
                      const value = `${group.provider}-${voice.id}`;
                      return (
                        <CommandItem
                          key={value}
                          value={value}
                          onSelect={handleSelect}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              voiceId === voice.id &&
                                provider === group.provider
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{voice.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {voice.description}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </Fragment>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
