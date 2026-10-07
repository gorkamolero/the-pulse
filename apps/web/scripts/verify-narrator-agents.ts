#!/usr/bin/env npx tsx
/**
 * Check each narrator agent's stored prompt, voice and models against what the game's narrator gets.
 *
 * Usage:
 *   npx tsx scripts/verify-narrator-agents.ts [--key-from <project dir>]
 */

import { config as loadEnv, parse as parseEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { systemPrompt } from "@pulse/core/ai/prompts/system";
import { getNarratorConfig, getStoryById, stories } from "@pulse/core/ai/stories";
import { getNarratorAgentId } from "../lib/ai/narrator-agents";

for (const envFile of [".env.local", "../../.env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) loadEnv({ path: envPath, override: false });
}
const args = process.argv.slice(2);
const keyFrom = args.includes("--key-from") ? args[args.indexOf("--key-from") + 1] : undefined;
if (keyFrom) {
  for (const envFile of [".env.local", ".env", "api/.env"]) {
    const envPath = resolve(process.cwd(), keyFrom, envFile);
    const key = existsSync(envPath) ? parseEnv(readFileSync(envPath)).ELEVENLABS_API_KEY : undefined;
    if (key) {
      process.env.ELEVENLABS_API_KEY = key;
      break;
    }
  }
}

const VOICE_RULES = readFileSync(resolve(process.cwd(), "scripts/create-narrator-agent.ts"), "utf8").match(/const VOICE_RULES = `([\s\S]*?)`;/)?.[1] ?? "";

for (const { id } of stories) {
  const story = getStoryById(id)!;
  const agentId = getNarratorAgentId(id);
  if (!agentId) {
    console.log(`${story.title}: NO AGENT`);
    continue;
  }
  const agent = (await (await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" },
  })).json()) as any;
  const cc = agent.conversation_config ?? {};
  const stored: string = cc.agent?.prompt?.prompt ?? "";
  const expected = VOICE_RULES + systemPrompt({ storyGuide: story.storyGuide, language: "english", solo: true });
  const guideOpening = story.storyGuide.trim().slice(0, 60);
  console.log(`${story.title} (${agentId}):`,
    stored === expected ? "prompt matches the game exactly" : `PROMPT DIFFERS (stored ${stored.length} vs expected ${expected.length} chars)`,
    `| guide inside: ${stored.includes(story.storyGuide.trim()) ? "yes" : "NO"}`,
    `| voice ${cc.tts?.voice_id === getNarratorConfig(id).voiceId ? "ok" : "WRONG"}`,
    `| ${cc.agent?.prompt?.llm} / ${cc.tts?.model_id} / ${cc.tts?.agent_output_audio_format}`,
    `| ${stored.length} chars | guide starts: "${guideOpening.replace(/\s+/g, " ")}…"`);
}
