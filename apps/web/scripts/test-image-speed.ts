#!/usr/bin/env npx tsx
/**
 * Test image generation speed across providers
 * Run with: npx tsx apps/web/scripts/test-image-speed.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
config({ path: resolve(__dirname, "../../../.env.local") });

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;

if (!REPLICATE_API_TOKEN) {
  console.error("Missing REPLICATE_API_TOKEN");
  process.exit(1);
}

// Test prompt - atmospheric horror scene
const TEST_PROMPT =
  "A foggy New England coastal town at dusk, decrepit Victorian buildings, gas lamps casting yellow light, ominous shadows, Lovecraftian atmosphere, cinematic lighting, photorealistic";

// Models to test
const MODELS = {
  // Flux 2 models (newest)
  "replicate/flux-2-klein-4b": {
    provider: "replicate",
    model: "black-forest-labs/flux-2-klein-4b",
  },
  "replicate/flux-2-dev": {
    provider: "replicate",
    model: "black-forest-labs/flux-2-dev",
  },
  "replicate/flux-2-pro": {
    provider: "replicate",
    model: "black-forest-labs/flux-2-pro",
  },
  // Flux 1 models
  "replicate/flux-schnell": {
    provider: "replicate",
    model: "black-forest-labs/flux-schnell",
  },
  "replicate/flux-1.1-pro": {
    provider: "replicate",
    model: "black-forest-labs/flux-1.1-pro",
  },
  // Fireworks models
  ...(FIREWORKS_API_KEY
    ? {
        "fireworks/flux-1-schnell": {
          provider: "fireworks",
          model: "accounts/fireworks/models/flux-1-schnell-fp8",
        },
        "fireworks/flux-1-dev": {
          provider: "fireworks",
          model: "accounts/fireworks/models/flux-1-dev-fp8",
        },
      }
    : {}),
};

interface TestResult {
  model: string;
  provider: string;
  totalTimeMs: number;
  success: boolean;
  error?: string;
  imagePath?: string;
}

// Output directory for images
const OUTPUT_DIR = resolve(__dirname, "../../../test-results/images");
mkdirSync(OUTPUT_DIR, { recursive: true });

async function testReplicateModel(
  modelId: string,
  modelName: string,
  prompt: string
): Promise<{ success: boolean; timeMs: number; error?: string; imagePath?: string }> {
  const startTime = performance.now();

  try {
    // Use the models endpoint for official models (no version hash)
    const hasVersion = modelId.includes(":");
    const endpoint = hasVersion
      ? "https://api.replicate.com/v1/predictions"
      : `https://api.replicate.com/v1/models/${modelId}/predictions`;

    const body = hasVersion
      ? {
          version: modelId.split(":")[1],
          input: { prompt, aspect_ratio: "9:16", num_outputs: 1 },
        }
      : {
          input: { prompt, aspect_ratio: "9:16", num_outputs: 1 },
        };

    // Create prediction
    const createResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait", // Wait for result instead of polling
      },
      body: JSON.stringify(body),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      return { success: false, timeMs: 0, error: `Create failed: ${error}` };
    }

    const prediction = await createResponse.json();
    let status = prediction.status;
    let result = prediction;

    // Poll for completion
    while (status === "starting" || status === "processing") {
      await new Promise((r) => setTimeout(r, 500));
      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
        }
      );
      result = await pollResponse.json();
      status = result.status;
    }

    const endTime = performance.now();

    if (status === "succeeded" && result.output) {
      // Download and save the image
      const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      if (imageUrl) {
        try {
          const imgResponse = await fetch(imageUrl);
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
          const safeName = modelName.replace(/\//g, "-");
          const imagePath = resolve(OUTPUT_DIR, `${safeName}.webp`);
          writeFileSync(imagePath, imgBuffer);
          return { success: true, timeMs: endTime - startTime, imagePath };
        } catch {
          return { success: true, timeMs: endTime - startTime };
        }
      }
      return { success: true, timeMs: endTime - startTime };
    } else {
      return {
        success: false,
        timeMs: endTime - startTime,
        error: result.error || status,
      };
    }
  } catch (err) {
    return {
      success: false,
      timeMs: performance.now() - startTime,
      error: String(err),
    };
  }
}

async function testFireworksModel(
  modelId: string,
  modelName: string,
  prompt: string
): Promise<{ success: boolean; timeMs: number; error?: string; imagePath?: string }> {
  const startTime = performance.now();

  try {
    // Extract model name for endpoint
    const modelSlug = modelId.split("/").pop();
    const response = await fetch(
      `https://api.fireworks.ai/inference/v1/workflows/${modelId}/text_to_image`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIREWORKS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: "9:16",
          num_inference_steps: modelSlug?.includes("schnell") ? 4 : 28,
          guidance_scale: modelSlug?.includes("schnell") ? 0 : 3.5,
        }),
      }
    );

    const endTime = performance.now();

    if (!response.ok) {
      const error = await response.text();
      return { success: false, timeMs: endTime - startTime, error };
    }

    // Save the image
    const imgBuffer = Buffer.from(await response.arrayBuffer());
    const safeName = modelName.replace(/\//g, "-");
    const imagePath = resolve(OUTPUT_DIR, `${safeName}.webp`);
    writeFileSync(imagePath, imgBuffer);

    return { success: true, timeMs: endTime - startTime, imagePath };
  } catch (err) {
    return {
      success: false,
      timeMs: performance.now() - startTime,
      error: String(err),
    };
  }
}

async function runTest(
  name: string,
  config: { provider: string; model: string }
): Promise<TestResult> {
  console.log(`\n━━━ Testing: ${name} ━━━`);

  let result: { success: boolean; timeMs: number; error?: string; imagePath?: string };

  if (config.provider === "replicate") {
    result = await testReplicateModel(config.model, name, TEST_PROMPT);
  } else if (config.provider === "fireworks") {
    result = await testFireworksModel(config.model, name, TEST_PROMPT);
  } else {
    result = { success: false, timeMs: 0, error: "Unknown provider" };
  }

  if (result.success) {
    console.log(`  ✓ Time: ${(result.timeMs / 1000).toFixed(2)}s`);
    if (result.imagePath) {
      console.log(`  📷 Saved: ${result.imagePath}`);
    }
  } else {
    console.log(`  ✗ Failed: ${result.error}`);
  }

  return {
    model: name,
    provider: config.provider,
    totalTimeMs: result.timeMs,
    success: result.success,
    error: result.error,
    imagePath: result.imagePath,
  };
}

async function main() {
  console.log("🖼️  Image Generation Speed Test");
  console.log("================================");
  console.log(`Prompt: "${TEST_PROMPT.slice(0, 50)}..."`);
  console.log(`Models to test: ${Object.keys(MODELS).length}`);

  const results: TestResult[] = [];

  for (const [name, config] of Object.entries(MODELS)) {
    const result = await runTest(name, config);
    results.push(result);
  }

  // Sort by speed
  const successful = results
    .filter((r) => r.success)
    .sort((a, b) => a.totalTimeMs - b.totalTimeMs);

  console.log("\n\n📊 RESULTS (fastest to slowest)");
  console.log("================================");

  for (let i = 0; i < successful.length; i++) {
    const r = successful[i];
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
    console.log(
      `${medal} ${(r.totalTimeMs / 1000).toFixed(2)}s  ${r.model}`
    );
  }

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    console.log("\n❌ Failed:");
    for (const r of failed) {
      console.log(`   ${r.model}: ${r.error}`);
    }
  }

  // Save results
  const outputDir = resolve(__dirname, "../../../test-results");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(
    outputDir,
    `image-speed-${Date.now()}.json`
  );
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to ${outputPath}`);
}

main().catch(console.error);
