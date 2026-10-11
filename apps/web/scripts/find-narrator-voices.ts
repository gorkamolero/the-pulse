#!/usr/bin/env npx tsx
/**
 * Find and audition narrator voices: list the account's voices, search the ElevenLabs
 * voice library, add a library voice to the account, and render a v4 Turbo sample.
 *
 * Usage:
 *   npx tsx scripts/find-narrator-voices.ts mine [--key-from <project dir>]
 *   npx tsx scripts/find-narrator-voices.ts info <voice-id>
 *   npx tsx scripts/find-narrator-voices.ts search [--query <text>] [--gender male|female] [--age <age>]
 *       [--accent <accent>] [--use-case narrative_story] [--descriptives a,b] [--category professional] [--pages 2] [--json]
 *   npx tsx scripts/find-narrator-voices.ts add <public-owner-id> <voice-id> <name>
 *   npx tsx scripts/find-narrator-voices.ts remove <voice-id>
 *   npx tsx scripts/find-narrator-voices.ts sample <voice-id> <out.mp3> <text>
 *   npx tsx scripts/find-narrator-voices.ts slots
 *   npx tsx scripts/find-narrator-voices.ts transcribe <file.mp3> [--model scribe_v1]
 *
 * --key-from takes ELEVENLABS_API_KEY from another project's env files.
 */

import { config as loadEnv, parse as parseEnv } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
const positional = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));
const [command, ...rest] = positional;

const API = "https://api.elevenlabs.io";
const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  throw new Error("ELEVENLABS_API_KEY is not set");
}
const headers = { "xi-api-key": apiKey, "Content-Type": "application/json" };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

type Labels = Record<string, string | undefined>;
type AccountVoice = {
  voice_id: string;
  name: string;
  category: string;
  labels?: Labels;
  description?: string | null;
  sharing?: { public_owner_id?: string; original_voice_id?: string } | null;
  high_quality_base_model_ids?: string[];
};
type LibraryVoice = {
  public_owner_id: string;
  voice_id: string;
  name: string;
  accent?: string;
  gender?: string;
  age?: string;
  descriptive?: string;
  use_case?: string;
  category?: string;
  description?: string;
  cloned_by_count?: number;
  usage_character_count_1y?: number;
  rate?: number;
  free_users_allowed?: boolean;
  verified_languages?: Array<{ language: string; model_id?: string; accent?: string }>;
};

async function main() {
  switch (command) {
    case "mine": {
      const { voices } = await get<{ voices: AccountVoice[] }>("/v2/voices?page_size=100");
      for (const v of voices) {
        const labels = Object.values(v.labels ?? {}).filter(Boolean).join(", ");
        console.log(`${v.voice_id}  ${v.name}  [${v.category}]  ${labels}`);
      }
      break;
    }
    case "info": {
      const v = await get<AccountVoice>(`/v1/voices/${rest[0]}`);
      console.log(JSON.stringify({ ...v, samples: undefined, fine_tuning: undefined }, null, 2).slice(0, 3000));
      break;
    }
    case "slots": {
      const sub = await get<Record<string, unknown>>("/v1/user/subscription");
      const pick = ["tier", "voice_slots_used", "voice_limit", "professional_voice_slots_used", "character_count", "character_limit"];
      console.log(Object.fromEntries(pick.map((k) => [k, sub[k]])));
      break;
    }
    case "search": {
      const params = new URLSearchParams({ page_size: "100", language: "en" });
      const map: Record<string, string> = {
        "--query": "search",
        "--gender": "gender",
        "--age": "age",
        "--accent": "accent",
        "--category": "category",
        "--use-case": "use_cases",
        "--descriptives": "descriptives",
      };
      for (const [name, param] of Object.entries(map)) {
        const value = flag(name);
        if (value) params.set(param, value);
      }
      const pages = Number(flag("--pages") ?? 1);
      const found: LibraryVoice[] = [];
      for (let page = 0; page < pages; page++) {
        params.set("page", String(page));
        const { voices, has_more } = await get<{ voices: LibraryVoice[]; has_more: boolean }>(
          `/v1/shared-voices?${params}`
        );
        found.push(...voices);
        if (!has_more) break;
      }
      found.sort((a, b) => (b.usage_character_count_1y ?? 0) - (a.usage_character_count_1y ?? 0));
      if (args.includes("--json")) {
        console.log(JSON.stringify(found));
        break;
      }
      for (const v of found) {
        const models = [...new Set((v.verified_languages ?? []).map((l) => l.model_id).filter(Boolean))].join("/");
        console.log(
          [
            `${v.name} | ${v.voice_id} | owner ${v.public_owner_id}`,
            `   ${v.category} · ${v.gender} · ${v.age} · ${v.accent} · ${v.descriptive} · ${v.use_case} · used ${(
              (v.usage_character_count_1y ?? 0) / 1e6
            ).toFixed(1)}M chars/yr · cloned ${v.cloned_by_count} · rate ${v.rate ?? 1} · models ${models}`,
            `   ${(v.description ?? "").replace(/\s+/g, " ").slice(0, 220)}`,
          ].join("\n")
        );
      }
      break;
    }
    case "add": {
      const [ownerId, voiceId, name] = rest;
      const res = await fetch(`${API}/v1/voices/add/${ownerId}/${voiceId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ new_name: name }),
      });
      console.log(res.status, (await res.text()).slice(0, 300));
      break;
    }
    case "remove": {
      // Takes a library voice back out of the account (it stays in the public library)
      const res = await fetch(`${API}/v1/voices/${rest[0]}`, { method: "DELETE", headers });
      console.log(res.status, (await res.text()).slice(0, 200));
      break;
    }
    case "sample": {
      const [voiceId, out, text] = rest;
      const { ElevenLabsProvider } = await import("../lib/ai/tts/elevenlabs-provider");
      const started = Date.now();
      const result = await new ElevenLabsProvider().generateSpeech({ text, voiceId });
      writeFileSync(out, Buffer.from(result.audioBase64, "base64"));
      console.log(`${out}: ${Date.now() - started} ms, ${result.wordTimings?.length ?? 0} word timings`);
      break;
    }
    case "transcribe": {
      const form = new FormData();
      form.append("model_id", flag("--model") ?? "scribe_v1");
      form.append("file", new Blob([readFileSync(rest[0])], { type: "audio/mpeg" }), "sample.mp3");
      const res = await fetch(`${API}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": apiKey }, body: form });
      const result = (await res.json()) as { text?: string; detail?: unknown };
      console.log(args.includes("--json") ? JSON.stringify(result) : (result.text ?? JSON.stringify(result.detail)));
      break;
    }
    default:
      console.error("Commands: mine, info, slots, search, add, remove, sample, transcribe");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
