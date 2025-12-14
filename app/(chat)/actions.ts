"use server";

import { generateText, type UIMessage } from "ai";

import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from "@/lib/db/queries";
import type { VisibilityType } from "@/components/visibility-selector";
import { TITLE_MODEL } from "@/lib/ai/models";
import { getUIMessageContent } from "@/lib/utils";

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const messageContent = getUIMessageContent(message);
  const { text: title } = await generateText({
    model: TITLE_MODEL,
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: messageContent,
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}
