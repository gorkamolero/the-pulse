import type { StoryTypography } from "@pulse/core/ai/stories";

// Track which fonts have been loaded to avoid duplicates
const loadedFonts = new Set<string>();

/**
 * Dynamically load a Google Font when needed
 * Uses the CSS Font Loading API for efficient loading
 */
export async function loadStoryFont(
  typography: StoryTypography
): Promise<void> {
  const { fontFamily, weights = ["400", "600"] } = typography;

  // Already loaded? Skip
  if (loadedFonts.has(fontFamily)) {
    return;
  }

  // Build Google Fonts URL
  const weightsParam = weights.join(";");
  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@${weightsParam}&display=swap`;

  // Create and inject link element
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = fontUrl;

  // Wait for font to actually load
  return new Promise((resolve, reject) => {
    link.onload = () => {
      loadedFonts.add(fontFamily);

      // Use Font Loading API to ensure font is ready
      if ("fonts" in document) {
        document.fonts.ready.then(() => resolve());
      } else {
        resolve();
      }
    };
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

/**
 * Apply story typography to the document via CSS custom properties
 */
export function applyStoryTypography(typography: StoryTypography): void {
  const { fontFamily, fallback, fontSize, lineHeight, letterSpacing } = typography;
  const root = document.documentElement;

  root.style.setProperty("--font-story", `"${fontFamily}", ${fallback}`);
  root.style.setProperty("--font-story-size", `${fontSize ?? 1.1}rem`);
  root.style.setProperty("--font-story-line-height", `${lineHeight ?? 1.8}`);
  root.style.setProperty("--font-story-letter-spacing", `${letterSpacing ?? 0.01}em`);
}

/**
 * Reset to default typography
 */
export function resetStoryTypography(): void {
  const root = document.documentElement;
  root.style.removeProperty("--font-story");
  root.style.removeProperty("--font-story-size");
  root.style.removeProperty("--font-story-line-height");
  root.style.removeProperty("--font-story-letter-spacing");
}

/**
 * Load and apply story typography in one call
 * Non-blocking - applies immediately with fallback, font swaps in when ready
 */
export async function initStoryTypography(
  typography: StoryTypography | undefined
): Promise<void> {
  if (!typography) {
    resetStoryTypography();
    return;
  }

  // Apply immediately with fallback (font-display: swap behavior)
  applyStoryTypography(typography);

  // Load the actual font in background
  try {
    await loadStoryFont(typography);
  } catch (error) {
    console.warn(`Failed to load font "${typography.fontFamily}":`, error);
    // Fallback is already applied, so graceful degradation
  }
}
