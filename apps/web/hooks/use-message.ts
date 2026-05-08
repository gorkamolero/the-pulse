'use client';

import useSWR from 'swr';
import { useCallback, useMemo } from 'react';
import type { Message } from '@/lib/db/schema';

const MEDIA_GENERATION_TIMEOUT_MS = 90 * 1000;

export const initialMessageData: Message = {
  id: '',
  chatId: '',
  role: '',
  content: {},
  createdAt: new Date(),
  imageUrl: null,
  audioUrl: null,
  wordTimings: null,
};

type Selector<T> = (state: Message) => T;

export function useMessageSelector<Selected>(messageId: string, selector: Selector<Selected>) {
  const { data: localMessage } = useSWR<Message>(
    messageId ? `message-${messageId}` : null,
    async () => {
      const response = await fetch(`/api/messages/${messageId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch message');
      }
      return response.json();
    },
    {
      fallbackData: initialMessageData,
    }
  );

  const selectedValue = useMemo(() => {
    if (!localMessage) return selector(initialMessageData);
    return selector(localMessage);
  }, [localMessage, selector]);

  return selectedValue;
}

export function useMessage(messageId: string | null) {
  const { data: message, error, mutate: setMessage } = useSWR<Message | null>(
    messageId ? `message-${messageId}` : null,
    async () => {
      const response = await fetch(`/api/messages/${messageId}`);
      // 404 means message not saved yet (race condition) - return null to keep polling
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch message');
      }
      const data = await response.json();
      return data;
    },
    {
      // Poll every 2 seconds while message not found or media still generating
      refreshInterval: (data) => {
        // Keep polling if message not in DB yet
        if (data === null) {
          return 2000;
        }
        const createdAt = data?.createdAt ? new Date(data.createdAt).getTime() : Date.now();
        const mediaTimedOut = Date.now() - createdAt > MEDIA_GENERATION_TIMEOUT_MS;
        const needsImage = !data?.imageUrl && messageId && !mediaTimedOut;
        const needsAudio = !data?.audioUrl && messageId && !mediaTimedOut;
        if (needsImage || needsAudio) {
          return 2000;
        }
        return 0; // Stop polling once we have message with both media
      },
    }
  );

  const updateMessage = useCallback(
    (updaterFn: Message | ((currentMessage: Message) => Message)) => {
      setMessage((currentMessage) => {
        const messageToUpdate = currentMessage || initialMessageData;

        if (typeof updaterFn === 'function') {
          return updaterFn(messageToUpdate);
        }

        return updaterFn;
      });
    },
    [setMessage]
  );

  // Message is loading if we have an ID but no data yet (null = still polling for DB save)
  const isLoading = !!messageId && (message === undefined || message === null);
  // Image is generating when we have a message but no imageUrl yet
  const messageAgeMs = message?.createdAt
    ? Date.now() - new Date(message.createdAt).getTime()
    : 0;
  const mediaTimedOut = messageAgeMs > MEDIA_GENERATION_TIMEOUT_MS;
  const isGeneratingImage = !!messageId && !!message && !message.imageUrl && !mediaTimedOut;
  // Audio is generating when we have a message but no audioUrl yet
  const isGeneratingAudio = !!messageId && !!message && !message.audioUrl && !mediaTimedOut;
  const isAudioUnavailable = !!messageId && !!message && !message.audioUrl && mediaTimedOut;

  return useMemo(
    () => ({
      message: message || initialMessageData,
      isLoading,
      isError: !!error,
      isGeneratingImage,
      isGeneratingAudio,
      isAudioUnavailable,
      updateMessage,
    }),
    [message, error, isLoading, isGeneratingImage, isGeneratingAudio, isAudioUnavailable, updateMessage]
  );
}
