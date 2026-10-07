#!/usr/bin/env npx tsx
/**
 * Read or patch a narrator agent's config.
 *
 * Usage:
 *   npx tsx scripts/narrator-agent-config.ts <agent-id> [--key-from <project dir>] [--patch '<json>']
 */

import { config as loadEnv, parse as parseEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const envFile of [".env.local", "../../.env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const keyFrom = flag("--key-from");
const patch = flag("--patch");
const agentId = args.find((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));

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

const headers = { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "Content-Type": "application/json" };
const url = `https://api.elevenlabs.io/v1/convai/agents/${agentId}`;

if (patch) {
  const res = await fetch(url, { method: "PATCH", headers, body: patch });
  console.log(`PATCH ${res.status}`, res.ok ? "" : await res.text());
}
const res = await fetch(url, { headers });
const agent = (await res.json()) as Record<string, any>;
const cc = agent.conversation_config ?? {};
console.log(JSON.stringify({
  first_message: cc.agent?.first_message,
  llm: cc.agent?.prompt?.llm,
  tts: { model: cc.tts?.model_id, voice: cc.tts?.voice_id, format: cc.tts?.agent_output_audio_format },
  turn: cc.turn,
  conversation: cc.conversation,
  auth: agent.platform_settings?.auth,
  overrides: agent.platform_settings?.overrides,
  call_limits: agent.platform_settings?.call_limits,
}, null, 1));
