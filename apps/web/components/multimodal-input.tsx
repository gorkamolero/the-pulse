"use client";

import type { UIMessage, CreateUIMessage } from "ai";
import type { Attachment } from "@/lib/types/message";

type ChatRequestOptions = {
  experimental_attachments?: Array<Attachment>;
};
import cx from "classnames";
import type React from "react";
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useAtomValue } from "jotai";

import dynamic from "next/dynamic";
import { ArrowUpIcon, StopIcon } from "./icons";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { currentBackgroundImageAtom } from "@/lib/atoms";
import { useImageLuminance } from "@/hooks/use-image-luminance";

// Dynamic import with SSR disabled for WebGL component
const StoryOrb = dynamic(() => import("./story-orb").then(mod => ({ default: mod.StoryOrb })), {
  ssr: false,
  loading: () => <div className="w-8 h-8" />, // Placeholder while loading
});

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  disabled,
  disabledReason,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: Dispatch<SetStateAction<Array<UIMessage>>>;
  append: (
    message: UIMessage | CreateUIMessage<UIMessage>,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions
  ) => void;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  // Get background image luminance for contrast-aware styling
  const backgroundImage = useAtomValue(currentBackgroundImageAtom);
  const { theme: bgTheme } = useImageLuminance(backgroundImage);

  // Contrast-aware border: transparent when unfocused, solid when focused
  const borderContrastClass = bgTheme === "light"
    ? "border-zinc-800/40 focus-visible:border-zinc-800"
    : "border-zinc-300/40 focus-visible:border-zinc-300";

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const MIN_HEIGHT = 56; // Fixed minimum height to prevent jumping

  const adjustHeight = () => {
    if (textareaRef.current) {
      // Reset to min to measure true scrollHeight, but don't go below MIN_HEIGHT
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(scrollHeight, MIN_HEIGHT)}px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, "", `/pulse/${chatId}`);

    handleSubmit(undefined, {
      experimental_attachments: attachments,
    });

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    attachments,
    handleSubmit,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error("Failed to upload file, please try again!");
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments]
  );

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* Audio-reactive Orb floating above input */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <StoryOrb size="sm" />
      </div>

      {/* Hidden file input for attachments (kept for future use) */}
      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      <div className="flex flex-row gap-4 items-start w-full">
        <div className="relative grow">
          <Textarea
            ref={textareaRef}
            placeholder={disabled && disabledReason ? disabledReason : "What do you do?"}
            value={input}
            onChange={handleInput}
            disabled={disabled}
            className={cx(
              "min-h-[56px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base pr-12 transition-colors duration-300 border focus-visible:ring-0 focus-visible:ring-offset-0",
              borderContrastClass,
              disabled && "opacity-60 cursor-not-allowed",
              className
            )}
            rows={1}
            autoFocus={!disabled}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();

                if (disabled) {
                  if (disabledReason) toast.error(disabledReason);
                  return;
                }

                if (isLoading) {
                  toast.error("Please wait for the model to finish its response!");
                } else {
                  submitForm();
                }
              }
            }}
          />

          <div className="absolute top-0 right-0 p-2 w-fit flex flex-row justify-end">
            {isLoading ? (
              <StopButton stop={stop} setMessages={setMessages} />
            ) : (
              <SendButton
                input={input}
                submitForm={submitForm}
                uploadQueue={uploadQueue}
                disabled={disabled}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    return (
      prevProps.input === nextProps.input &&
      prevProps.isLoading === nextProps.isLoading &&
      prevProps.attachments === nextProps.attachments &&
      prevProps.messages.length === nextProps.messages.length &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.disabledReason === nextProps.disabledReason
    );
  }
);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: Dispatch<SetStateAction<Array<UIMessage>>>;
}) {
  return (
    <Button
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        // UIMessages are already sanitized through SDK
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
  disabled,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
  disabled?: boolean;
}) {
  return (
    <Button
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={disabled || input.length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.disabled !== nextProps.disabled) return false;
  return true;
});
