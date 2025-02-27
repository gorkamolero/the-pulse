import { useState, useEffect, useCallback } from "react";
import type { Message } from "ai";
import { generateSpeech, blobToAudio, Provider } from "@/lib/orate-service";

// Audio cache to prevent redundant API calls
const AudioCache = {
  cache: new Map<string, Blob>(),

  // Add an item to the cache
  set(messageId: string, audioBlob: Blob): void {
    console.log(
      `%c[AudioCache] STORING NEW AUDIO for message: ${messageId}`,
      "color: #4caf50; font-weight: bold"
    );
    this.cache.set(messageId, audioBlob);

    // Optionally persist to localStorage (only store message IDs, not the blobs)
    try {
      const cachedIds = JSON.parse(localStorage.getItem("audioCache") || "[]");
      if (!cachedIds.includes(messageId)) {
        cachedIds.push(messageId);
        localStorage.setItem("audioCache", JSON.stringify(cachedIds));
      }
    } catch (e) {
      console.error("[AudioCache] Error saving to localStorage:", e);
    }
  },

  // Get an item from the cache
  get(messageId: string): Blob | undefined {
    const cached = this.cache.get(messageId);
    if (cached) {
      console.log(
        `%c[AudioCache] CACHE HIT for message: ${messageId}`,
        "color: #2196f3; font-weight: bold"
      );
    } else {
      console.log(
        `%c[AudioCache] CACHE MISS for message: ${messageId}`,
        "color: #f44336; font-weight: bold"
      );
    }
    return cached;
  },

  // Check if an item exists in the cache
  has(messageId: string): boolean {
    return this.cache.has(messageId);
  },

  // Clear the entire cache
  clear(): void {
    console.log(
      "%c[AudioCache] CLEARING CACHE",
      "color: #ff9800; font-weight: bold"
    );
    this.cache.clear();
    try {
      localStorage.removeItem("audioCache");
    } catch (e) {
      console.error("[AudioCache] Error clearing localStorage:", e);
    }
  },

  // Get cache stats
  getStats(): { size: number; keys: string[] } {
    const stats = {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
    console.log(
      "%c[AudioCache] Current cache stats:",
      "color: #9c27b0; font-weight: bold",
      stats
    );
    return stats;
  },
};

// Global audio manager to prevent simultaneous playback
const AudioManager = {
  currentAudio: null as HTMLAudioElement | null,
  isPlaying: false,
  currentMessageId: null as string | null,
  pendingRequests: [] as Array<() => Promise<void>>,
  isProcessing: false,

  // Stop current audio playback
  stopPlayback() {
    if (!this.currentAudio) return;

    try {
      // Make sure to pause the audio
      this.currentAudio.pause();

      // Reset the audio element
      this.currentAudio.currentTime = 0;
      this.currentAudio.src = "";

      // Remove event listeners to prevent memory leaks
      this.currentAudio.onplay = null;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;

      this.currentAudio = null;
    } catch (error) {
      console.error("Error stopping audio playback:", error);
    }

    this.isPlaying = false;
    this.currentMessageId = null;
  },

  // Just pause the current audio without clearing it
  pausePlayback() {
    if (!this.currentAudio) return false;

    try {
      // Just pause the audio without resetting it
      this.currentAudio.pause();

      // Make sure to update the playing state
      this.isPlaying = false;

      // Dispatch a custom event to notify listeners that audio has been paused
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("audio-narration-paused"));
      }

      return true;
    } catch (error) {
      console.error("Error pausing audio playback:", error);
    }
    return false;
  },

  // Process the next item in the queue
  async processQueue() {
    if (this.isProcessing || this.pendingRequests.length === 0) return;

    this.isProcessing = true;
    try {
      const nextRequest = this.pendingRequests.shift();
      if (nextRequest) {
        await nextRequest();
      }
    } finally {
      this.isProcessing = false;
      // Check if there are more items to process
      if (this.pendingRequests.length > 0) {
        setTimeout(() => this.processQueue(), 300); // Small delay between requests
      }
    }
  },

  // Add a request to the queue and process it if possible
  queueRequest(request: () => Promise<void>) {
    this.pendingRequests.push(request);
    this.processQueue();
  },

  // Clear the queue
  clearQueue() {
    if (this.pendingRequests.length > 0) {
      console.log(
        `%c[AudioNarration] Clearing queue with ${this.pendingRequests.length} pending requests`,
        "color: #ff9800; font-weight: bold"
      );
      this.pendingRequests = [];
    }
  },
};

// Expose AudioManager and AudioCache to window for debugging and status indicator
if (typeof window !== "undefined") {
  window.AudioManager = AudioManager;
  // @ts-ignore - Add AudioCache to window for debugging
  window.AudioCache = AudioCache;
}

// Helper function to create an audio element from a blob
function createAudioFromBlob(blob: Blob): HTMLAudioElement {
  const audio = new Audio();
  audio.src = URL.createObjectURL(blob);
  return audio;
}

interface UseAudioNarrationOptions {
  autoPlay?: boolean;
  voiceId?: string;
  apiKey?: string;
  provider?: Provider;
}

export function useAudioNarration({
  autoPlay: initialAutoPlay = true,
  voiceId = "",
  apiKey,
  provider = "elevenlabs",
}: UseAudioNarrationOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(AudioManager.isPlaying);
  const [autoPlay, setAutoPlay] = useState(initialAutoPlay);
  const [error, setError] = useState<Error | null>(null);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(
    AudioManager.currentMessageId
  );

  // Clean up function to stop and release audio
  const cleanupAudio = useCallback(() => {
    if (!AudioManager.isPlaying && !AudioManager.currentAudio) {
      return; // Nothing to clean up
    }

    try {
      // First stop playback using the AudioManager
      AudioManager.stopPlayback();

      // Update local state
      setIsPlaying(false);
      setCurrentMessageId(null);

      // Dispatch a custom event to notify other components
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("audio-narration-paused"));
      }
    } catch (error) {
      console.error("Error in cleanupAudio:", error);
      // Force state updates even if there was an error
      setIsPlaying(false);
      setCurrentMessageId(null);
    }
  }, []);

  // Toggle auto-play functionality
  const toggleAutoPlay = useCallback(() => {
    setAutoPlay((prev) => !prev);
    if (isPlaying) {
      cleanupAudio();
      AudioManager.clearQueue(); // Clear any pending requests
    }
  }, [isPlaying, cleanupAudio]);

  // Stop speaking and clear queue
  const stopSpeaking = useCallback(() => {
    if (!AudioManager.isPlaying && !AudioManager.currentAudio) {
      return; // Nothing to stop
    }

    console.log(
      "%c[AudioNarration] Stopping audio playback",
      "color: #f44336; font-weight: bold"
    );

    try {
      // First try to pause the audio for immediate feedback
      AudioManager.pausePlayback();

      // Then clean up completely
      cleanupAudio();
      AudioManager.clearQueue();

      // Force update the state
      setIsPlaying(false);
      setCurrentMessageId(null);

      // Ensure the AudioManager state is updated
      AudioManager.isPlaying = false;
      AudioManager.currentMessageId = null;

      // If we still have an audio element, make sure it's paused
      if (AudioManager.currentAudio) {
        AudioManager.currentAudio.pause();
      }
    } catch (error) {
      console.error("Error in stopSpeaking:", error);
      // Force state updates even if there was an error
      setIsPlaying(false);
      setCurrentMessageId(null);
      AudioManager.isPlaying = false;
      AudioManager.currentMessageId = null;
    }
  }, [cleanupAudio]);

  // Play audio for a specific message
  const playAudio = useCallback(
    async (message: Message) => {
      if (!message.id || !message.content) {
        console.warn("[AudioNarration] Message has no ID or content");
        return;
      }

      // If already playing this message, do nothing
      if (
        AudioManager.isPlaying &&
        AudioManager.currentMessageId === message.id
      ) {
        console.log(
          `%c[AudioNarration] Already playing message: ${message.id}`,
          "color: #9c27b0; font-weight: bold"
        );
        return;
      }

      // If playing a different message, stop it first
      if (AudioManager.isPlaying) {
        AudioManager.stopPlayback();
      }

      // Create a cache key that includes the voice settings to ensure different voices get different cache entries
      const cacheKey = `${message.id}-${provider}-${voiceId}`;

      // Check if we have this audio in cache
      if (AudioCache.has(cacheKey)) {
        const playFromCache = async () => {
          try {
            const cachedBlob = AudioCache.get(cacheKey);
            if (!cachedBlob) return;

            console.log(
              `%c[AudioNarration] Playing cached audio for message: ${message.id} with voice: ${voiceId} (${provider})`,
              "color: #2196f3; font-weight: bold"
            );

            // Create audio element from cached blob
            const { audioElement } = blobToAudio(cachedBlob);

            // Set up the audio element
            AudioManager.currentAudio = audioElement;
            AudioManager.currentMessageId = message.id;
            AudioManager.isPlaying = true;

            // Update state
            setIsPlaying(true);
            setCurrentMessageId(message.id);

            // Set up event listeners
            audioElement.onplay = () => {
              setIsPlaying(true);
              // Dispatch a custom event to notify other components
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("audio-narration-playing", {
                    detail: { messageId: message.id },
                  })
                );
              }
            };

            audioElement.onended = () => {
              cleanupAudio();
            };

            // Play the audio
            await audioElement.play();
          } catch (error) {
            console.error(
              `[AudioNarration] Error playing cached audio for message ${message.id}:`,
              error
            );
            setError(error instanceof Error ? error : new Error(String(error)));
            cleanupAudio();
          }
        };

        AudioManager.queueRequest(playFromCache);
        return;
      }

      // If not in cache, generate new audio
      const generateAndPlay = async () => {
        try {
          console.log(
            `%c[AudioNarration] Generating new audio for message: ${message.id} with voice: ${voiceId} (${provider})`,
            "color: #4caf50; font-weight: bold"
          );

          // Generate speech with current voice settings
          const audioBlob = await generateSpeech(
            message.content,
            provider,
            voiceId
          );

          // Cache the audio blob with the voice-specific cache key
          AudioCache.set(cacheKey, audioBlob);

          // Create audio element
          const { audioElement } = blobToAudio(audioBlob);

          // Set up the audio element
          AudioManager.currentAudio = audioElement;
          AudioManager.currentMessageId = message.id;
          AudioManager.isPlaying = true;

          // Update state
          setIsPlaying(true);
          setCurrentMessageId(message.id);

          // Set up event listeners
          audioElement.onplay = () => {
            setIsPlaying(true);
            // Dispatch a custom event to notify other components
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("audio-narration-playing", {
                  detail: { messageId: message.id },
                })
              );
            }
          };

          audioElement.onended = () => {
            cleanupAudio();
          };

          // Play the audio
          await audioElement.play();
        } catch (error) {
          console.error(
            `[AudioNarration] Error generating audio for message ${message.id}:`,
            error
          );
          setError(error instanceof Error ? error : new Error(String(error)));
          cleanupAudio();
        }
      };

      AudioManager.queueRequest(generateAndPlay);
    },
    [provider, voiceId, cleanupAudio]
  );

  // Sync local state with AudioManager state and listen for pause events
  useEffect(() => {
    const syncState = () => {
      setIsPlaying(AudioManager.isPlaying);
      setCurrentMessageId(AudioManager.currentMessageId);
    };

    // Initial sync
    syncState();

    // Set up interval to sync state
    const intervalId = setInterval(syncState, 500);

    // Listen for custom pause events
    const handlePauseEvent = () => {
      console.log("Received audio-narration-paused event");
      setIsPlaying(false);
      if (currentMessageId) {
        setCurrentMessageId(null);
      }
    };

    // Add event listener
    if (typeof window !== "undefined") {
      window.addEventListener("audio-narration-paused", handlePauseEvent);
    }

    return () => {
      clearInterval(intervalId);
      // Remove event listener
      if (typeof window !== "undefined") {
        window.removeEventListener("audio-narration-paused", handlePauseEvent);
      }
    };
  }, [currentMessageId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    isPlaying,
    autoPlay,
    toggleAutoPlay,
    playAudio,
    stopSpeaking,
    clearAudioCache: () => AudioCache.clear(),
    currentMessageId,
    error,
  };
}
