'use client';

import useSWR from 'swr';
import { useCallback, useMemo } from 'react';
import type { Message } from '@/lib/db/schema';

export const initialMessageData: Message = {
  id: '',
  chatId: '',
  role: '',
  content: {},
  createdAt: new Date(),
  imageUrl: null,
  audioUrl: null,
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
        const needsImage = !data?.imageUrl && messageId;
        const needsAudio = !data?.audioUrl && messageId;
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
  const isGeneratingImage = !!messageId && !!message && !message.imageUrl;
  // Audio is generating when we have a message but no audioUrl yet
  const isGeneratingAudio = !!messageId && !!message && !message.audioUrl;

  return useMemo(
    () => ({
      message: message || initialMessageData,
      isLoading,
      isError: !!error,
      isGeneratingImage,
      isGeneratingAudio,
      updateMessage,
    }),
    [message, error, isLoading, isGeneratingImage, isGeneratingAudio, updateMessage]
  );
}
