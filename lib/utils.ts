import type {
  CoreAssistantMessage,
  CoreToolMessage,
  UIMessage,
  TextUIPart,
  ReasoningUIPart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Message as DBMessage, Document } from '@/lib/db/schema';
import type { LegacyMessage } from '@/lib/types/message';

// Local ToolInvocation type (UIToolInvocation in SDK v5)
interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'call' | 'result' | 'partial-call';
  result?: unknown;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      'An error occurred while fetching the data.',
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function addToolMessageToChat({
  toolMessage,
  messages,
}: {
  toolMessage: CoreToolMessage;
  messages: Array<LegacyMessage>;
}): Array<LegacyMessage> {
  return messages.map((message) => {
    if (message.toolInvocations) {
      return {
        ...message,
        toolInvocations: message.toolInvocations.map((toolInvocation) => {
          const toolResult = toolMessage.content.find(
            (tool) => tool.toolCallId === toolInvocation.toolCallId,
          );

          if (toolResult) {
            return {
              ...toolInvocation,
              state: 'result',
              result: (toolResult as { output?: unknown }).output,
            };
          }

          return toolInvocation;
        }),
      };
    }

    return message;
  });
}

export function convertToUIMessages(
  messages: Array<DBMessage>,
): Array<UIMessage> {
  return messages.reduce((chatMessages: Array<UIMessage>, message) => {
    if (message.role === 'tool') {
      // Skip tool messages or handle them by merging with previous assistant message
      return chatMessages;
    }

    const parts: UIMessage['parts'] = [];

    if (typeof message.content === 'string') {
      if (message.content) {
        parts.push({
          type: 'text',
          text: message.content,
        });
      }
    } else if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === 'text') {
          parts.push({
            type: 'text',
            text: content.text,
          });
        } else if (content.type === 'tool-call') {
          // SDK v5: tool invocation properties are flattened, not nested
          parts.push({
            type: `tool-${content.toolName}`,
            toolCallId: content.toolCallId,
            toolName: content.toolName,
            state: 'input-available',
            input: content.args,
          } as UIMessage['parts'][number]);
        } else if (content.type === 'reasoning') {
          parts.push({
            type: 'reasoning',
            text: content.reasoning,
          });
        }
      }
    }

    chatMessages.push({
      id: message.id,
      role: message.role as UIMessage['role'],
      parts,
    });

    return chatMessages;
  }, []);
}

// Helper functions to work with UIMessage
export function getUIMessageContent(message: UIMessage): string {
  return message.parts
    .filter((part): part is TextUIPart => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function getUIMessageReasoning(message: UIMessage): string | undefined {
  const reasoningPart = message.parts.find((part): part is ReasoningUIPart => part.type === 'reasoning');
  return reasoningPart?.text;
}

// Type for tool invocation parts in SDK v5 (properties are flattened)
interface ToolInvocationPart {
  type: string;
  toolCallId: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  state: string;
}

export function getUIMessageToolInvocations(message: UIMessage): Array<ToolInvocation> {
  return message.parts
    .filter((part) => part.type.startsWith('tool-') || part.type === 'tool-invocation')
    .map((part) => {
      // Cast to access SDK v5 flattened properties
      const toolPart = part as unknown as ToolInvocationPart;
      return {
        toolCallId: toolPart.toolCallId,
        toolName: toolPart.toolName ?? toolPart.type.replace('tool-', ''),
        args: (toolPart.input ?? {}) as Record<string, unknown>,
        state: toolPart.state === 'output-available' ? 'result' as const :
               toolPart.state === 'input-available' ? 'call' as const : 'partial-call' as const,
        result: toolPart.output,
      };
    });
}

// Create a LegacyMessage-like interface for backward compatibility
export function convertUIMessageToLegacyFormat(message: UIMessage): LegacyMessage {
  return {
    id: message.id,
    role: message.role,
    content: getUIMessageContent(message),
    reasoning: getUIMessageReasoning(message),
    toolInvocations: getUIMessageToolInvocations(message),
  };
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
export type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function sanitizeResponseMessages({
  messages,
  reasoning,
}: {
  messages: Array<ResponseMessage>;
  reasoning: string | undefined;
}) {
  const toolResultIds: Array<string> = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      for (const content of message.content) {
        if (content.type === 'tool-result') {
          toolResultIds.push(content.toolCallId);
        }
      }
    }
  }

  const messagesBySanitizedContent = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (typeof message.content === 'string') return message;

    const sanitizedContent = message.content.filter((content) =>
      content.type === 'tool-call'
        ? toolResultIds.includes(content.toolCallId)
        : content.type === 'text'
          ? content.text.length > 0
          : true,
    );

    if (reasoning) {
      // @ts-expect-error: reasoning message parts in sdk is wip
      sanitizedContent.push({ type: 'reasoning', reasoning });
    }

    return {
      ...message,
      content: sanitizedContent,
    };
  });

  return messagesBySanitizedContent.filter(
    (message) => message.content.length > 0,
  );
}

export function sanitizeUIMessages(messages: Array<LegacyMessage>): Array<LegacyMessage> {
  const messagesBySanitizedToolInvocations = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    if (!message.toolInvocations) return message;

    const toolResultIds: Array<string> = [];

    for (const toolInvocation of message.toolInvocations) {
      if (toolInvocation.state === 'result') {
        toolResultIds.push(toolInvocation.toolCallId);
      }
    }

    const sanitizedToolInvocations = message.toolInvocations.filter(
      (toolInvocation) =>
        toolInvocation.state === 'result' ||
        toolResultIds.includes(toolInvocation.toolCallId),
    );

    return {
      ...message,
      toolInvocations: sanitizedToolInvocations,
    };
  });

  return messagesBySanitizedToolInvocations.filter(
    (message) =>
      message.content.length > 0 ||
      (message.toolInvocations && message.toolInvocations.length > 0),
  );
}

export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Array<Document>,
  index: number,
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();

  return documents[index].createdAt;
}
