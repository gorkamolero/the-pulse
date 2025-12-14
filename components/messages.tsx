import type { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { useScrollToBottom } from './use-scroll-to-bottom';
import { memo } from 'react';
import equal from 'fast-deep-equal';
import { getUIMessageContent } from '@/lib/utils';
import type { Attachment } from '@/lib/types/message';

type ChatRequestOptions = {
  experimental_attachments?: Attachment[];
};

interface MessagesProps {
  chatId: string;
  isLoading: boolean;
  storyId: string;
  messages: Array<UIMessage>;
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
}

function PureMessages({
  chatId,
  isLoading,
  storyId,
  messages,
  setMessages,
  reload,
  isReadonly,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  const lastAssistantMessage = messages.filter(m => m.role==='assistant').pop()
  console.log('LAST ASSISTANT MESSAGE', lastAssistantMessage)

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6  overflow-y-scroll pt-4 flex-1"
    >

      {messages.map((message, index) => {
        const isLastAssistantMessage = lastAssistantMessage && getUIMessageContent(message) === getUIMessageContent(lastAssistantMessage)
        return (
          <PreviewMessage
            key={message.id}
            chatId={chatId}
            message={message}
            isLoading={isLoading && messages.length - 1 === index}
            setMessages={setMessages}
            reload={reload}
            isReadonly={isReadonly}
            autoplay={isLastAssistantMessage}
          />
        )
      })}

      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isLoading && nextProps.isLoading) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;

  return true;
});
