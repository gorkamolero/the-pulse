import { generateText, experimental_generateImage } from "ai";
import { replicate } from "@ai-sdk/replicate";
import { getStoryById } from "../stories";
import { myProvider } from "../models";
import { put } from "@vercel/blob";

// Server action for generating images
export async function generatePulseImage({
  storyId,
  pulse,
  messageId,
}: {
  storyId: string;
  pulse: string;
  messageId: string;
}) {
  const story = getStoryById(storyId);

  try {
    // Generate image prompt using title-model
    const { text: imagePrompt } = await generateText({
      model: myProvider.languageModel("title-model"),
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

    // Generate image using Replicate model
    const { image } = await experimental_generateImage({
      model: replicate.image("black-forest-labs/flux-schnell"),
      prompt: imagePrompt,
    });

    console.log("[ImageGenerator]", "Image generation result:", {
      image: image ? "Image generated" : "No image",
      base64: image?.base64 ? "Base64 data available" : "No base64 data",
      prompt: imagePrompt,
    });

    // Check if image and base64 data exist before proceeding
    if (!image || !image.base64) {
      console.error(
        "[ImageGenerator]",
        "Image generation failed: No base64 data received"
      );
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

      console.log("[ImageGenerator]", "Image uploaded successfully:", {
        url,
        messageId,
        filename,
      });

      return { success: true, url };
    } catch (uploadError) {
      console.error(
        "[ImageGenerator]",
        "Error uploading image to Vercel Blob:",
        uploadError
      );
      return { success: false, error: "Failed to upload image to Vercel Blob" };
    }
  } catch (error) {
    console.error("[ImageGenerator]", "Error generating pulse image:", error);
    console.error(
      "[ImageGenerator]",
      "Error details:",
      JSON.stringify(error, null, 2)
    );
    return { success: false, error: "Failed to generate image" };
  }
}
