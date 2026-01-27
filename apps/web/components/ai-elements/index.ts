// AI Elements - Atmospheric storytelling chat components for The Pulse
// Based on Vercel AI SDK Elements patterns

// Conversation components
export {
  Conversation,
  ConversationContent,
  ConversationScrollAnchor,
  ConversationScrollButton,
  ConversationDivider,
  useScrollContext,
  type ConversationProps,
  type ConversationContentProps,
  type ConversationDividerProps,
  type ConversationScrollButtonProps,
} from "./conversation";

// Message components
export {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageTimestamp,
  MessageSystem,
  useMessageContext,
  type MessageProps,
  type MessageContentProps,
  type MessageResponseProps,
  type MessageActionsProps,
  type MessageTimestampProps,
  type MessageSystemProps,
} from "./message";

// Prompt input components
export {
  PromptInput,
  PromptTextarea,
  PromptActions,
  PromptSendButton,
  PromptContainer,
  PromptHint,
  type PromptInputProps,
  type PromptTextareaProps,
  type PromptActionsProps,
  type PromptSendButtonProps,
  type PromptContainerProps,
  type PromptHintProps,
} from "./prompt-input";

// Thinking/loading components
export {
  ThinkingIndicator,
  ThinkingDots,
  TypingCursor,
  StreamingText,
  type ThinkingIndicatorProps,
  type ThinkingDotsProps,
  type TypingCursorProps,
  type StreamingTextProps,
} from "./thinking";
