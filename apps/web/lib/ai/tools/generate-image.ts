import { generateText, experimental_generateImage } from "ai";
import { replicate } from "@ai-sdk/replicate";
import { getStoryById } from "@pulse/core/ai/stories";
import { TITLE_MODEL } from "@pulse/core/ai/models";
import { put } from "@vercel/blob";

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
}) {
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
