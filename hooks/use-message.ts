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
  const { data: message, error, mutate: setMessage } = useSWR<Message>(
    messageId ? `message-${messageId}` : null,
    async () => {
      const response = await fetch(`/api/messages/${messageId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch message');
      }
      const data = await response.json();
      return data;
    },
    {
      fallbackData: initialMessageData,
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

  return useMemo(
    () => ({
      message: message || initialMessageData,
      isLoading: !message && !error && !!messageId,
      isError: !!error,
      updateMessage,
    }),
    [message, error, messageId, updateMessage]
  );
}
