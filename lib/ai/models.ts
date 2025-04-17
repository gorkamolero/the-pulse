import { openai } from "@ai-sdk/openai";
import { fireworks } from "@ai-sdk/fireworks";
import { customProvider, type LanguageModelV1 } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const DEFAULT_CHAT_MODEL: string = "chat-model-large";

// Initialize OpenRouter with API key from environment variable
const openRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  compatibility: "strict",
});

export const myProvider = customProvider({
  languageModels: {
    "chat-model-small": openRouter.chat(
      "anthropic/claude-3.5-sonnet"
    ) as unknown as LanguageModelV1,
    "chat-model-large": openRouter.chat(
      "anthropic/claude-3.5-sonnet"
    ) as unknown as LanguageModelV1,
    "chat-model-search": openRouter.chat(
      "anthropic/claude-3.5-sonnet"
    ) as unknown as LanguageModelV1,
    "title-model": openRouter.chat(
      "anthropic/claude-3.5-haiku"
    ) as unknown as LanguageModelV1,
    "artifact-model": openai("gpt-4o-mini"),
  },
  imageModels: {
    "small-model": fireworks.image("accounts/fireworks/models/flux-1-dev"),
    "large-model": fireworks.image("accounts/fireworks/models/flux-1-dev"),
  },
});

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: "chat-model-large",
    name: "Large model",
    description: "Large model for complex, multi-step tasks",
  },
  {
    id: "chat-model-reasoning",
    name: "Reasoning model",
    description: "Uses advanced reasoning",
  },
];
