"use client";

import { useState, useEffect } from "react";

/**
 * Calculate perceived luminance from RGB values
 * Uses the relative luminance formula from WCAG 2.0
 * Returns 0-1 where 0 is black, 1 is white
 */
function getLuminance(r: number, g: number, b: number): number {
  // Convert to sRGB
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  // Relative luminance formula
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Sample colors from an image and calculate average luminance
 * Samples from multiple points to get a representative value
 */
async function getImageLuminance(imageUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(0.5); // Default to middle if no context
          return;
        }

        // Use a small sample size for performance
        const sampleSize = 50;
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        // Draw scaled-down image
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        // Get pixel data
        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;

        // Calculate average luminance
        let totalLuminance = 0;
        let pixelCount = 0;

        // Sample every 4th pixel for performance
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          totalLuminance += getLuminance(r, g, b);
          pixelCount++;
        }

        resolve(totalLuminance / pixelCount);
      } catch {
        resolve(0.5);
      }
    };

    img.onerror = () => {
      resolve(0.5); // Default on error
    };

    img.src = imageUrl;
  });
}

export type ImageTheme = "light" | "dark" | "unknown";

interface ImageLuminanceResult {
  /** The calculated luminance (0-1, where 0 is dark, 1 is light) */
  luminance: number;
  /** Whether the image is considered "light" or "dark" */
  theme: ImageTheme;
  /** Whether we're still loading/calculating */
  isLoading: boolean;
}

/**
 * Hook that calculates the luminance of an image and returns theme info
 * Useful for determining if text should be light or dark over an image
 *
 * @param imageUrl - URL of the image to analyze
 * @param threshold - Luminance threshold for light/dark (default 0.5)
 */
export function useImageLuminance(
  imageUrl: string | null | undefined,
  threshold = 0.5
): ImageLuminanceResult {
  const [luminance, setLuminance] = useState(0.5);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!imageUrl) {
      setLuminance(0.5);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    getImageLuminance(imageUrl)
      .then((lum) => {
        setLuminance(lum);
      })
      .catch(() => {
        setLuminance(0.5);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [imageUrl]);

  const theme: ImageTheme = isLoading
    ? "unknown"
    : luminance > threshold
      ? "light"
      : "dark";

  return {
    luminance,
    theme,
    isLoading,
  };
}
