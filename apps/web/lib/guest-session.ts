/**
 * Guest session types and constants for anonymous play
 * Sessions are stored in localStorage to avoid DB costs
 */

/**
 * Generate a UUID that works in non-secure contexts (HTTP over Tailscale, etc.)
 */
export function generateUUID(): string {
  // Use crypto.randomUUID if available (secure contexts)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface GuestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface GuestSession {
  id: string;
  storyId: 'shadow-over-innsmouth';
  messages: GuestMessage[];
  pulseCount: number; // Number of assistant responses (story beats)
  startedAt: string;
  lastActiveAt: string;
  audioEnabled: boolean;
  softGateShown: boolean;
}

export const MAX_GUEST_PULSES = 6; // 5 real pulses + 1 for auto-generated intro
export const GUEST_SESSION_KEY = 'pulse_guest_session';
export const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create a new guest session
 */
export function createGuestSession(audioEnabled = true): GuestSession {
  return {
    id: generateUUID(),
    storyId: 'shadow-over-innsmouth',
    messages: [],
    pulseCount: 0,
    startedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    audioEnabled,
    softGateShown: false,
  };
}

/**
 * Check if a guest session has expired
 */
export function isSessionExpired(session: GuestSession): boolean {
  const lastActive = new Date(session.lastActiveAt).getTime();
  return Date.now() - lastActive > GUEST_SESSION_TTL_MS;
}

/**
 * Check if the guest has reached the pulse limit
 */
export function hasReachedLimit(session: GuestSession): boolean {
  return session.pulseCount >= MAX_GUEST_PULSES;
}
