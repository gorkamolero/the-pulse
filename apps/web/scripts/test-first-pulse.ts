#!/usr/bin/env npx tsx
/**
 * Test First Pulse Across Models
 *
 * Compares how different narrator models respond to the opening prompt.
 *
 * Usage:
 *   pnpm test:first-pulse                    # Test all models
 *   pnpm test:first-pulse --model minimax    # Test specific model
 */

import { config } from "dotenv";
import { resolve } from "node:path";

// Load .env.local from project root
config({ path: resolve(process.cwd(), "../../.env.local") });
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { systemPrompt } from "@pulse/core/ai/prompts/system";
import { getStoryById } from "@pulse/core/ai/stories";

const MODELS = {
  "minimax-her": "minimax/minimax-m2-her",
  "minimax-m2.1": "minimax/minimax-m2.1",
  "deepseek-v3.2": "deepseek/deepseek-v3.2",
  "opus-4.5": "anthropic/claude-opus-4.5",
  "haiku-4.5": "anthropic/claude-haiku-4.5",
  "kimi-k2": "moonshotai/kimi-k2",
  "kimi-k2.5": "moonshotai/kimi-k2.5",
  "glm-4.7": "z-ai/glm-4.7",
  "mistral-creative": "mistralai/mistral-small-creative",
  "gemini-3-pro": "google/gemini-3-pro-preview",
} as const;

type ModelKey = keyof typeof MODELS;

const STORY_ID = "shadow-over-innsmouth";
const USER_MESSAGE = `Let's start the story "Shadow Over Innsmouth".`;

async function testModel(modelKey: ModelKey): Promise<{ model: string; output: string; time: number }> {
  const modelId = MODELS[modelKey];
  const story = getStoryById(STORY_ID);

  if (!story) {
    throw new Error(`Story not found: ${STORY_ID}`);
  }

  const system = systemPrompt({
    storyGuide: story.storyGuide,
    language: "english",
    solo: true, // Guest mode - skip character creation
  });

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Testing: ${modelKey} (${modelId})`);
  console.log(`${"─".repeat(60)}`);

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const startTime = Date.now();

  try {
    const result = await generateText({
      model: openrouter(modelId),
      system,
      messages: [{ role: "user", content: USER_MESSAGE }],
      maxOutputTokens: 500,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const output = result.text;

    console.log(`\nResponse (${elapsed}s):`);
    console.log(`\n${output}`);
    console.log(`\nTokens: ${result.usage?.totalTokens || "N/A"}`);

    return { model: modelKey, output, time: Number(elapsed) };
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n✗ Failed after ${elapsed}s:`, error instanceof Error ? error.message : error);
    return { model: modelKey, output: `ERROR: ${error}`, time: Number(elapsed) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const modelArg = args.find((a) => a.startsWith("--model="))?.split("=")[1] as ModelKey | undefined;

  console.log("═".repeat(60));
  console.log("First Pulse Test - Shadow Over Innsmouth");
  console.log("═".repeat(60));
  console.log(`\nUser message: "${USER_MESSAGE}"`);

  const results: Array<{ model: string; output: string; time: number }> = [];

  if (modelArg) {
    if (!MODELS[modelArg]) {
      console.error(`Unknown model: ${modelArg}`);
      console.error(`Available: ${Object.keys(MODELS).join(", ")}`);
      process.exit(1);
    }
    results.push(await testModel(modelArg));
  } else {
    // Test all models
    for (const key of Object.keys(MODELS) as ModelKey[]) {
      results.push(await testModel(key));
    }
  }

  // Summary
  console.log(`\n${"═".repeat(60)}`);
  console.log("Summary");
  console.log(`${"─".repeat(60)}`);

  for (const { model, output, time } of results) {
    const wordCount = output.split(/\s+/).length;
    const charCount = output.length;
    const isError = output.startsWith("ERROR:");

    console.log(`\n${model}:`);
    console.log(`  Time: ${time}s`);
    console.log(`  Length: ${charCount} chars, ~${wordCount} words`);
    if (!isError) {
      // First line preview
      const firstLine = output.split("\n")[0].slice(0, 80);
      console.log(`  Preview: ${firstLine}${firstLine.length >= 80 ? "..." : ""}`);
    }
  }

  console.log(`\n${"═".repeat(60)}`);
}

main().catch(console.error);
