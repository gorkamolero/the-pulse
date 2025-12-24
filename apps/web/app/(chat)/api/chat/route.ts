import {
  type UIMessage,
  type LanguageModel,
  streamText,
  convertToModelMessages,
} from "ai";

import { auth } from "@/app/(auth)/auth";
import { NARRATOR_MODEL } from "@pulse/core/ai/models";
import { systemPrompt } from "@pulse/core/ai/prompts/system";
import { getStoryById, DEFAULT_STORY_ID } from "@pulse/core/ai/stories";
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  startFreeStory,
  addMisuseWarning,
  getUserSettings,
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
} from "@pulse/core/narrator/validation";
import { createUserModel } from "@/lib/ai/create-model";
import {
  evaluateMessage,
  shouldSampleMessage,
  isMisuseConfirmed,
} from "@/lib/ai/misuse-evaluator";

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

  const userId = session.user.id;
  const userMessage = getMostRecentUserMessage(messages);

  if (!userMessage) {
    return new Response("No user message found", { status: 400 });
  }

  // Get user model based on their tier (own key, free tier, or degraded)
  let model: LanguageModel;
  let usingUserKey = false;
  let isDegraded = false;

  try {
    const modelResult = await createUserModel({
      userId,
      modelId: NARRATOR_MODEL,
    });
    model = modelResult.model;
    usingUserKey = modelResult.usingUserKey;
    isDegraded = modelResult.isDegraded;
  } catch (error) {
    if (error instanceof Error && error.name === "FREE_TIER_EXHAUSTED") {
      return new Response(
        JSON.stringify({
          error: "FREE_TIER_EXHAUSTED",
          message:
            "Your free story has been completed. Please add your own API key to continue playing.",
          redirectTo: "/settings",
        }),
        {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    throw error;
  }

  // Track free story start (if using server key and first message)
  if (!usingUserKey) {
    const settings = await getUserSettings(userId);
    if (!settings?.freeStoryId) {
      await startFreeStory(userId, selectedStoryId);
    }
  }

  // Periodic misuse sampling (only for server key users)
  const messageCount = messages.filter((m) => m.role === "user").length;
  let misuseWarning = false;

  if (!usingUserKey && shouldSampleMessage(messageCount)) {
    const story = getStoryById(selectedStoryId);
    const lastAssistantMsg = messages
      .filter((m) => m.role === "assistant")
      .slice(-1)[0];
    const recentNarration = lastAssistantMsg
      ? getUIMessageContent(lastAssistantMsg)
      : undefined;

    const evaluation = await evaluateMessage(getUIMessageContent(userMessage), {
      storyId: selectedStoryId,
      storyTitle: story?.title,
      recentNarration,
    });

    if (isMisuseConfirmed(evaluation)) {
      const warnings = await addMisuseWarning(userId);
      console.warn(
        `Misuse detected for user ${userId}: ${evaluation.reason} (warning ${warnings})`
      );
      misuseWarning = warnings === 1; // Only warn on first offense
    }
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
    await saveChat({ id, userId, title });
  }

  await saveMessages({
    messages: [
      {
        id: crypto.randomUUID(),
        role: userMessage.role,
        content: getUIMessageContent(userMessage),
        createdAt: new Date(),
        chatId: id,
        imageUrl: null,
      },
    ],
  });

  // Select the appropriate system prompt based on the language
  const getSystemPromptForLanguage = (language: string) =>
    systemPrompt({
      storyGuide: getStoryById(selectedStoryId)?.storyGuide || "",
      language: language === "es" ? "spanish" : "english",
    });

  const maxRetries = 3;

  // Convert UIMessages to ModelMessages for the AI SDK
  const modelMessages = convertToModelMessages(messages);

  // Generate with retry - collect full text first, then stream if valid
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = streamText({
        model,
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
        console.warn(
          `Narrator garbage detected (attempt ${attempt}/${maxRetries}): ${reason}`
        );
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
          const reasoningText = reasoning?.map((r) => r.text).join("\n");
          const sanitizedResponseMessages = sanitizeResponseMessages({
            messages: response.messages as unknown as Array<ResponseMessage>,
            reasoning: reasoningText,
          });

          const lastAssistantMessage = sanitizedResponseMessages
            .filter((m) => m.role === "assistant")
            .pop();

          let imageResult = null;

          if (
            sanitizedResponseMessages[0].role === "assistant" &&
            lastAssistantMessage?.id
          ) {
            imageResult = await generatePulseImage({
              storyId: selectedStoryId,
              pulse: lastAssistantMessage.content as string,
              messageId: lastAssistantMessage.id,
            });
          }

          await saveMessages({
            messages: sanitizedResponseMessages.map((message) => {
              return {
                id: crypto.randomUUID(),
                chatId: id,
                role: message.role,
                content: message.content,
                createdAt: new Date(),
                imageUrl: imageResult?.url ?? null,
              };
            }),
          });
        } catch (error) {
          console.error("Failed to save chat", error);
        }
      }

      // Build response headers
      const headers: HeadersInit = {
        "Content-Type": "text/plain; charset=utf-8",
      };

      // Add warning header if misuse was detected
      if (misuseWarning) {
        headers["X-Misuse-Warning"] = "true";
      }

      // Add degraded mode indicator
      if (isDegraded) {
        headers["X-Degraded-Mode"] = "true";
      }

      // Return as text response (already collected)
      return new Response(fullText, { headers });
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
  } catch {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
