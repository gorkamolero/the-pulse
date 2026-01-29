import {
  type UIMessage,
  type LanguageModel,
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { after } from "next/server";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import { auth } from "@/app/(auth)/auth";
import { systemPrompt } from "@pulse/core/ai/prompts/system";
import {
  getStoryById,
  getNarratorConfig,
  DEFAULT_STORY_ID,
} from "@pulse/core/ai/stories";
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  updateMessageImageUrl,
  updateMessageAudioUrl,
  startFreeStory,
  addMisuseWarning,
  getUserSettings,
  ensureGuestUser,
} from "@/lib/db/queries";
import {
  getMostRecentUserMessage,
  getUIMessageContent,
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
import { MAX_GUEST_PULSES } from "@/lib/guest-session";

import { generateTitleFromUserMessage } from "../../actions";
import {
  generateImagePrompt,
  generateImageFromPrompt,
} from "@/lib/ai/tools/generate-image";
import { generatePulseAudio } from "@/lib/ai/tools/generate-audio";
import { generateSceneAmbience } from "@/lib/ai/sound-effects";

export const maxDuration = 60;

// Rate limiting for guests
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkGuestRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRequestCounts.get(ip);

  if (!record || record.resetAt < now) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// Shared: Save user message to database
async function saveUserMessage(
  userMessage: UIMessage,
  chatId: string
) {
  await saveMessages({
    messages: [
      {
        id: crypto.randomUUID(),
        role: userMessage.role,
        content: getUIMessageContent(userMessage),
        createdAt: new Date(),
        chatId,
        imageUrl: null,
        audioUrl: null,
      },
    ],
  });
}

// Shared: Create onFinish handler for streaming response
function createOnFinishHandler({
  chatId,
  storyId,
  voiceId,
  checkGarbage = false,
  earlyImagePromptPromise,
}: {
  chatId: string;
  storyId: string;
  voiceId: string;
  checkGarbage?: boolean;
  earlyImagePromptPromise?: Promise<string> | null;
}) {
  return async ({ responseMessage }: { responseMessage: { id: string; parts: Array<{ type: string; text?: string }> } }) => {
    const messageId = responseMessage.id;
    const text = responseMessage.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");

    // Check for garbage output (authenticated users only)
    if (checkGarbage && isGarbageOutput(text)) {
      const reason = describeGarbageReason(text);
      console.warn(`Narrator garbage detected: ${reason}`);
    }

    // Save the assistant message
    try {
      await saveMessages({
        messages: [
          {
            id: messageId,
            chatId,
            role: "assistant",
            content: text,
            createdAt: new Date(),
            imageUrl: null,
            audioUrl: null,
          },
        ],
      });

      // Schedule image, audio, and ambience generation to run AFTER response is sent
      after(async () => {
        // Generate image (using early prompt if available)
        try {
          let imagePrompt: string | undefined;

          // Use early-generated prompt if it completed successfully
          if (earlyImagePromptPromise) {
            const earlyPrompt = await earlyImagePromptPromise.catch(() => null);
            if (earlyPrompt) {
              imagePrompt = earlyPrompt;
            }
          }

          // Fall back to generating with full text if early prompt failed
          if (!imagePrompt) {
            imagePrompt = await generateImagePrompt({
              storyId,
              pulse: text,
            });
          }

          // Generate the actual image
          const imageResult = await generateImageFromPrompt({
            imagePrompt,
            messageId,
          });

          if (imageResult?.url) {
            await updateMessageImageUrl({
              id: messageId,
              imageUrl: imageResult.url,
            });
          }
        } catch {
          // Image generation failed - non-critical
        }

        // Generate audio with story-specific voice
        try {
          const audioResult = await generatePulseAudio({
            text,
            messageId,
            voiceId,
          });

          if (audioResult?.url) {
            await updateMessageAudioUrl({
              id: messageId,
              audioUrl: audioResult.url,
            });
          }
        } catch {
          // Audio generation failed - non-critical
        }

        // Generate scene ambience sound effect
        try {
          await generateSceneAmbience({
            storyId,
            sceneText: text,
            messageId,
            durationSeconds: 22,
          });
        } catch {
          // Ambience generation failed - non-critical
        }
      });
    } catch {
      // Failed to save assistant message - will be lost
    }
  };
}

export async function POST(request: Request) {
  const {
    id,
    messages,
    selectedStoryId = DEFAULT_STORY_ID,
    language = "en",
    solo = false,
    guestPulseCount,
  }: {
    id: string;
    messages: Array<UIMessage>;
    selectedStoryId?: string;
    language?: string;
    solo?: boolean;
    guestPulseCount?: number;
  } = await request.json();

  const session = await auth();
  const userId = session?.user?.id;
  const isGuest = !userId;

  // Common validation
  const userMessage = getMostRecentUserMessage(messages);
  if (!userMessage) {
    return new Response("No user message found", { status: 400 });
  }

  const story = getStoryById(selectedStoryId);
  if (!story) {
    return new Response(
      JSON.stringify({ error: "STORY_NOT_FOUND" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const narratorConfig = getNarratorConfig(selectedStoryId);
  const systemPromptText = systemPrompt({
    storyGuide: story.storyGuide,
    language: language === "es" ? "spanish" : "english",
    solo, // Solo mode - skips multi-player character creation
  });

  // ============== GUEST-SPECIFIC CHECKS ==============
  if (isGuest) {
    // Rate limit guests
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

    if (!checkGuestRateLimit(ip)) {
      return new Response(
        JSON.stringify({
          error: "RATE_LIMITED",
          message: "Too many requests. Please wait a moment.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check pulse limit
    if (typeof guestPulseCount !== "number" || guestPulseCount >= MAX_GUEST_PULSES) {
      return new Response(
        JSON.stringify({
          error: "GUEST_LIMIT_REACHED",
          message: "Create a free account to continue your adventure.",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ============== MODEL SELECTION ==============
  let model: LanguageModel;
  let isDegraded = false;
  let usingUserKey = false;

  if (isGuest) {
    // Kimi K2: fast (2.6s), atmospheric prose, great for horror narrative
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    model = openrouter("moonshotai/kimi-k2");
  } else {
    // Get user model based on their tier
    try {
      const modelResult = await createUserModel({
        userId,
        modelId: narratorConfig.modelId,
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
  }

  // ============== AUTHENTICATED-ONLY: FREE STORY & MISUSE TRACKING ==============
  if (!isGuest && !usingUserKey) {
    // Track free story start
    const settings = await getUserSettings(userId);
    if (!settings?.freeStoryId) {
      await startFreeStory(userId, selectedStoryId);
    }

    // Periodic misuse sampling
    const messageCount = messages.filter((m) => m.role === "user").length;
    if (shouldSampleMessage(messageCount)) {
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
      }
    }
  }

  // ============== CREATE/GET CHAT ==============
  const chat = await getChatById({ id });

  if (!chat) {
    let title: string;
    if (isGuest) {
      title = `[Guest] ${story.title}`;
    } else {
      const userTitle = await generateTitleFromUserMessage({ message: userMessage });
      const storyPrefix = `[${story.title}] `;
      const randomChars = Math.random().toString(36).substring(2, 6);
      title = `${storyPrefix}${userTitle} (${randomChars})`;
    }
    // Ensure guest user exists and get the ID
    const effectiveUserId = userId || await ensureGuestUser();
    await saveChat({ id, userId: effectiveUserId, title });
  }

  // ============== SAVE USER MESSAGE ==============
  await saveUserMessage(userMessage, id);

  // ============== STREAM RESPONSE WITH INLINE AUDIO ==============
  const messageId = crypto.randomUUID();

  return createUIMessageStreamResponse({
    headers: {
      ...(isDegraded && { "X-Degraded-Mode": "true" }),
    },
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        // Stream the LLM text response
        const result = streamText({
          model,
          system: systemPromptText,
          messages: convertToModelMessages(messages),
          ...(isGuest ? {} : {
            experimental_telemetry: {
              isEnabled: true,
              functionId: "stream-text",
            },
          }),
        });

        // Merge the text stream and wait for it to complete
        const mergedStream = result.toUIMessageStream({
          generateMessageId: () => messageId,
        });

        // Collect the full text while streaming
        let fullText = "";
        const reader = mergedStream.getReader();

        // Early image prompt tracking
        let imagePromptPromise: Promise<string> | null = null;
        let imagePromptStarted = false;
        const EARLY_PROMPT_CHARS = 150;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Forward the chunk to client
          writer.write(value);

          // Extract text from the value if it's a text delta
          if (value && typeof value === 'object' && 'type' in value) {
            if (value.type === 'text-delta' && 'delta' in value) {
              fullText += value.delta;

              // Start image prompt generation early
              if (!imagePromptStarted && fullText.length >= EARLY_PROMPT_CHARS) {
                imagePromptStarted = true;
                imagePromptPromise = generateImagePrompt({
                  storyId: selectedStoryId,
                  pulse: fullText,
                }).catch((err) => {
                  console.error("Early image prompt generation failed:", err);
                  return "";
                });
              }
            }
          }
        }

        // Check for garbage output
        if (!isGuest && isGarbageOutput(fullText)) {
          const reason = describeGarbageReason(fullText);
          console.warn(`Narrator garbage detected: ${reason}`);
        }

        // Save message to database
        try {
          await saveMessages({
            messages: [{
              id: messageId,
              chatId: id,
              role: "assistant",
              content: fullText,
              createdAt: new Date(),
              imageUrl: null,
              audioUrl: null,
            }],
          });
        } catch (e) {
          console.error("Failed to save message:", e);
        }

        // Generate audio INLINE (not in after()) so we can stream the URL
        try {
          const audioResult = await generatePulseAudio({
            text: fullText,
            messageId,
            voiceId: narratorConfig.voiceId,
          });

          if (audioResult?.url) {
            await updateMessageAudioUrl({
              id: messageId,
              audioUrl: audioResult.url,
            });

            // Send audio URL to client via data stream (type must start with 'data-')
            writer.write({
              type: 'data-audio-ready',
              data: { messageId, audioUrl: audioResult.url },
            });
          }
        } catch (e) {
          console.error("Audio generation failed:", e);
        }

        // Generate image in background (using early prompt if available)
        after(async () => {
          try {
            let imagePrompt: string | undefined;

            // Use early-generated prompt if it completed successfully
            if (imagePromptPromise) {
              const earlyPrompt = await imagePromptPromise.catch(() => null);
              if (earlyPrompt) {
                imagePrompt = earlyPrompt;
              }
            }

            // Fall back to generating with full text if early prompt failed
            if (!imagePrompt) {
              imagePrompt = await generateImagePrompt({
                storyId: selectedStoryId,
                pulse: fullText,
              });
            }

            // Generate the actual image
            const imageResult = await generateImageFromPrompt({
              imagePrompt,
              messageId,
            });

            if (imageResult?.url) {
              await updateMessageImageUrl({
                id: messageId,
                imageUrl: imageResult.url,
              });
            }
          } catch {
            // Image generation failed - non-critical
          }
        });

        // Generate scene ambience sound effect in background
        after(async () => {
          try {
            await generateSceneAmbience({
              storyId: selectedStoryId,
              sceneText: fullText,
              messageId,
              durationSeconds: 22,
            });
          } catch {
            // Ambience generation failed - non-critical
          }
        });
      },
    }),
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
  } catch {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
