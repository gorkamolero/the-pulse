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
 */

import {
  getTTSProvider,
  getDefaultVoiceId,
  isProviderAvailable,
  type TTSProvider,
} from "../lib/ai/tts";
import { writeFileSync } from "node:fs";

const TEST_TEXT =
  "The fog rolls in from the harbor, thick and cold. Something stirs in the darkness beyond.";

const ALL_PROVIDERS: TTSProvider[] = ["elevenlabs", "minimax", "hume", "lmnt"];

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

async function main() {
  const args = process.argv.slice(2);
  const providerArg = args
    .find((a) => a.startsWith("--provider="))
    ?.split("=")[1] as TTSProvider | undefined;
  const testAll = args.includes("--all");

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
