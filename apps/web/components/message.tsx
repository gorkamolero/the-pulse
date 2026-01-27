"use client";

import type { UIMessage } from "ai";
import cx from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useMemo } from "react";
import {
  convertUIMessageToLegacyFormat,
  getUIMessageContent,
  getUIMessageReasoning,
  getUIMessageToolInvocations,
} from "@/lib/utils";
import type { Attachment } from "@/lib/types/message";

import { SparklesIcon } from "./icons";
import { Markdown } from "./markdown";
import { MessageActions } from "./message-actions";
import { PreviewAttachment } from "./preview-attachment";
import { Weather, type WeatherAtLocation } from "./weather";
import equal from "fast-deep-equal";
import { cn } from "@/lib/utils";
import { MessageReasoning } from "./message-reasoning";

type ChatRequestOptions = {
  experimental_attachments?: Attachment[];
};

const PurePreviewMessage = ({
  chatId,
  message: uiMessage,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  autoplay
}: {
  chatId: string;
  message: UIMessage;
  isLoading: boolean;
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
  autoplay?: boolean
}) => {
  // Convert UIMessage to legacy format for compatibility
  const message = useMemo(() => convertUIMessageToLegacyFormat(uiMessage), [uiMessage]);

  return (
    <AnimatePresence>
      <motion.div
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
        data-message-id={message.id}
      >
        <div
          className="flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:w-fit"
        >
          {message.role === "assistant" && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 w-full">
            {message.experimental_attachments && (
              <div className="flex flex-row justify-end gap-2">
                {message.experimental_attachments.map((attachment) => (
                  <PreviewAttachment
                    key={attachment.url}
                    attachment={attachment}
                  />
                ))}
              </div>
            )}

            {message.reasoning && (
              <MessageReasoning
                isLoading={isLoading}
                reasoning={message.reasoning}
              />
            )}

            {(message.content || message.reasoning) && (
              <div
                className={cn("flex flex-col gap-4", {
                  "bg-primary text-primary-foreground px-3 py-2 rounded-xl":
                    message.role === "user",
                })}
              >
                <Markdown>{message.content as string}</Markdown>
              </div>
            )}

            {message.toolInvocations && message.toolInvocations.length > 0 && (
              <div className="flex flex-col gap-4">
                {message.toolInvocations.map((toolInvocation) => {
                  const { toolName, toolCallId, state, args } = toolInvocation;

                  if (state === "result") {
                    const { result } = toolInvocation;

                    return (
                      <div key={toolCallId}>
                        {toolName === "getWeather" ? (
                          <Weather weatherAtLocation={result as WeatherAtLocation} />
                        ) : toolName === "generatePulseImage" ? (
                          null
                        ) : (
                          <pre>{JSON.stringify(result, null, 2)}</pre>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ["getWeather"].includes(toolName),
                      })}
                    >
                      {toolName === "getWeather" ? (
                        <Weather />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                isLoading={isLoading}
                autoplay={autoplay}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.autoplay !== nextProps.autoplay) return false;
    if (getUIMessageReasoning(prevProps.message) !== getUIMessageReasoning(nextProps.message))
      return false;
    if (getUIMessageContent(prevProps.message) !== getUIMessageContent(nextProps.message)) return false;
    if (
      !equal(
        getUIMessageToolInvocations(prevProps.message),
        getUIMessageToolInvocations(nextProps.message)
      )
    )
      return false;

    return true;
  }
);

export const ThinkingMessage = () => {
  const messageRole = "assistant";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={messageRole}
    >
      <div className={cx("flex gap-4 w-full")}>
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
          <div className="translate-y-px">
            <SparklesIcon size={14} />
          </div>
        </div>

        <div className="flex flex-col gap-4 w-full">
          <div className="flex flex-col gap-4">
            <div className="h-4 w-5 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
