import { atomWithStorage } from "jotai/utils";
import { atom } from "jotai";

// Atom to control the expansion state of reasoning in messages
export const showReasoningAtom = atomWithStorage("reasoningExpanded", false);

// Audio narration atoms
export const audioEnabledAtom = atom(true);
export const selectedVoiceAtom = atom({
  provider: "openai",
  voiceId: "alloy",
});
