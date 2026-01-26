/**
 * Model and voice configuration for The Pulse
 * Uses Vercel AI Gateway for models, ElevenLabs for TTS
 */

// ============================================================================
// Narrator Model Configuration
// ============================================================================

/** Default narrator model when story doesn't specify */
export const DEFAULT_NARRATOR_MODEL = "deepseek/deepseek-v3.2-thinking";

/** Model for generating chat titles */
export const TITLE_MODEL = "google/gemini-2.5-flash-lite";

// ============================================================================
// Voice Configuration (ElevenLabs only)
// ============================================================================

/** Default voice ID when story doesn't specify */
export const DEFAULT_VOICE_ID = "qNkzaJoHLLdpvgh5tISm"; // Carter

/** ElevenLabs voice catalog */
export const VOICES = [
  {
    id: "qNkzaJoHLLdpvgh5tISm",
    name: "Carter the Mountain King",
    description: "Rich, smooth, & rugged",
  },
  {
    id: "uVKHymY7OYMd6OailpG5",
    name: "Frederick",
    description: "Old Gnarly Narrator",
  },
  {
    id: "dAcds2QMcvmv86jQMC3Y",
    name: "Jayce",
    description: "The Gangster",
  },
  {
    id: "flHkNRp1BlvT73UL6gyz",
    name: "Jessica Anne Bogart",
    description: "Smooth female voice",
  },
  {
    id: "0dPqNXnhg2bmxQv1WKDp",
    name: "Grandpa Oxley",
    description: "Wise elder voice",
  },
  {
    id: "tiCdiJK6pzWPIV4PqAPp",
    name: "Innsmouth Narrator",
    description: "Shadow Over Innsmouth voice",
  },
] as const;

/** Type for voice IDs */
export type VoiceId = (typeof VOICES)[number]["id"];
