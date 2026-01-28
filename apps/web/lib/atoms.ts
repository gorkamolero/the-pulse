import { atomWithStorage } from "jotai/utils";
import { atom } from "jotai";
import { DEFAULT_VOICE_ID } from "@pulse/core/ai/models";
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

// Story has begun - user clicked "Begin" on loading modal
// Prevents audio autoplay before user dismisses the loading screen
export const storyBegunAtom = atom(false);

// Audio narration atoms
export const audioEnabledAtom = atom(true);

// Selected voice ID (ElevenLabs only)
export const selectedVoiceAtom = atom(DEFAULT_VOICE_ID);

// Real-time audio streaming (Option C) - when enabled, audio streams alongside text
// When disabled (default), audio generates in background after text completes (Option B)
export const realtimeAudioAtom = atomWithStorage("realtimeAudio", false);

// Current background image URL for contrast-aware input styling
export const currentBackgroundImageAtom = atom<string | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO PLAYBACK STATE
// Global state for audio visualization (Orb component)
// ─────────────────────────────────────────────────────────────────────────────

// Whether TTS audio is currently playing
export const audioPlayingAtom = atom(false);

// Current audio element reference (shared across components)
export const audioElementAtom = atom<HTMLAudioElement | null>(null);

// Narrator state for the Orb visualization
// - null: idle (story awaiting)
// - "thinking": narrator is generating response
// - "talking": audio is playing
export type NarratorState = null | "thinking" | "talking";
export const narratorStateAtom = atom<NarratorState>(null);
