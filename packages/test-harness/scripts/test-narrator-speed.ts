#!/usr/bin/env npx tsx
/**
 * Test narrator model speed - measures TTFT and tokens/sec
 */

import { config } from "dotenv";
import { resolve } from "node:path";

// Load .env.local from apps/web
config({ path: resolve(import.meta.dirname, "../../../apps/web/.env.local") });
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { systemPrompt } from "@pulse/core/ai/prompts/system";
import { getStory } from "../stories/loader";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY");
  process.exit(1);
}

const openrouter = createOpenRouter({ apiKey: OPENROUTER_API_KEY });

// Models to test - use OpenRouter model IDs
const MODELS: Record<string, string> = {
  "claude-sonnet": "anthropic/claude-sonnet-4",
  "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
  "claude-haiku": "anthropic/claude-3.5-haiku",
  "deepseek-v3": "deepseek/deepseek-chat-v3-0324",
  "grok-3-mini": "x-ai/grok-3-mini-beta",
  "gemini-flash": "google/gemini-2.0-flash-001",
  "gemini-flash-lite": "google/gemini-2.0-flash-lite-001",
  "llama-70b": "meta-llama/llama-3.3-70b-instruct",
};

async function testModel(modelKey: string, modelId: string) {
  const story = getStory("shadow-over-innsmouth");
  if (!story) throw new Error("Story not found");

  const system = systemPrompt({
    storyGuide: story.storyGuide,
    solo: true,
  });

  const userMessage = `Let's start the story "${story.title}".`;

  console.log(`\n━━━ Testing: ${modelKey} (${modelId}) ━━━`);

  const startTime = performance.now();
  let firstTokenTime: number | null = null;
  let tokenCount = 0;
  let fullText = "";

  try {
    const result = streamText({
      model: openrouter(modelId),
      system,
      messages: [{ role: "user", content: userMessage }],
      maxTokens: 500,
    });

    for await (const chunk of result.textStream) {
      if (firstTokenTime === null) {
        firstTokenTime = performance.now();
      }
      tokenCount++;
      fullText += chunk;
      process.stdout.write(".");
    }

    const endTime = performance.now();
    const ttft = firstTokenTime ? firstTokenTime - startTime : 0;
    const totalTime = endTime - startTime;
    const streamTime = firstTokenTime ? endTime - firstTokenTime : 0;

    // Rough token estimate (chars / 4)
    const estimatedTokens = Math.round(fullText.length / 4);

    console.log("\n");
    console.log(`  TTFT:          ${(ttft / 1000).toFixed(2)}s`);
    console.log(`  Total time:    ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`  Stream time:   ${(streamTime / 1000).toFixed(2)}s`);
    console.log(`  Est. tokens:   ~${estimatedTokens}`);
    console.log(`  Tokens/sec:    ~${(estimatedTokens / (streamTime / 1000)).toFixed(1)}`);
    console.log(`  Response length: ${fullText.length} chars`);
    console.log(`\n  Preview: "${fullText.slice(0, 150)}..."`);

    return {
      model: modelKey,
      ttft,
      totalTime,
      streamTime,
      estimatedTokens,
      tokensPerSec: estimatedTokens / (streamTime / 1000),
    };
  } catch (error) {
    console.error(`\n  ERROR: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const modelArg = args.find((a) => a.startsWith("--model="))?.split("=")[1];

  console.log("🎭 Narrator Speed Test");
  console.log("━".repeat(50));

  const modelsToTest = modelArg
    ? { [modelArg]: MODELS[modelArg as keyof typeof MODELS] || modelArg }
    : MODELS;

  const results: Array<NonNullable<Awaited<ReturnType<typeof testModel>>>> = [];

  for (const [key, id] of Object.entries(modelsToTest)) {
    const result = await testModel(key, id);
    if (result) results.push(result);
  }

  if (results.length > 1) {
    console.log("\n\n📊 Summary (sorted by TTFT)");
    console.log("━".repeat(50));
    results
      .sort((a, b) => a.ttft - b.ttft)
      .forEach((r, i) => {
        console.log(
          `${i + 1}. ${r.model.padEnd(20)} TTFT: ${(r.ttft / 1000).toFixed(2)}s  Speed: ${r.tokensPerSec.toFixed(0)} tok/s`
        );
      });
  }
}

main().catch(console.error);
