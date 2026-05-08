#!/usr/bin/env npx tsx
/**
 * Test image generation speed across providers
 * Run with: npx tsx apps/web/scripts/test-image-speed.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import { fal } from "@fal-ai/client";
import { generateImagePrompt } from "../lib/ai/tools/generate-image";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from app first, then repo root as fallback.
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../../../.env.local") });

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;
const FAL_KEY = process.env.FAL_KEY;

if (FAL_KEY) {
  fal.config({ credentials: FAL_KEY });
}

// Test prompt - atmospheric horror scene
const TEST_PROMPT =
  "A foggy New England coastal town at dusk, decrepit Victorian buildings, gas lamps casting yellow light, ominous shadows, Lovecraftian atmosphere, cinematic lighting, photorealistic";

const GAME_PULSE = `The bus wheezes to a halt where the asphalt crumbles into weedy gravel, and the driver stares straight ahead, knuckles white on the wheel. Through the fog, a tilting signpost reads INNSMOUTH in flaking paint, while the letter in your pocket—your cousin's final, frantic scrawl—grows damp in the salt air. The cipher at its bottom, all shifting waves and lidless eyes, still tugs at your mind with meanings half-glimpsed. From the marsh beyond the roadside, a chorus of croaks rises, then falls into a silence deeper than the fog itself.

Do you step down into the mist, or demand the driver tell you why he won't look toward the town?`;

const shouldUseGamePrompt = process.argv.includes("--game-prompt");
const shouldRunFastOnly =
  process.argv.includes("--fast") || process.env.FAL_ONLY_FAST === "1";
const runId = String(Date.now());
const FAST_MODEL_NAMES = new Set([
  "fal/flux-schnell",
  "fal/imagen4-fast",
  "fal/seedream-v4",
  "replicate/flux-2-klein-4b",
]);

// Models to test
const MODELS = {
  ...(FAL_KEY
    ? {
        // Best current fal-hosted candidates
        "fal/nano-banana-2": {
          provider: "fal",
          model: "fal-ai/nano-banana-2",
          costPerImageUsd: 0.039,
          input: {
            aspect_ratio: "9:16",
            num_images: 1,
            output_format: "png",
            resolution: "1K",
            safety_tolerance: "4",
          },
        },
        "fal/nano-banana-pro": {
          provider: "fal",
          model: "fal-ai/nano-banana-pro",
          costPerImageUsd: 0.15,
          input: {
            aspect_ratio: "9:16",
            num_images: 1,
            output_format: "png",
            resolution: "1K",
            safety_tolerance: "4",
          },
        },
        "fal/openai-gpt-image-1.5-high": {
          provider: "fal",
          model: "fal-ai/gpt-image-1.5",
          costPerImageUsd: 0.2,
          input: {
            image_size: "1024x1536",
            quality: "high",
            num_images: 1,
            output_format: "png",
          },
        },
        "fal/openai-gpt-image-1.5-medium": {
          provider: "fal",
          model: "fal-ai/gpt-image-1.5",
          costPerImageUsd: 0.051,
          input: {
            image_size: "1024x1536",
            quality: "medium",
            num_images: 1,
            output_format: "png",
          },
        },
        "fal/flux-schnell": {
          provider: "fal",
          model: "fal-ai/flux/schnell",
          costPerImageUsd: 0.003,
          input: {
            image_size: "portrait_16_9",
            num_images: 1,
            output_format: "png",
          },
        },
        "fal/flux-2-pro": {
          provider: "fal",
          model: "fal-ai/flux-2-pro",
          costPerImageUsd: 0.04,
          input: {
            prompt: TEST_PROMPT,
            aspect_ratio: "9:16",
            num_images: 1,
            output_format: "png",
          },
        },
        "fal/flux-2-flex": {
          provider: "fal",
          model: "fal-ai/flux-2-flex",
          costPerImageUsd: 0.04,
          input: {
            prompt: TEST_PROMPT,
            aspect_ratio: "9:16",
            num_images: 1,
            output_format: "png",
          },
        },
        "fal/seedream-v4": {
          provider: "fal",
          model: "fal-ai/bytedance/seedream/v4/text-to-image",
          costPerImageUsd: 0.03,
          input: {
            image_size: "portrait_16_9",
            num_images: 1,
          },
        },
        "fal/imagen4-fast": {
          provider: "fal",
          model: "fal-ai/imagen4/preview/fast",
          costPerImageUsd: 0.02,
          input: {
            image_size: "portrait_16_9",
            num_images: 1,
          },
        },
      }
    : {}),
  ...(REPLICATE_API_TOKEN
    ? {
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
      }
    : {}),
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
  estimatedCostUsd?: number | null;
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
          const imagePath = resolve(OUTPUT_DIR, `${runId}-${safeName}.webp`);
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
    const imagePath = resolve(OUTPUT_DIR, `${runId}-${safeName}.webp`);
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

async function testFalModel(
  modelId: string,
  modelName: string,
  prompt: string,
  input: Record<string, unknown> = {}
): Promise<{ success: boolean; timeMs: number; error?: string; imagePath?: string }> {
  const startTime = performance.now();

  try {
    const result = await fal.subscribe(modelId, {
      input: {
        ...input,
        prompt,
      },
    });
    const endTime = performance.now();
    const data = result.data as {
      images?: Array<{
        url?: string;
        content_type?: string;
      }>;
    };
    const imageUrl = data.images?.[0]?.url;

    if (!imageUrl) {
      return {
        success: false,
        timeMs: endTime - startTime,
        error: "No image URL returned",
      };
    }

    const imgResponse = await fetch(imageUrl);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    const safeName = modelName.replace(/\//g, "-");
    const contentType = data.images?.[0]?.content_type || "image/png";
    const extension = contentType.includes("webp")
      ? "webp"
      : contentType.includes("jpeg")
        ? "jpg"
        : "png";
    const imagePath = resolve(OUTPUT_DIR, `${runId}-${safeName}.${extension}`);
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
  config: {
    provider: string;
    model: string;
    costPerImageUsd?: number | null;
    input?: Record<string, unknown>;
  },
  prompt: string
): Promise<TestResult> {
  console.log(`\n━━━ Testing: ${name} ━━━`);

  let result: { success: boolean; timeMs: number; error?: string; imagePath?: string };

  if (config.provider === "replicate") {
    result = await testReplicateModel(config.model, name, prompt);
  } else if (config.provider === "fal") {
    result = await testFalModel(config.model, name, prompt, config.input);
  } else if (config.provider === "fireworks") {
    result = await testFireworksModel(config.model, name, prompt);
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
    estimatedCostUsd: config.costPerImageUsd,
    error: result.error,
    imagePath: result.imagePath,
  };
}

async function main() {
  console.log("🖼️  Image Generation Speed Test");
  console.log("================================");
  const prompt = shouldUseGamePrompt
    ? await generateImagePrompt({
        storyId: "shadow-over-innsmouth",
        pulse: GAME_PULSE,
      })
    : TEST_PROMPT;

  console.log(`Prompt: "${prompt.slice(0, 120)}..."`);
  const modelsToRun = Object.entries(MODELS).filter(
    ([name]) => !shouldRunFastOnly || FAST_MODEL_NAMES.has(name)
  );

  console.log(`Models to test: ${modelsToRun.length}`);
  if (!FAL_KEY) console.log("FAL_KEY missing - skipping fal models");
  if (!REPLICATE_API_TOKEN) console.log("REPLICATE_API_TOKEN missing - skipping Replicate models");

  const results: TestResult[] = [];
  const outputDir = resolve(__dirname, "../../../test-results");
  mkdirSync(outputDir, { recursive: true });
  const startedAt = Number(runId);

  if (shouldUseGamePrompt) {
    writeFileSync(
      resolve(outputDir, `image-game-prompt-${startedAt}.txt`),
      prompt
    );
  }

  for (const [name, config] of modelsToRun) {
    const result = await runTest(name, config, prompt);
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
      `${medal} ${(r.totalTimeMs / 1000).toFixed(2)}s  ${r.model}  ${
        typeof r.estimatedCostUsd === "number"
          ? `$${r.estimatedCostUsd.toFixed(3)}/image`
          : "cost TBD"
      }`
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
  const outputPath = resolve(
    outputDir,
    `image-speed-${startedAt}.json`
  );
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to ${outputPath}`);
}

main().catch(console.error);
