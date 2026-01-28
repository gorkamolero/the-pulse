#!/usr/bin/env npx tsx
/**
 * Test all TTS providers - measures generation speed
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { lmnt } from "@ai-sdk/lmnt";
import { hume } from "@ai-sdk/hume";

// Load .env.local from apps/web
config({ path: resolve(import.meta.dirname, "../../../apps/web/.env.local") });

// Test text - typical narrator response
const TEST_TEXT = `The streetlamp above the Gilman House flickers like a dying fish, casting sickly yellow light across a sign that reads "Rooms, 75¢, Humanity Optional"; its hanging wooden door hangs half off its hinges, groaning as you push through.`;

interface TestResult {
  provider: string;
  model: string;
  totalTime: number;
  audioSize: number;
  error?: string;
}

// ElevenLabs test
async function testElevenLabs(): Promise<TestResult> {
  const model = "eleven_turbo_v2_5";
  const voiceId = "wLiYNWyRubh6yen1QNSU";

  console.log(`\n━━━ ElevenLabs (${model}) ━━━`);
  const start = performance.now();

  try {
    const { audio } = await generateSpeech({
      model: elevenlabs.speech(model),
      text: TEST_TEXT,
      voice: voiceId,
    });

    const totalTime = performance.now() - start;
    const audioSize = audio?.base64 ? Buffer.from(audio.base64, "base64").length : 0;

    console.log(`  Time: ${(totalTime / 1000).toFixed(2)}s | Size: ${(audioSize / 1024).toFixed(1)} KB`);
    return { provider: "ElevenLabs", model, totalTime, audioSize };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.log(`  ERROR: ${err}`);
    return { provider: "ElevenLabs", model, totalTime: 0, audioSize: 0, error: err };
  }
}

// LMNT test
async function testLMNT(): Promise<TestResult> {
  const model = "aurora";
  const voiceId = "45aba453-45ef-4fb2-9500-c80bfb6bd7cf";

  console.log(`\n━━━ LMNT (${model}) ━━━`);
  const start = performance.now();

  try {
    const { audio } = await generateSpeech({
      model: lmnt.speech(model),
      text: TEST_TEXT,
      voice: voiceId,
      providerOptions: { lmnt: { language: "en" } },
    });

    const totalTime = performance.now() - start;
    const audioSize = audio?.base64 ? Buffer.from(audio.base64, "base64").length : 0;

    console.log(`  Time: ${(totalTime / 1000).toFixed(2)}s | Size: ${(audioSize / 1024).toFixed(1)} KB`);
    return { provider: "LMNT", model, totalTime, audioSize };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.log(`  ERROR: ${err}`);
    return { provider: "LMNT", model, totalTime: 0, audioSize: 0, error: err };
  }
}

// Hume test
async function testHume(): Promise<TestResult> {
  const model = "hume";
  const voiceId = "f6e6b4d6-da66-4361-9eba-cbfd7686969b";

  console.log(`\n━━━ Hume (${voiceId}) ━━━`);
  const start = performance.now();

  try {
    const { audio } = await generateSpeech({
      model: hume.speech(),
      text: TEST_TEXT,
      voice: voiceId,
      providerOptions: {
        hume: { instructions: "A dramatic, atmospheric narrator with subtle tension." },
      },
    });

    const totalTime = performance.now() - start;
    const audioSize = audio?.base64 ? Buffer.from(audio.base64, "base64").length : 0;

    console.log(`  Time: ${(totalTime / 1000).toFixed(2)}s | Size: ${(audioSize / 1024).toFixed(1)} KB`);
    return { provider: "Hume", model, totalTime, audioSize };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.log(`  ERROR: ${err}`);
    return { provider: "Hume", model, totalTime: 0, audioSize: 0, error: err };
  }
}

// MiniMax test (custom API)
async function testMiniMax(): Promise<TestResult> {
  const model = "speech-02-turbo";
  const voiceId = "moss_audio_2cbba39e-fc59-11f0-b9f8-fe08218a7227";
  const apiKey = process.env.MINIMAX_API_KEY;

  console.log(`\n━━━ MiniMax (${model}) ━━━`);

  if (!apiKey) {
    console.log(`  SKIPPED: No MINIMAX_API_KEY`);
    return { provider: "MiniMax", model, totalTime: 0, audioSize: 0, error: "No API key" };
  }

  const start = performance.now();

  try {
    const response = await fetch("https://api.minimax.io/v1/t2a_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        text: TEST_TEXT,
        stream: false,
        language_boost: "auto",
        output_format: "hex",
        voice_setting: { voice_id: voiceId, speed: 1, vol: 1, pitch: 0 },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
      }),
    });

    if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);

    const result = await response.json();
    const hexAudio = result.data?.audio || result.audio_file;
    if (!hexAudio) throw new Error("No audio data");

    const totalTime = performance.now() - start;
    const audioSize = Buffer.from(hexAudio, "hex").length;

    console.log(`  Time: ${(totalTime / 1000).toFixed(2)}s | Size: ${(audioSize / 1024).toFixed(1)} KB`);
    return { provider: "MiniMax", model, totalTime, audioSize };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.log(`  ERROR: ${err}`);
    return { provider: "MiniMax", model, totalTime: 0, audioSize: 0, error: err };
  }
}

async function main() {
  console.log("🔊 TTS Provider Comparison");
  console.log("━".repeat(50));
  console.log(`Text: ${TEST_TEXT.length} chars\n`);

  // Run sequentially to see clear output
  const results = [
    await testElevenLabs(),
    await testLMNT(),
    await testHume(),
    await testMiniMax(),
  ];

  const successful = results.filter(r => !r.error);

  if (successful.length > 1) {
    console.log("\n\n📊 Summary (sorted by speed)");
    console.log("━".repeat(50));
    successful
      .sort((a, b) => a.totalTime - b.totalTime)
      .forEach((r, i) => {
        console.log(`${i + 1}. ${r.provider.padEnd(12)} ${(r.totalTime / 1000).toFixed(2)}s`);
      });
  }
}

main().catch(console.error);
