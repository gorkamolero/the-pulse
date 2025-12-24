import { atomWithStorage } from "jotai/utils";
import { atom } from "jotai";
import { DEFAULT_ELEVENLABS_VOICE_ID } from "./orate-service";

// Atom to control the expansion state of reasoning in messages
export const showReasoningAtom = atomWithStorage("reasoningExpanded", false);

// Audio narration atoms
export const audioEnabledAtom = atom(true);
export const selectedVoiceAtom = atom({
  provider: "elevenlabs",
  voiceId: DEFAULT_ELEVENLABS_VOICE_ID,
});

// Real-time audio streaming (Option C) - when enabled, audio streams alongside text
// When disabled (default), audio generates in background after text completes (Option B)
export const realtimeAudioAtom = atomWithStorage("realtimeAudio", false);
