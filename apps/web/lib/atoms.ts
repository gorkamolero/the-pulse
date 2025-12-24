import { atomWithStorage } from "jotai/utils";
import { atom } from "jotai";
import { DEFAULT_ELEVENLABS_VOICE_ID } from "./orate-service";
import { type GuestSession, GUEST_SESSION_KEY } from "./guest-session";

// Atom to control the expansion state of reasoning in messages
export const showReasoningAtom = atomWithStorage("reasoningExpanded", false);

// Guest session atom - persisted to localStorage
export const guestSessionAtom = atomWithStorage<GuestSession | null>(
  GUEST_SESSION_KEY,
  null
);

// Derived atom to check if in guest mode
export const isGuestModeAtom = atom((get) => {
  const session = get(guestSessionAtom);
  return session !== null;
});

// Audio narration atoms
export const audioEnabledAtom = atom(true);
export const selectedVoiceAtom = atom({
  provider: "elevenlabs",
  voiceId: DEFAULT_ELEVENLABS_VOICE_ID,
});

// Real-time audio streaming (Option C) - when enabled, audio streams alongside text
// When disabled (default), audio generates in background after text completes (Option B)
export const realtimeAudioAtom = atomWithStorage("realtimeAudio", false);
