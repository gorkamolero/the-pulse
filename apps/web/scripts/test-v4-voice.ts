#!/usr/bin/env npx tsx
/**
 * Generate one narration line through the ElevenLabs provider (v4 Turbo over the
 * Text to Dialogue socket) and report audio size, word timings or the error.
 *
 * Usage:
 *   npx tsx scripts/test-v4-voice.ts
 */

import { config as loadEnv } from "dotenv";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

for (const envFile of [".env.local", "../../.env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

const { ElevenLabsProvider } = await import("../lib/ai/tts/elevenlabs-provider");

const text =
  process.argv[2] ??
  "The fog clings to the harbour like wet wool. Somewhere past the breakwater, a bell rings once, though no ship is out tonight.";

const started = Date.now();
try {
  const result = await new ElevenLabsProvider().generateSpeech({ text, voiceId: "wLiYNWyRubh6yen1QNSU" });
  const audio = Buffer.from(result.audioBase64, "base64");
  writeFileSync("v4-voice-test.mp3", audio);
  console.log(`ok in ${Date.now() - started} ms: ${audio.length} bytes, ${result.wordTimings?.length ?? 0} word timings`);
  console.log(JSON.stringify(result.wordTimings?.slice(0, 4)));
} catch (error) {
  console.error(`failed after ${Date.now() - started} ms:`, error instanceof Error ? error.message : error);
}
