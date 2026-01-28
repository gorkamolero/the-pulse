#!/usr/bin/env npx tsx
/**
 * Test TTS model speed - measures time to generate audio
 */

import { config } from "dotenv";
import { resolve } from "node:path";

// Load .env.local from apps/web
config({ path: resolve(import.meta.dirname, "../../../apps/web/.env.local") });

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY");
  process.exit(1);
}

// Test text - typical narrator response
const TEST_TEXT = `The streetlamp above the Gilman House flickers like a dying fish, casting sickly yellow light across a sign that reads "Rooms, 75¢, Humanity Optional"; its hanging wooden door hangs half off its hinges, groaning as you push through. Inside, the lobby breathes clotted air—maggoty wallpaper depicting screaming gulls peels in sheets, and a dented brass bell rests on the front desk beside an open register smeared with damp, mucous fingerprints.`;

// ElevenLabs models to test
const MODELS = {
  "eleven_v3": "eleven_v3",
  "eleven_turbo_v2_5": "eleven_turbo_v2_5",
  "eleven_flash_v2_5": "eleven_flash_v2_5",
  "eleven_multilingual_v2": "eleven_multilingual_v2",
};

// Default voice
const VOICE_ID = "wLiYNWyRubh6yen1QNSU";

async function testModel(modelKey: string, modelId: string) {
  console.log(`\n━━━ Testing: ${modelKey} ━━━`);

  const startTime = performance.now();

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text: TEST_TEXT,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${response.status}: ${error}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Estimate audio duration (rough: MP3 at 128kbps ≈ 16KB/sec)
    const audioSizeKB = audioBuffer.byteLength / 1024;
    const estimatedDurationSec = audioSizeKB / 16;

    console.log(`  Total time:     ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`  Audio size:     ${audioSizeKB.toFixed(1)} KB`);
    console.log(`  Est. duration:  ~${estimatedDurationSec.toFixed(1)}s`);
    console.log(`  Realtime ratio: ${(estimatedDurationSec / (totalTime / 1000)).toFixed(2)}x`);

    return {
      model: modelKey,
      totalTime,
      audioSize: audioBuffer.byteLength,
      estimatedDuration: estimatedDurationSec,
      realtimeRatio: estimatedDurationSec / (totalTime / 1000),
    };
  } catch (error) {
    console.error(`  ERROR: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const modelArg = args.find((a) => a.startsWith("--model="))?.split("=")[1];

  console.log("🔊 TTS Speed Test");
  console.log("━".repeat(50));
  console.log(`Text length: ${TEST_TEXT.length} chars`);
  console.log(`Voice: ${VOICE_ID}`);

  const modelsToTest = modelArg
    ? { [modelArg]: MODELS[modelArg as keyof typeof MODELS] || modelArg }
    : MODELS;

  const results: Array<NonNullable<Awaited<ReturnType<typeof testModel>>>> = [];

  for (const [key, id] of Object.entries(modelsToTest)) {
    const result = await testModel(key, id);
    if (result) results.push(result);
  }

  if (results.length > 1) {
    console.log("\n\n📊 Summary (sorted by speed)");
    console.log("━".repeat(50));
    results
      .sort((a, b) => a.totalTime - b.totalTime)
      .forEach((r, i) => {
        console.log(
          `${i + 1}. ${r.model.padEnd(25)} ${(r.totalTime / 1000).toFixed(2)}s  (${r.realtimeRatio.toFixed(2)}x realtime)`
        );
      });
  }
}

main().catch(console.error);
