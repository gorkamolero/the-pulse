import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { z } from "zod";

/**
 * Example function to get a recipe using OpenRouter
 * @param modelName The OpenRouter model ID to use
 * @returns AI stream response with a recipe
 */
export const getRecipe = async (modelName: string) => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY || "",
  });

  const result = await streamText({
    model: openrouter(modelName),
    prompt: "Write a vegetarian lasagna recipe for 4 people.",
  });

  return result.toDataStreamResponse();
};

/**
 * Example function to get weather information using OpenRouter with tools
 * @param modelName The OpenRouter model ID to use
 * @param location The location to get weather for
 * @returns AI stream response with weather information
 */
export const getWeather = async (
  modelName: string,
  location: string = "San Francisco, CA"
) => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY || "",
  });

  const result = await streamText({
    model: openrouter(modelName),
    prompt: `What is the weather in ${location} in Fahrenheit?`,
    tools: {
      getCurrentWeather: {
        description: "Get the current weather in a given location",
        parameters: z.object({
          location: z
            .string()
            .describe("The city and state, e.g. San Francisco, CA"),
          unit: z.enum(["celsius", "fahrenheit"]).optional(),
        }),
        execute: async ({
          location,
          unit = "celsius",
        }: {
          location: string;
          unit?: "celsius" | "fahrenheit";
        }) => {
          // Mock response for the weather
          // In a real implementation, this would call a weather API
          const weatherData: Record<
            string,
            { celsius: string; fahrenheit: string }
          > = {
            "Boston, MA": {
              celsius: "15°C",
              fahrenheit: "59°F",
            },
            "San Francisco, CA": {
              celsius: "18°C",
              fahrenheit: "64°F",
            },
            "New York, NY": {
              celsius: "12°C",
              fahrenheit: "54°F",
            },
            "Los Angeles, CA": {
              celsius: "22°C",
              fahrenheit: "72°F",
            },
          };

          const weather = weatherData[location];
          if (!weather) {
            return `Weather data for ${location} is not available.`;
          }

          return `The current weather in ${location} is ${weather[unit]}.`;
        },
      },
    },
  });

  return result.toDataStreamResponse();
};

/**
 * Example function to use OpenRouter for code generation with tools
 * @param modelName The OpenRouter model ID to use
 * @param prompt The coding prompt
 * @returns AI stream response with generated code
 */
export const generateCode = async (modelName: string, prompt: string) => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY || "",
  });

  const result = await streamText({
    model: openrouter(modelName),
    prompt: prompt,
    tools: {
      searchDocumentation: {
        description:
          "Search documentation for a specific programming language or framework",
        parameters: z.object({
          language: z
            .string()
            .describe("The programming language or framework to search for"),
          query: z
            .string()
            .describe("The specific topic or function to search for"),
        }),
        execute: async ({
          language,
          query,
        }: {
          language: string;
          query: string;
        }) => {
          // Mock documentation search
          // In a real implementation, this would query documentation APIs
          return `Found documentation for ${query} in ${language}. Here's a sample usage...`;
        },
      },
    },
  });

  return result.toDataStreamResponse();
};
