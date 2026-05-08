#!/usr/bin/env npx tsx
/**
 * Test TTS Providers
 *
 * Usage:
 *   pnpm test:tts                      # Test default provider
 *   pnpm test:tts --provider minimax   # Test MiniMax
 *   pnpm test:tts --provider elevenlabs # Test ElevenLabs
 *   pnpm test:tts --provider hume      # Test Hume
 *   pnpm test:tts --provider lmnt      # Test LMNT
 *   pnpm test:tts --all                # Test all available providers
 *   pnpm test:tts --elevenlabs-models  # Compare ElevenLabs model speeds
 *   pnpm test:tts --elevenlabs-tuning  # Compare ElevenLabs narration settings
 */

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  ElevenLabsProvider,
  getTTSProvider,
  getDefaultVoiceId,
  isProviderAvailable,
  type TTSProvider,
} from "../lib/ai/tts";
import { writeFileSync } from "node:fs";

for (const envFile of [".env.local", "../../.env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false });
  }
}

const TEST_TEXT =
  "The humid Massachusetts air carries the distinct scent of salt and rot as your creaking automobile rolls to the cusp of a neglected causeway. Below you, swathed in a perpetual coastal fog, lies the sprawl of Innsmouth—a crooked silhouette of sagging gambrel roofs and crumbling docks against the grey Atlantic. Your map, cryptic and annotated with frantic handwriting, lies open on the passenger seat beside the weathered letter that lured you here. The lone road into town beckons, winding downward into the mist.";

const ALL_PROVIDERS: TTSProvider[] = ["elevenlabs", "minimax", "hume", "lmnt"];
const ELEVENLABS_MODELS = [
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
  "eleven_v3",
] as const;
const ELEVENLABS_TUNING_PRESETS = [
  {
    name: "default",
    model: "eleven_turbo_v2_5",
  },
  {
    name: "steadier",
    model: "eleven_turbo_v2_5",
    speed: 1.08,
    elevenLabsVoiceSettings: {
      stability: 0.65,
      similarityBoost: 0.78,
      style: 0.12,
      useSpeakerBoost: true,
    },
  },
  {
    name: "less-theatrical",
    model: "eleven_turbo_v2_5",
    speed: 1.12,
    elevenLabsVoiceSettings: {
      stability: 0.75,
      similarityBoost: 0.7,
      style: 0.05,
      useSpeakerBoost: false,
    },
  },
  {
    name: "flash-steady",
    model: "eleven_flash_v2_5",
    speed: 1.08,
    elevenLabsVoiceSettings: {
      stability: 0.7,
      similarityBoost: 0.75,
      style: 0.08,
      useSpeakerBoost: true,
    },
  },
] as const;

async function testProvider(providerName: TTSProvider): Promise<boolean> {
  console.log(`\nTesting ${providerName.toUpperCase()} TTS Provider`);
  console.log("─".repeat(50));

  // Check if provider is available
  if (!isProviderAvailable(providerName)) {
    console.log(`⊘ Skipped: No API key configured`);
    console.log(`  Set ${providerName.toUpperCase()}_API_KEY in .env.local`);
    return false;
  }

  try {
    const provider = getTTSProvider(providerName);
    const voiceId = getDefaultVoiceId(providerName);

    console.log(`Voice ID: ${voiceId}`);
    console.log(`Text: "${TEST_TEXT.slice(0, 50)}..."`);
    console.log("\nGenerating speech...");

    const startTime = Date.now();
    const result = await provider.generateSpeech({
      text: TEST_TEXT,
      voiceId,
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Calculate audio size
    const audioBuffer = Buffer.from(result.audioBase64, "base64");
    const sizeKB = (audioBuffer.length / 1024).toFixed(1);

    console.log(`✓ Success in ${elapsed}s`);
    console.log(`  Content-Type: ${result.contentType}`);
    console.log(`  Audio size: ${sizeKB} KB`);

    // Save to file for verification
    const filename = `test-${providerName}.mp3`;
    writeFileSync(filename, audioBuffer);
    console.log(`  Saved to: ${filename}`);

    return true;
  } catch (error) {
    console.error(
      `✗ Failed: ${error instanceof Error ? error.message : error}`
    );
    return false;
  }
}

async function testElevenLabsModel(model: string): Promise<{
  model: string;
  success: boolean;
  elapsedMs?: number;
  sizeKB?: number;
  error?: string;
}> {
  const voiceId = getDefaultVoiceId("elevenlabs");
  const provider = new ElevenLabsProvider(model);

  console.log(`\nTesting ElevenLabs model: ${model}`);
  console.log("─".repeat(50));
  console.log(`Voice ID: ${voiceId}`);
  console.log(`Text: "${TEST_TEXT.slice(0, 50)}..."`);
  console.log("Generating speech...");

  const startTime = performance.now();

  try {
    const result = await provider.generateSpeech({
      text: TEST_TEXT,
      voiceId,
    });
    const elapsedMs = performance.now() - startTime;
    const audioBuffer = Buffer.from(result.audioBase64, "base64");
    const sizeKB = audioBuffer.length / 1024;
    const filename = `test-elevenlabs-${model}.mp3`;

    writeFileSync(filename, audioBuffer);

    console.log(`✓ Success in ${(elapsedMs / 1000).toFixed(2)}s`);
    console.log(`  Content-Type: ${result.contentType}`);
    console.log(`  Audio size: ${sizeKB.toFixed(1)} KB`);
    console.log(`  Saved to: ${filename}`);

    return {
      model,
      success: true,
      elapsedMs,
      sizeKB,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Failed: ${message}`);
    return {
      model,
      success: false,
      error: message,
    };
  }
}

async function testElevenLabsModels() {
  console.log("═".repeat(50));
  console.log("ElevenLabs Model Speed Test");
  console.log("═".repeat(50));

  if (!isProviderAvailable("elevenlabs")) {
    console.log("⊘ Skipped: No ELEVENLABS_API_KEY configured");
    return;
  }

  const results = [];

  for (const model of ELEVENLABS_MODELS) {
    results.push(await testElevenLabsModel(model));
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log("ElevenLabs Model Summary");
  console.log("─".repeat(50));
  console.log("Model".padEnd(22), "Status".padEnd(12), "Time".padEnd(8), "Size");

  for (const result of results) {
    const status = result.success ? "✓ Pass" : "✗ Fail";
    const time = result.elapsedMs ? `${(result.elapsedMs / 1000).toFixed(2)}s` : "—";
    const size = result.sizeKB ? `${result.sizeKB.toFixed(1)} KB` : "—";
    console.log(result.model.padEnd(22), status.padEnd(12), time.padEnd(8), size);
  }

  console.log("═".repeat(50));
}

async function testElevenLabsTuning() {
  console.log("═".repeat(50));
  console.log("ElevenLabs Narration Tuning Test");
  console.log("═".repeat(50));

  if (!isProviderAvailable("elevenlabs")) {
    console.log("⊘ Skipped: No ELEVENLABS_API_KEY configured");
    return;
  }

  const voiceId = getDefaultVoiceId("elevenlabs");
  const results = [];

  for (const preset of ELEVENLABS_TUNING_PRESETS) {
    const provider = new ElevenLabsProvider(preset.model);

    console.log(`\nTesting preset: ${preset.name}`);
    console.log("─".repeat(50));
    console.log(`Model: ${preset.model}`);
    console.log(`Voice ID: ${voiceId}`);

    const startTime = performance.now();

    try {
      const result = await provider.generateSpeech({
        text: TEST_TEXT,
        voiceId,
        speed: "speed" in preset ? preset.speed : undefined,
        elevenLabsVoiceSettings:
          "elevenLabsVoiceSettings" in preset
            ? preset.elevenLabsVoiceSettings
            : undefined,
      });
      const elapsedMs = performance.now() - startTime;
      const audioBuffer = Buffer.from(result.audioBase64, "base64");
      const filename = `test-elevenlabs-tuning-${preset.name}.mp3`;

      writeFileSync(filename, audioBuffer);

      results.push({
        name: preset.name,
        model: preset.model,
        success: true,
        elapsedMs,
        sizeKB: audioBuffer.length / 1024,
        filename,
      });

      console.log(`✓ Success in ${(elapsedMs / 1000).toFixed(2)}s`);
      console.log(`  Saved to: ${filename}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: preset.name,
        model: preset.model,
        success: false,
        error: message,
      });
      console.error(`✗ Failed: ${message}`);
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log("ElevenLabs Tuning Summary");
  console.log("─".repeat(50));
  console.log("Preset".padEnd(18), "Model".padEnd(20), "Status".padEnd(10), "Time".padEnd(8), "Size");

  for (const result of results) {
    const status = result.success ? "✓ Pass" : "✗ Fail";
    const time = result.elapsedMs ? `${(result.elapsedMs / 1000).toFixed(2)}s` : "—";
    const size = result.sizeKB ? `${result.sizeKB.toFixed(1)} KB` : "—";
    console.log(result.name.padEnd(18), result.model.padEnd(20), status.padEnd(10), time.padEnd(8), size);
  }

  console.log("═".repeat(50));
}

async function main() {
  const args = process.argv.slice(2);
  const providerArg = args
    .find((a) => a.startsWith("--provider="))
    ?.split("=")[1] as TTSProvider | undefined;
  const testAll = args.includes("--all");
  const testElevenLabsModelSpeeds = args.includes("--elevenlabs-models");
  const testElevenLabsTuningPresets = args.includes("--elevenlabs-tuning");

  if (testElevenLabsModelSpeeds) {
    await testElevenLabsModels();
    return;
  }

  if (testElevenLabsTuningPresets) {
    await testElevenLabsTuning();
    return;
  }

  console.log("═".repeat(50));
  console.log("TTS Provider Test Suite");
  console.log("═".repeat(50));

  const results: Record<string, boolean> = {};

  if (testAll) {
    // Test all providers
    for (const provider of ALL_PROVIDERS) {
      results[provider] = await testProvider(provider);
    }
  } else if (providerArg) {
    // Test specific provider
    results[providerArg] = await testProvider(providerArg);
  } else {
    // Test default provider from env
    const defaultProvider =
      (process.env.TTS_PROVIDER as TTSProvider) || "elevenlabs";
    results[defaultProvider] = await testProvider(defaultProvider);
  }

  // Summary
  console.log(`\n${"═".repeat(50)}`);
  console.log("Summary");
  console.log("─".repeat(50));

  for (const [provider, success] of Object.entries(results)) {
    const status = success ? "✓ Pass" : "✗ Fail/Skip";
    console.log(`  ${provider.padEnd(12)} ${status}`);
  }

  console.log("═".repeat(50));
}

main().catch(console.error);
