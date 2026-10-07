#!/usr/bin/env npx tsx
/**
 * Create an ElevenLabs agent that narrates a story by voice, using the game's
 * own solo narrator prompt and story guide.
 *
 * Usage:
 *   npx tsx scripts/create-narrator-agent.ts [story-id] [--group] [--key-from <project dir>] [--update <agent-id>]
 *
 * --group builds the group narrator (asks for players and names first) instead of solo.
 *
 * --key-from takes ELEVENLABS_API_KEY from another project's env files instead,
 * for when this project's key lacks the agents write permission.
 */

import { config as loadEnv, parse as parseEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { systemPrompt } from "@pulse/core/ai/prompts/system";
import { getNarratorConfig, getStoryById, DEFAULT_STORY_ID } from "@pulse/core/ai/stories";

for (const envFile of [".env.local", "../../.env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

const args = process.argv.slice(2);
const keyFrom = args.includes("--key-from") ? args[args.indexOf("--key-from") + 1] : undefined;
const updateId = args.includes("--update") ? args[args.indexOf("--update") + 1] : undefined;
const solo = !args.includes("--group");
const positional = args.filter((arg, i) => !arg.startsWith("--") && !["--key-from", "--update"].includes(args[i - 1] ?? ""));

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

const API = "https://api.elevenlabs.io/v1";
const TTS_MODEL = "eleven_v4_turbo";
const WANTED_LLM = /^claude-sonnet-5[-.]5/;

// Spoken turns need tighter rules than the text game
const VOICE_RULES = `# Voice
You are speaking out loud. Every word you write is spoken in real time by the narrator's voice.
- Each turn is 2-3 short sentences, never more. This overrides any length guidance below. This step is important.
- Plain spoken prose only: no markdown, lists, headings, emojis or stage directions.
- End each turn on a beat that invites the player to act or answer.

`;

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }
  const headers = { "xi-api-key": apiKey, "Content-Type": "application/json" };

  const storyId = positional[0] ?? DEFAULT_STORY_ID;
  const story = getStoryById(storyId);
  if (!story) {
    throw new Error(`Unknown story: ${storyId}`);
  }
  const { voiceId } = getNarratorConfig(storyId);

  // Pick Claude Sonnet 5.5 from the agents LLM catalog
  const catalogRes = await fetch(`${API}/convai/llm/list`, { headers });
  if (!catalogRes.ok) {
    throw new Error(`LLM list failed (${catalogRes.status}): ${await catalogRes.text()}`);
  }
  const catalog = JSON.stringify(await catalogRes.json());
  const llmIds = [...new Set([...catalog.matchAll(/"(claude-[a-z0-9.-]+)"/g)].map((m) => m[1]))];
  const llm = llmIds.find((id) => WANTED_LLM.test(id));
  if (!llm) {
    console.error(`Claude Sonnet 5.5 is not in the agents catalog. Claude models offered: ${llmIds.join(", ")}`);
    process.exit(1);
  }

  const body = {
    name: `The Pulse — ${story.title}${solo ? "" : " (group)"}`,
    conversation_config: {
      agent: {
        // Empty: the game opens the story itself when the player presses Begin
        first_message: "",
        language: "en",
        prompt: {
          prompt: VOICE_RULES + systemPrompt({ storyGuide: story.storyGuide, language: "english", solo }),
          llm,
        },
      },
      tts: { voice_id: voiceId, model_id: TTS_MODEL, agent_output_audio_format: "pcm_44100" },
      // Typed play: never prompt the player for silence, and allow long sessions
      turn: { turn_timeout: -1 },
      conversation: { max_duration_seconds: 3600 },
    },
  };

  const res = await fetch(updateId ? `${API}/convai/agents/${updateId}` : `${API}/convai/agents/create`, {
    method: updateId ? "PATCH" : "POST",
    headers,
    body: JSON.stringify(body),
  });
  const result = (await res.json().catch(() => ({}))) as { agent_id?: string };
  result.agent_id ??= updateId;
  if (!res.ok || !result.agent_id) {
    console.error(`Create failed (${res.status}): ${JSON.stringify(result, null, 2)}`);
    process.exit(1);
  }

  console.log(`Agent: ${body.name}`);
  console.log(`LLM: ${llm} | voice: ${voiceId} | TTS: ${TTS_MODEL}`);
  console.log(`Agent ID: ${result.agent_id}`);
  console.log(`Talk to it: https://elevenlabs.io/app/talk-to?agent_id=${result.agent_id}`);
  console.log(`Edit it: https://elevenlabs.io/app/agents/agents/${result.agent_id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
