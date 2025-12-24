/**
 * Guest session types and constants for anonymous play
 * Sessions are stored in localStorage to avoid DB costs
 */

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

export const MAX_GUEST_PULSES = 5;
export const GUEST_SESSION_KEY = 'pulse_guest_session';
export const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create a new guest session
 */
export function createGuestSession(audioEnabled = true): GuestSession {
  return {
    id: crypto.randomUUID(),
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
