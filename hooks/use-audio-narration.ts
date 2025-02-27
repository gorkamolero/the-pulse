import { useState, useEffect, useCallback } from "react";
import { textToSpeech, DEFAULT_VOICE_ID } from "@/lib/elevenlabs";
import type { Message } from "ai";

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
}

export function useAudioNarration({
  autoPlay: initialAutoPlay = true,
  voiceId = DEFAULT_VOICE_ID,
  apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
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

  // Function to actually play the audio
  const playAudio = useCallback(
    async (message: Message) => {
      try {
        // Clean up any existing audio
        AudioManager.stopPlayback();

        // Set the current message ID
        const messageId = message.id;
        AudioManager.currentMessageId = messageId;
        setCurrentMessageId(messageId);

        let audio: HTMLAudioElement;

        // Check if we have this audio in cache
        if (AudioCache.has(messageId)) {
          console.log(
            `%c[AUDIO] PLAYING FROM CACHE: ${messageId}`,
            "color: #2196f3; font-weight: bold"
          );
          const cachedBlob = AudioCache.get(messageId);
          if (cachedBlob) {
            // Create audio element from cached blob
            audio = createAudioFromBlob(cachedBlob);
          } else {
            throw new Error("Cached blob is undefined");
          }
        } else {
          console.log(
            `%c[AUDIO] FETCHING FROM NETWORK: ${messageId}`,
            "color: #f44336; font-weight: bold"
          );
          // Convert text to speech and get both audio element and blob
          const result = await textToSpeech(
            message.content as string,
            voiceId,
            apiKey
          );

          // Store the blob in cache
          AudioCache.set(messageId, result.audioBlob);

          // Use the audio element
          audio = result.audioElement;

          // Cache stats are logged by AudioCache.set
        }

        // Store the audio element in the AudioManager
        AudioManager.currentAudio = audio;

        // Set up event handlers
        audio.onplay = () => {
          AudioManager.isPlaying = true;
          setIsPlaying(true);
        };

        audio.onended = () => {
          AudioManager.isPlaying = false;
          AudioManager.currentMessageId = null;
          AudioManager.currentAudio = null;
          setIsPlaying(false);
          setCurrentMessageId(null);

          // Process next item in queue
          setTimeout(() => AudioManager.processQueue(), 300);
        };

        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          AudioManager.isPlaying = false;
          AudioManager.currentMessageId = null;
          AudioManager.currentAudio = null;
          setIsPlaying(false);
          setCurrentMessageId(null);
          setError(new Error("Failed to play audio"));

          // Process next item in queue
          setTimeout(() => AudioManager.processQueue(), 300);
        };

        // Play the audio
        await audio.play();
      } catch (err) {
        console.error("Error in playAudio:", err);
        AudioManager.isPlaying = false;
        AudioManager.currentMessageId = null;
        AudioManager.currentAudio = null;
        setIsPlaying(false);
        setCurrentMessageId(null);
        setError(err instanceof Error ? err : new Error(String(err)));

        // Process next item in queue
        setTimeout(() => AudioManager.processQueue(), 300);
      }
    },
    [apiKey, voiceId]
  );

  // Speak a message - adds to queue if already playing
  const speakMessage = useCallback(
    async (message: Message) => {
      // Only speak assistant messages with content
      if (
        message.role !== "assistant" ||
        !message.content ||
        typeof message.content !== "string"
      ) {
        return;
      }

      const messageId = message.id;
      const isCached = AudioCache.has(messageId);

      console.log(
        `%c[AudioNarration] Request to speak message: ${messageId}${
          isCached ? " (CACHED)" : ""
        }`,
        "color: #607d8b; font-weight: bold"
      );

      // If this message is already playing, don't queue it again
      if (
        message.id === AudioManager.currentMessageId &&
        AudioManager.isPlaying
      ) {
        console.log(
          "%c[AudioNarration] Message is already playing, stopping it",
          "color: #ff9800; font-weight: bold"
        );
        stopSpeaking();
        return;
      }

      // If already playing something else, add to queue
      if (AudioManager.isPlaying) {
        console.log(
          `%c[AudioNarration] Already playing, adding message ${messageId} to queue`,
          "color: #9c27b0; font-weight: bold"
        );
        AudioManager.queueRequest(() => playAudio(message));
        return;
      }

      // Otherwise play immediately
      console.log(
        `%c[AudioNarration] Playing message ${messageId} immediately`,
        "color: #4caf50; font-weight: bold"
      );
      await playAudio(message);
    },
    [playAudio, stopSpeaking]
  );

  // Function to clear the audio cache
  const clearAudioCache = useCallback(() => {
    AudioCache.clear();
  }, []);

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
    speakMessage,
    stopSpeaking,
    clearAudioCache,
    error,
    currentMessageId,
  };
}
