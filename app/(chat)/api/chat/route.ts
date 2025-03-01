import {
  type Message,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from "ai";

import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts/system";
import { getStoryById, DEFAULT_STORY_ID } from "@/lib/ai/stories";
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from "@/lib/utils";

import { generateTitleFromUserMessage } from "../../actions";
import { generatePulseImage } from "@/lib/ai/tools/generate-image";

export const maxDuration = 60;

export async function POST(request: Request) {
  const {
    id,
    messages,
    selectedChatModel,
    selectedStoryId = DEFAULT_STORY_ID,
    language = "en",
  }: {
    id: string;
    messages: Array<Message>;
    selectedChatModel: string;
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
    messages: [{ ...userMessage, createdAt: new Date(), chatId: id, imageUrl: null }],
  });

  // Select the appropriate system prompt based on the language
  const getSystemPromptForLanguage = (language: string) => systemPrompt({
    storyGuide: getStoryById(selectedStoryId)?.storyGuide || "",
    language: language === "es" ? "spanish" : "english",
  })

  return createDataStreamResponse({
    execute: (dataStream) => {
      const result = streamText({
        model: myProvider.languageModel(selectedChatModel),
        system: getSystemPromptForLanguage(language),
        messages,
        maxSteps: 5,
        experimental_transform: smoothStream({ chunking: "word" }),
        experimental_generateMessageId: generateUUID,
        onFinish: async ({ response, reasoning, }) => {
          if (session.user?.id) {
            try {
              const sanitizedResponseMessages = sanitizeResponseMessages({
                messages: response.messages,
                reasoning,
              });

              const lastAssistantMessage = sanitizedResponseMessages.filter(m => m.role === 'assistant').pop()

              let imageResult = null

              if (sanitizedResponseMessages[0].role === 'assistant') {
                imageResult = await generatePulseImage({
                  storyId: selectedStoryId,
                  pulse: lastAssistantMessage?.content as string,
                  messageId: lastAssistantMessage?.id!
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
        },
        experimental_telemetry: {
          isEnabled: true,
          functionId: "stream-text",
        },
      });

      result.consumeStream();

      result.mergeIntoDataStream(dataStream, {
        sendReasoning: true,
      });
    },
    onError: (error: unknown) => {
      console.error("Error in streamText", error);
      return "Oops, an error occured!";
    },
  });
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
