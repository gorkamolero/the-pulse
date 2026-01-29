#!/usr/bin/env node
/**
 * Generate story ambience using 11Labs Sound Effects API
 * Run with: npx tsx apps/web/scripts/generate-story-ambience.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
  console.error("❌ ELEVENLABS_API_KEY environment variable is required");
  process.exit(1);
}

interface AmbienceConfig {
  id: string;
  name: string;
  prompt: string;
  duration: number;
}

const storyAmbience: AmbienceConfig[] = [
  {
    id: "shadow-over-innsmouth-base",
    name: "Shadow Over Innsmouth",
    prompt: "Ocean waves lapping against weathered dock, distant foghorn, seagulls crying, salty wind, creaking wood, foggy atmosphere, desolate seaport ambience",
    duration: 30,
  },
  {
    id: "whispering-pines-forest",
    name: "Whispering Pines",
    prompt: "Wind whistling through pine trees, distant wolf howl, creaking wood, cold forest ambience, subtle eerie whispers, snow crunching, isolated cabin atmosphere",
    duration: 30,
  },
  {
    id: "hollow-choir-water",
    name: "The Hollow Choir",
    prompt: "Water lapping against ancient stone, distant melodic humming echoing in cathedral ruins, dripping water, submerged ambience, mysterious underwater atmosphere",
    duration: 30,
  },
  {
    id: "red-dust-wind",
    name: "Siren of the Red Dust",
    prompt: "Martian wind howling across red sand dunes, dust storm, distant machinery hum, desolate wasteland, low atmosphere rumble, sci-fi ambient texture",
    duration: 30,
  },
  {
    id: "endless-path-rain",
    name: "The Endless Path",
    prompt: "Heavy rain on cabin roof, thunder rumbling in distance, wind in pine trees, car engine ticking cooling down, distant radio static, time loop horror atmosphere",
    duration: 30,
  },
];

const outputDir = resolve(__dirname, "../public/audio/ambience");

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true });

async function generateAmbience(config: AmbienceConfig): Promise<void> {
  console.log(`\n🎵 Generating ambience for: ${config.name}`);
  console.log(`   Prompt: ${config.prompt.substring(0, 60)}...`);

  try {
    const response = await fetch(
      "https://api.elevenlabs.io/v1/sound-generation",
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: config.prompt,
          duration_seconds: config.duration,
          prompt_influence: 0.75,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const outputPath = resolve(outputDir, `${config.id}.mp3`);

    writeFileSync(outputPath, Buffer.from(audioBuffer));
    console.log(`   ✅ Saved to: ${outputPath}`);
    console.log(`   📊 Size: ${(audioBuffer.byteLength / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

async function main() {
  console.log("🎬 Story Ambience Generator");
  console.log(`📁 Output: ${outputDir}`);
  console.log(`🎚️  Duration: 30 seconds per ambience`);
  console.log(`💰 Cost: ~${storyAmbience.length * 30 * 40} credits (${storyAmbience.length * 30}s @ 40 credits/s)`);
  console.log("");

  const results = { success: 0, failed: 0 };

  for (const config of storyAmbience) {
    try {
      await generateAmbience(config);
      results.success++;
      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      results.failed++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("📊 Generation Complete");
  console.log(`   ✅ Success: ${results.success}/${storyAmbience.length}`);
  console.log(`   ❌ Failed: ${results.failed}/${storyAmbience.length}`);
  console.log("");
  console.log("💡 Usage:");
  console.log("   Files are saved to public/audio/ambience/");
  console.log("   They will be served automatically by Next.js");
  console.log("   Each story references its ambience in the story config");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
