/**
 * Legacy Message Types
 *
 * These types provide backward compatibility with the old AI SDK message format.
 * The AI SDK v5 now uses UIMessage with `parts` array instead of `content`.
 *
 * Use UIMessage for SDK functions, and LegacyMessage for internal UI components.
 */

// ToolInvocation type from SDK (UIToolInvocation in v5)
interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'call' | 'result' | 'partial-call';
  result?: unknown;
}

export interface Attachment {
  url: string;
  name?: string;
  contentType?: string;
}

/**
 * Legacy message format for internal component use.
 * This mirrors the old Message type from AI SDK v4.
 */
export interface LegacyMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'data' | 'tool';
  content: string;
  reasoning?: string;
  toolInvocations?: ToolInvocation[];
  experimental_attachments?: Attachment[];
  imageUrl?: string | null;
}
