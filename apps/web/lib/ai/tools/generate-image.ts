import { generateText, experimental_generateImage } from "ai";
import { replicate } from "@ai-sdk/replicate";
import { fal } from "@fal-ai/client";
import { getStoryById } from "@pulse/core/ai/stories";
import { TITLE_MODEL } from "@pulse/core/ai/models";
import { put } from "@vercel/blob";

type ImageProvider = "fal" | "replicate";

type ImageModel =
  | "nano-banana"
  | "nano-banana-2"
  | "gpt-image-1.5"
  | "gpt-image-2"
  | "flux-schnell"
  | "flux-2-klein-4b";

type FalImageResult = {
  images?: Array<{
    url?: string;
    content_type?: string;
    file_name?: string;
  }>;
};

type ImageGenerationResult =
  | { success: true; url: string }
  | { success: false; error: string };

const FAL_MODEL_IDS: Record<Exclude<ImageModel, "flux-2-klein-4b">, string> = {
  "nano-banana": "fal-ai/nano-banana",
  "nano-banana-2": "fal-ai/nano-banana-2",
  "gpt-image-1.5": "fal-ai/gpt-image-1.5",
  "gpt-image-2": "openai/gpt-image-2",
  "flux-schnell": "fal-ai/flux/schnell",
};

const getImageProvider = (): ImageProvider =>
  process.env.IMAGE_PROVIDER === "replicate" ? "replicate" : "fal";

const getImageModel = (): ImageModel => {
  const model = process.env.IMAGE_MODEL;

  if (
    model === "nano-banana" ||
    model === "nano-banana-2" ||
    model === "gpt-image-1.5" ||
    model === "gpt-image-2" ||
    model === "flux-schnell" ||
    model === "flux-2-klein-4b"
  ) {
    return model;
  }

  return "flux-schnell";
};

function getFalInput(model: ImageModel, prompt: string) {
  if (model === "gpt-image-1.5") {
    return {
      prompt,
      image_size: "1024x1536",
      quality: "high",
      num_images: 1,
      output_format: "png",
    };
  }

  if (model === "gpt-image-2") {
    return {
      prompt,
      image_size: "portrait_16_9",
      quality: "high",
      num_images: 1,
      output_format: "png",
    };
  }

  if (model === "flux-schnell") {
    return {
      prompt,
      image_size: "portrait_16_9",
      num_images: 1,
      output_format: "png",
    };
  }

  return {
    prompt,
    aspect_ratio: "9:16",
    num_images: 1,
    output_format: "png",
    safety_tolerance: "4",
    resolution: "1K",
  };
}

async function uploadImageUrl({
  imageUrl,
  messageId,
  contentType = "image/png",
}: {
  imageUrl: string;
  messageId: string;
  contentType?: string;
}): Promise<ImageGenerationResult> {
  const imageResponse = await fetch(imageUrl);

  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch generated image: ${imageResponse.status}`);
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const extension = contentType.includes("webp")
    ? "webp"
    : contentType.includes("jpeg")
      ? "jpg"
      : "png";
  const filename = `pulse-image-${messageId}.${extension}`;
  const { url } = await put(filename, buffer, {
    contentType,
    access: "public",
  });

  return { success: true, url };
}

/**
 * Generate an image prompt from scene text.
 * This can be called early (after ~150 chars) to get a head start on image generation.
 */
export async function generateImagePrompt({
  storyId,
  pulse,
}: {
  storyId: string;
  pulse: string;
}): Promise<string> {
  const story = getStoryById(storyId);

  const { text: imagePrompt } = await generateText({
    model: TITLE_MODEL,
    prompt: `You are creating a prompt for an AI image generator that will visualize a moment from an interactive story.

Story Title: "${story?.title || "Interactive Story"}"
Story Context: "${story?.description || "An immersive narrative experience"}"
Current Scene: "${pulse}"

Create a detailed visual prompt that captures:
1. The most striking visual moment or element from this scene
2. The exact setting, including lighting, weather, and environmental details
3. Any key objects, artifacts, or symbols that appear
4. The emotional atmosphere and mood (e.g., dread, wonder, tension)
5. Any characters present and their emotional states
6. Artistic style that best suits this moment (photorealistic, painterly, cinematic, etc.). Choose a specific artist for the story.

Your prompt should be vivid, atmospheric, and focused on visual elements only.
Emphasize sensory details that create a strong visual impact.
DO NOT include any story instructions or narrative elements.
Keep your prompt under 75 words.

Make this prompt in English.

Visual Prompt:`,
  });

  return imagePrompt;
}

/**
 * Generate an image from a pre-generated prompt.
 * This allows us to generate the prompt early and the image later.
 */
export async function generateImageFromPrompt({
  imagePrompt,
  messageId,
}: {
  imagePrompt: string;
  messageId: string;
}): Promise<ImageGenerationResult> {
  const provider = getImageProvider();
  const model = getImageModel();

  if (provider === "fal" && model !== "flux-2-klein-4b") {
    const falKey = process.env.FAL_KEY;

    if (!falKey) {
      return { success: false, error: "FAL_KEY is not configured" };
    }

    fal.config({ credentials: falKey });

    try {
      const result = await fal.subscribe(FAL_MODEL_IDS[model], {
        input: getFalInput(model, imagePrompt),
      });
      const data = result.data as FalImageResult;
      const generatedImage = data.images?.[0];

      if (!generatedImage?.url) {
        return { success: false, error: "No image URL received from fal" };
      }

      return await uploadImageUrl({
        imageUrl: generatedImage.url,
        messageId,
        contentType: generatedImage.content_type,
      });
    } catch (error) {
      console.error("fal image generation failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "fal image generation failed",
      };
    }
  }

  // Generate image using Flux 2 Klein 4B - fastest + cheapest option
  // Speed: 0.78s | Cost: ~$0.0006/image | Quality: Excellent
  const { image } = await experimental_generateImage({
    model: replicate.image("black-forest-labs/flux-2-klein-4b"),
    prompt: imagePrompt,
    aspectRatio: "9:16",
  });

  console.log("Image generation result:", {
    image: image ? "Image generated" : "No image",
    base64: image?.base64 ? "Base64 data available" : "No base64 data",
    prompt: imagePrompt,
  });

  // Check if image and base64 data exist before proceeding
  if (!image || !image.base64) {
    console.error("Image generation failed: No base64 data received");
      return { success: false, error: "No image data received" };
  }

  // Upload the image to Vercel Blob
  try {
    // Use the message ID for the filename
    const filename = `pulse-image-${messageId}.png`;

    // Convert base64 to buffer
    const buffer = Buffer.from(image.base64, "base64");

    // Upload to Vercel Blob
    const { url } = await put(filename, buffer, {
      contentType: "image/png",
      access: "public",
    });

    return { success: true, url };
  } catch (uploadError) {
    console.error("Error uploading image to Vercel Blob:", uploadError);
    return { success: false, error: "Failed to upload image to Vercel Blob" };
  }
}

/**
 * Full image generation (prompt + image) in one call.
 * Used when we don't need to parallelize.
 */
export async function generatePulseImage({
  storyId,
  pulse,
  messageId,
}: {
  storyId: string;
  pulse: string;
  messageId: string;
}) {
  try {
    const imagePrompt = await generateImagePrompt({ storyId, pulse });
    return await generateImageFromPrompt({ imagePrompt, messageId });
  } catch (error) {
    console.error("Error generating pulse image:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return { success: false, error: "Failed to generate image" };
  }
}
