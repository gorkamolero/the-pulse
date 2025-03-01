import { generateText, tool, experimental_generateImage } from "ai";
import { replicate } from "@ai-sdk/replicate";
import { getStoryById } from "../stories";
import { z } from "zod";
import { myProvider } from "../models";

export const generateImage = ({ storyId, context }: { storyId: string, context?: string }) => {
  const story = getStoryById(storyId);

  return tool({
    description: 'Generate an image for a story pulse. Call this after generating a complete pulse.',
    parameters: z.object({
      pulse: z.string().describe('The complete pulse text that was just generated'),
    }),
    execute: async ({ pulse }) => {
      try {
        // Generate image prompt using title-model
        const { text: imagePrompt } = await generateText({
          model: myProvider.languageModel('title-model'),
          prompt: `You are creating a prompt for an AI image generator that will visualize a moment from an interactive story.

Story Title: "${story?.title || 'Interactive Story'}"
Story Context: "${story?.description || 'An immersive narrative experience'}"
Current Scene: "${pulse ?? context}"

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

Visual Prompt:`
        });
        
        // Generate image using Fireworks model
        const { image } = await experimental_generateImage({
          model: replicate.image('black-forest-labs/flux-schnell'),
          prompt: imagePrompt,
        });

        console.log('Image generation result:', {
          image,
          base64: image?.base64,
          prompt: imagePrompt
        });

        // Check if image and base64 data exist before writing to dataStream
        if (!image || !image.base64) {
          console.error('Image generation failed: No base64 data received');
          return { success: false, error: 'No image data received' };
        }

        return { 
          success: true,
          imageBase64: image.base64,
          prompt: imagePrompt
        };
      } catch (error) {
        console.error('Error generating pulse image:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return { success: false, error: 'Failed to generate image' };
      }
    },
  })
  
  
}
