/**
 * TTS A/B Comparison Script
 * 
 * Compares MiniMax Speech-02-HD, Resemble Chatterbox, and Qwen3-TTS
 * with a passage from Shadow Over Innsmouth style narration.
 */

import Replicate from "replicate";
import fs from "node:fs/promises";
import path from "node:path";

const replicate = new Replicate();

// Test passage - atmospheric horror narration for The Pulse
const TEST_PASSAGE = `The fog rolled in from the harbor as you stepped off the bus, thick and grey like wet wool pressed against your face. Innsmouth lay before you, a town that time had forgotten and God had forsaken. The buildings leaned toward each other across narrow streets, as if whispering secrets too terrible to speak aloud. 

Somewhere in the mist, a church bell tolled—once, twice, then fell silent. The sound seemed to come from everywhere and nowhere, swallowed by the salt-heavy air. You clutched the letter in your pocket, the one that had drawn you here. "Come to Innsmouth," it said. "Learn what you truly are."

A figure watched from a darkened window. You couldn't see its face, but you felt its eyes—cold, ancient, patient. The sea had been waiting for you. And now, so had they.`;

// Narration voices to test
const VOICES = {
  minimax: {
    provider: "minimax/speech-02-hd",
    voices: [
      "English_CaptivatingStoryteller",
      "English_Deep-VoicedGentleman", 
      "English_WiseScholar",
      "English_ImposingManner",
    ]
  },
  chatterbox: {
    provider: "resemble-ai/chatterbox",
    settings: [
      { exaggeration: 0.3, cfg: 0.5, name: "calm" },
      { exaggeration: 0.6, cfg: 0.4, name: "dramatic" },
      { exaggeration: 0.8, cfg: 0.3, name: "intense" },
    ]
  }
};

async function generateMiniMax(text: string, voice: string): Promise<Buffer> {
  console.log(`[MiniMax] Generating with voice: ${voice}`);
  
  const output = await replicate.run("minimax/speech-02-hd", {
    input: {
      text,
      voice_id: voice,
    }
  });
  
  // Replicate returns a URL, fetch the audio
  const response = await fetch(output as string);
  return Buffer.from(await response.arrayBuffer());
}

async function generateChatterbox(
  text: string, 
  exaggeration: number, 
  cfg: number,
  referenceAudio?: string
): Promise<Buffer> {
  console.log(`[Chatterbox] Generating with exaggeration=${exaggeration}, cfg=${cfg}`);
  
  const input: Record<string, unknown> = {
    text,
    exaggeration,
    cfg_weight: cfg,
  };
  
  if (referenceAudio) {
    input.audio_prompt_path = referenceAudio;
  }
  
  const output = await replicate.run("resemble-ai/chatterbox", { input });
  
  const response = await fetch(output as string);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const outputDir = path.join(process.cwd(), "tts-comparison-output");
  await fs.mkdir(outputDir, { recursive: true });
  
  console.log("=== TTS A/B Comparison ===");
  console.log(`Test passage length: ${TEST_PASSAGE.length} chars\n`);
  
  // Generate MiniMax samples
  console.log("\n--- MiniMax Speech-02-HD ---");
  for (const voice of VOICES.minimax.voices) {
    try {
      const audio = await generateMiniMax(TEST_PASSAGE, voice);
      const filename = `minimax_${voice.toLowerCase().replace(/[^a-z0-9]/g, "_")}.mp3`;
      await fs.writeFile(path.join(outputDir, filename), audio);
      console.log(`✓ Saved: ${filename}`);
    } catch (error) {
      console.error(`✗ Failed: ${voice}`, error);
    }
  }
  
  // Generate Chatterbox samples
  console.log("\n--- Resemble AI Chatterbox ---");
  for (const setting of VOICES.chatterbox.settings) {
    try {
      const audio = await generateChatterbox(
        TEST_PASSAGE, 
        setting.exaggeration, 
        setting.cfg
      );
      const filename = `chatterbox_${setting.name}.mp3`;
      await fs.writeFile(path.join(outputDir, filename), audio);
      console.log(`✓ Saved: ${filename}`);
    } catch (error) {
      console.error(`✗ Failed: ${setting.name}`, error);
    }
  }
  
  console.log(`\n=== Output saved to: ${outputDir} ===`);
  console.log("\nFiles to evaluate:");
  const files = await fs.readdir(outputDir);
  files.forEach(f => console.log(`  - ${f}`));
}

main().catch(console.error);
