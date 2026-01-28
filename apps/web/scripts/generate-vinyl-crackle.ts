/**
 * Generate vinyl crackle ambient audio using ElevenLabs Sound Effects API
 * Run with: npx tsx apps/web/scripts/generate-vinyl-crackle.ts
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envApiKey = process.env.ELEVENLABS_API_KEY;

if (!envApiKey) {
  console.error("ELEVENLABS_API_KEY environment variable is required");
  process.exit(1);
}

const ELEVENLABS_API_KEY = envApiKey;

async function generateVinylCrackle() {
  console.log("Generating vinyl crackle ambient audio...");

  const response = await fetch(
    "https://api.elevenlabs.io/v1/sound-generation",
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "Subtle vinyl record crackle and pops, warm analog texture, gentle background ambiance with soft static hiss, nostalgic lo-fi atmosphere",
        duration_seconds: 30,
        prompt_influence: 0.8,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to generate audio:", error);
    process.exit(1);
  }

  const audioBuffer = await response.arrayBuffer();
  const outputPath = resolve(
    __dirname,
    "../public/audio/vinyl-crackle.mp3"
  );

  writeFileSync(outputPath, Buffer.from(audioBuffer));
  console.log(`✓ Saved vinyl crackle to ${outputPath}`);
  console.log(
    "  This 30s loop can be played continuously with seamless looping"
  );
}

generateVinylCrackle().catch(console.error);
