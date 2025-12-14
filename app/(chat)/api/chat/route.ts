import {
  type UIMessage,
  streamText,
  convertToModelMessages,
} from "ai";

import { auth } from "@/app/(auth)/auth";
import { NARRATOR_MODEL } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts/system";
import { getStoryById, DEFAULT_STORY_ID } from "@/lib/ai/stories";
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import {
  getMostRecentUserMessage,
  sanitizeResponseMessages,
  getUIMessageContent,
  type ResponseMessage,
} from "@/lib/utils";
import {
  isGarbageOutput,
  describeGarbageReason,
} from "@/lib/narrator/validation";

import { generateTitleFromUserMessage } from "../../actions";
import { generatePulseImage } from "@/lib/ai/tools/generate-image";

export const maxDuration = 60;

export async function POST(request: Request) {
  const {
    id,
    messages,
    selectedStoryId = DEFAULT_STORY_ID,
    language = "en",
  }: {
    id: string;
    messages: Array<UIMessage>;
    selectedStoryId?: string;
    language?: string;
  } = await request.json();

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userMessage = getMostRecentUserMessage(messages);

  if (!userMessage) {
    return new Response("No user message found", { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const userTitle = await generateTitleFromUserMessage({
      message: userMessage,
    });
    const story = getStoryById(selectedStoryId);
    const storyPrefix = story ? `[${story.title}] ` : "";

    // Generate a random 4-character string
    const randomChars = Math.random().toString(36).substring(2, 6);

    const title = `${storyPrefix}${userTitle} (${randomChars})`;
    await saveChat({ id, userId: session.user.id, title });
  }

  await saveMessages({
    messages: [{
      id: userMessage.id,
      role: userMessage.role,
      content: getUIMessageContent(userMessage),
      createdAt: new Date(),
      chatId: id,
      imageUrl: null
    }],
  });

  // Select the appropriate system prompt based on the language
  const getSystemPromptForLanguage = (language: string) => systemPrompt({
    storyGuide: getStoryById(selectedStoryId)?.storyGuide || "",
    language: language === "es" ? "spanish" : "english",
  })

  const maxRetries = 3;

  // Convert UIMessages to ModelMessages for the AI SDK
  const modelMessages = convertToModelMessages(messages);

  // Generate with retry - collect full text first, then stream if valid
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = streamText({
        model: NARRATOR_MODEL,
        system: getSystemPromptForLanguage(language),
        messages: modelMessages,
        experimental_telemetry: {
          isEnabled: true,
          functionId: "stream-text",
        },
      });

      // Collect full text to check for garbage before returning
      const fullText = await result.text;

      if (isGarbageOutput(fullText)) {
        const reason = describeGarbageReason(fullText);
        console.warn(`Narrator garbage detected (attempt ${attempt}/${maxRetries}): ${reason}`);
        if (attempt < maxRetries) {
          continue; // Retry
        }
        // Last attempt - return anyway with warning logged
      }

      // Valid response - save and return
      const response = await result.response;
      const reasoning = await result.reasoning;

      if (session.user?.id) {
        try {
          // Convert reasoning array to string for sanitization
          const reasoningText = reasoning?.map(r => r.text).join('\n');
          const sanitizedResponseMessages = sanitizeResponseMessages({
            messages: response.messages as unknown as Array<ResponseMessage>,
            reasoning: reasoningText,
          });

          const lastAssistantMessage = sanitizedResponseMessages.filter(m => m.role === 'assistant').pop()

          let imageResult = null

          if (sanitizedResponseMessages[0].role === 'assistant' && lastAssistantMessage?.id) {
            imageResult = await generatePulseImage({
              storyId: selectedStoryId,
              pulse: lastAssistantMessage.content as string,
              messageId: lastAssistantMessage.id
            });
          }

          await saveMessages({
            messages: sanitizedResponseMessages.map((message) => {
              return {
                id: message.id,
                chatId: id,
                role: message.role,
                content: message.content,
                createdAt: new Date(),
                imageUrl: imageResult?.url ?? null
              };
            }),
          });
        } catch (error) {
          console.error("Failed to save chat", error);
        }
      }

      // Return as text response (already collected)
      return new Response(fullText, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } catch (error) {
      console.error(`Narrator generation error (attempt ${attempt}):`, error);
      if (attempt >= maxRetries) {
        throw error;
      }
    }
  }

  throw new Error("Narrator generation failed after retries");
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
