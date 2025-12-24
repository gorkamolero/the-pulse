'use client';

import { useAtom } from 'jotai';
import { useCallback } from 'react';
import { guestSessionAtom } from '@/lib/atoms';
import {
  type GuestMessage,
  createGuestSession,
  hasReachedLimit,
  isSessionExpired,
  MAX_GUEST_PULSES,
} from '@/lib/guest-session';

export function useGuestSession() {
  const [session, setSession] = useAtom(guestSessionAtom);

  const initSession = useCallback(
    (audioEnabled = true) => {
      const newSession = createGuestSession(audioEnabled);
      setSession(newSession);
      return newSession;
    },
    [setSession]
  );

  const addMessage = useCallback(
    (message: Omit<GuestMessage, 'id' | 'createdAt'>) => {
      setSession((prev) => {
        if (!prev) return prev;

        const newMessage: GuestMessage = {
          ...message,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };

        // Increment pulse count when assistant responds
        const newPulseCount =
          message.role === 'assistant' ? prev.pulseCount + 1 : prev.pulseCount;

        return {
          ...prev,
          messages: [...prev.messages, newMessage],
          pulseCount: newPulseCount,
          lastActiveAt: new Date().toISOString(),
        };
      });
    },
    [setSession]
  );

  const markSoftGateShown = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, softGateShown: true };
    });
  }, [setSession]);

  const clearSession = useCallback(() => {
    setSession(null);
  }, [setSession]);

  const shouldShowSoftGate = useCallback(() => {
    if (!session) return false;
    return hasReachedLimit(session) && !session.softGateShown;
  }, [session]);

  const isExpired = useCallback(() => {
    if (!session) return false;
    return isSessionExpired(session);
  }, [session]);

  const canContinue = useCallback(() => {
    if (!session) return true; // Can start new session
    if (isSessionExpired(session)) return false;
    return session.pulseCount < MAX_GUEST_PULSES;
  }, [session]);

  return {
    session,
    initSession,
    addMessage,
    markSoftGateShown,
    clearSession,
    shouldShowSoftGate,
    isExpired,
    canContinue,
    pulseCount: session?.pulseCount ?? 0,
    maxPulses: MAX_GUEST_PULSES,
  };
}
