#!/usr/bin/env npx tsx
/**
 * Download a narrator agent conversation's audio and transcript, picking the
 * conversation that started closest after a given time.
 *
 * Usage:
 *   npx tsx scripts/agent-conversation-audio.ts <agent-id> <after-unix-secs> <out-dir> [--key-from <project dir>]
 */

import { config as loadEnv, parse as parseEnv } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

for (const envFile of [".env.local", "../../.env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) loadEnv({ path: envPath, override: false });
}

const args = process.argv.slice(2);
const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const keyFrom = flag("--key-from");
const [agentId, afterSecs, outDir] = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));

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

const headers = { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "" };
const API = "https://api.elevenlabs.io/v1/convai/conversations";

const list = (await (await fetch(`${API}?agent_id=${agentId}&page_size=20`, { headers })).json()) as {
  conversations?: Array<{ conversation_id: string; start_time_unix_secs: number; call_duration_secs: number }>;
};
const after = Number(afterSecs);
const candidates = (list.conversations ?? [])
  .filter((c) => c.start_time_unix_secs >= after - 5)
  .sort((a, b) => a.start_time_unix_secs - b.start_time_unix_secs);
for (const c of list.conversations ?? []) {
  console.log(`conversation ${c.conversation_id} started ${new Date(c.start_time_unix_secs * 1000).toISOString()} for ${c.call_duration_secs}s`);
}
const pick = candidates[0];
if (!pick) {
  console.error("no conversation after that time");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const detail = await (await fetch(`${API}/${pick.conversation_id}`, { headers })).json();
writeFileSync(resolve(outDir, "conversation.json"), JSON.stringify(detail, null, 1));
const audio = await fetch(`${API}/${pick.conversation_id}/audio`, { headers });
if (!audio.ok) {
  console.error(`audio download failed (${audio.status}): ${await audio.text()}`);
  process.exit(1);
}
writeFileSync(resolve(outDir, "conversation-audio.mp3"), Buffer.from(await audio.arrayBuffer()));
console.log(`picked ${pick.conversation_id}, started ${pick.start_time_unix_secs} (${new Date(pick.start_time_unix_secs * 1000).toISOString()}), ${pick.call_duration_secs}s`);
