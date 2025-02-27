// Global type declarations

interface AudioManagerType {
  currentAudio: HTMLAudioElement | null;
  isPlaying: boolean;
  currentMessageId: string | null;
  pendingRequests: Array<() => Promise<void>>;
  isProcessing: boolean;
  stopPlayback: () => void;
  pausePlayback: () => boolean;
  processQueue: () => Promise<void>;
  queueRequest: (request: () => Promise<void>) => void;
  clearQueue: () => void;
}

interface AudioCacheType {
  cache: Map<string, Blob>;
  set: (messageId: string, audioBlob: Blob) => void;
  get: (messageId: string) => Blob | undefined;
  has: (messageId: string) => boolean;
  clear: () => void;
  getStats: () => { size: number; keys: string[] };
}

interface Window {
  AudioManager?: AudioManagerType;
  AudioCache?: AudioCacheType;
}
