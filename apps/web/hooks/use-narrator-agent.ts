'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NarratorState } from '@/lib/atoms';
import type { WordTiming } from '@/components/timed-narration';

const CONVERSATION_URL = 'wss://api.elevenlabs.io/v1/convai/conversation';
// Wait this long after the last chunk before calling the narrator quiet
const QUIET_AFTER_MS = 500;

/** Character timings for one narrator turn, in ms from when its voice started */
export interface LiveTurn {
  id: string;
  startAt: number | null; // AudioContext time the turn's first chunk plays
  chars: string[];
  startsMs: number[];
  endsMs: number[];
  done: boolean;
}

export interface ChunkAlignment {
  chars: string[];
  char_start_times_ms: number[];
  char_durations_ms: number[];
}

/** One chunk of narrator voice: 16-bit PCM in base64, with its character timings */
export interface NarrationChunk {
  turnId: string;
  audio: string;
  sampleRate: number;
  alignment?: ChunkAlignment;
}

const newTurn = (id = ''): LiveTurn => ({ id, startAt: null, chars: [], startsMs: [], endsMs: [], done: false });
const liveTurns = new Map<string, LiveTurn>();
let liveClock: AudioContext | null = null;

/** Whether a narrator message was voiced live (survives remounts, unlike React state) */
export function hasLiveNarration(messageId: string) {
  return liveTurns.has(messageId);
}

/** Tie a narrator message to the turn whose voice is reading it */
export function bindLiveNarration(messageId: string, turn: LiveTurn) {
  liveTurns.set(messageId, turn);
}

/** The live turn behind a narrator message, and how far into its voice playback is */
export function getLiveNarration(messageId: string) {
  const turn = liveTurns.get(messageId);
  if (!turn || turn.startAt === null || !liveClock) return null;
  // Output latency is the gap between the audio clock and the speaker (large on Bluetooth)
  const heardAt = liveClock.currentTime - (liveClock.outputLatency || 0) - (liveClock.baseLatency || 0);
  return { turn, nowMs: (heardAt - turn.startAt) * 1000 };
}

/** Word timings for the displayed text from the voice's character timings */
export function liveWordTimings(text: string, turn: LiveTurn): WordTiming[] {
  const starts: Array<number | undefined> = new Array(text.length);
  const ends: Array<number | undefined> = new Array(text.length);
  let cursor = 0;
  for (let i = 0; i < turn.chars.length; i++) {
    // Look a little ahead; the voice drops or normalises some characters
    let found = cursor;
    while (found < text.length && found - cursor < 12 && text[found] !== turn.chars[i]) found++;
    if (found >= text.length || text[found] !== turn.chars[i]) continue;
    starts[found] = turn.startsMs[i];
    ends[found] = turn.endsMs[i];
    cursor = found + 1;
  }

  const timings: WordTiming[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    const startChar = match.index ?? 0;
    const endChar = startChar + match[0].length;
    let first: number | undefined;
    let last: number | undefined;
    for (let c = startChar; c < endChar; c++) {
      if (starts[c] === undefined) continue;
      first ??= c;
      last = c;
    }
    if (first === undefined || last === undefined) continue;
    timings.push({ word: match[0], startMs: starts[first] ?? 0, endMs: ends[last] ?? 0, startChar, endChar });
  }
  return timings;
}

interface UseNarratorAgentOptions {
  agentId: string | null;
  /** Called with the full text of each narrator turn and the turn's live timings */
  onNarration: (text: string, turn: LiveTurn) => void;
  /** Thinking after a move is sent, talking while the voice plays, null when quiet */
  onStateChange?: (state: NarratorState) => void;
  /** Each chunk of voice as it arrives, to relay to other players */
  onAudioChunk?: (chunk: NarrationChunk) => void;
  /** A move went to the agent and a new narrator turn begins */
  onTurnStart?: (turnId: string) => void;
}

/**
 * Live narration through an ElevenLabs agent: typed moves go out as user messages,
 * and the agent's voice streams back as PCM that plays as soon as it arrives.
 */
export function useNarratorAgent({
  agentId,
  onNarration,
  onStateChange,
  onAudioChunk,
  onTurnStart,
}: UseNarratorAgentOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sampleRateRef = useRef(16000);
  const playheadRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const pendingRef = useRef<string[]>([]);
  const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnRef = useRef<LiveTurn>(newTurn());
  const blockCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);
  // The browser holds sound until the player clicks or presses a key
  const [audioBlocked, setAudioBlocked] = useState(false);

  const onNarrationRef = useRef(onNarration);
  const onStateChangeRef = useRef(onStateChange);
  const onAudioChunkRef = useRef(onAudioChunk);
  const onTurnStartRef = useRef(onTurnStart);
  useEffect(() => {
    onNarrationRef.current = onNarration;
    onStateChangeRef.current = onStateChange;
    onAudioChunkRef.current = onAudioChunk;
    onTurnStartRef.current = onTurnStart;
  });

  const setState = useCallback((state: NarratorState) => {
    onStateChangeRef.current?.(state);
    (window as unknown as { __narratorState?: NarratorState }).__narratorState = state;
  }, []);

  const stopAudio = useCallback(() => {
    for (const source of sourcesRef.current) {
      source.onended = null;
      source.stop();
    }
    sourcesRef.current.clear();
    playheadRef.current = 0;
  }, []);

  const playChunk = useCallback(
    (base64?: string, alignment?: ChunkAlignment) => {
      const ctx = audioCtxRef.current;
      if (!ctx || !base64) return;

      // 16-bit little-endian PCM to float samples
      const binary = atob(base64);
      const samples = new Int16Array(binary.length >> 1);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8);
      }
      const buffer = ctx.createBuffer(1, samples.length, sampleRateRef.current);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        channel[i] = samples[i] / 32768;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime + 0.04, playheadRef.current);
      source.start(startAt);
      playheadRef.current = startAt + buffer.duration;
      sourcesRef.current.add(source);

      // Chunk timings start at zero; place them on the turn's own timeline
      const turn = turnRef.current;
      turn.startAt ??= startAt;
      if (alignment?.chars?.length) {
        const offsetMs = (startAt - turn.startAt) * 1000;
        alignment.chars.forEach((char, i) => {
          const start = offsetMs + (alignment.char_start_times_ms[i] ?? 0);
          turn.chars.push(char);
          turn.startsMs.push(start);
          turn.endsMs.push(start + (alignment.char_durations_ms[i] ?? 0));
        });
      }

      if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
      setState('talking');
      source.onended = () => {
        sourcesRef.current.delete(source);
        if (sourcesRef.current.size > 0) return;
        quietTimerRef.current = setTimeout(() => {
          if (sourcesRef.current.size === 0) setState(null);
        }, QUIET_AFTER_MS);
      };
    },
    [setState],
  );

  const sendNow = useCallback(
    (ws: WebSocket, text: string) => {
      turnRef.current.done = true;
      turnRef.current = newTurn(crypto.randomUUID());
      playheadRef.current = 0;
      ws.send(JSON.stringify({ type: 'user_message', text }));
      setState('thinking');
      onTurnStartRef.current?.(turnRef.current.id);
    },
    [setState],
  );

  /** Send a player's move; queued until the conversation is open */
  const send = useCallback(
    (text: string) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && connected) sendNow(ws, text);
      else pendingRef.current.push(text);
    },
    [connected, sendNow],
  );

  /** Whether a conversation is open or opening */
  const isStarted = useCallback(() => wsRef.current !== null, []);

  /** The audio context, resumed when the browser allows it. Call from a click to unlock sound. */
  const ensureAudio = useCallback(() => {
    let ctx = audioCtxRef.current;
    if (!ctx) {
      const created = new AudioContext();
      created.onstatechange = () => {
        if (created.state === 'running') setAudioBlocked(false);
      };
      audioCtxRef.current = created;
      ctx = created;
    }
    liveClock = ctx;
    // Suspended, or interrupted on Safari
    if (ctx.state !== 'running' && ctx.state !== 'closed') {
      ctx.resume().catch(() => {});
      // Resuming without a click stays pending; flag it if the context hasn't started shortly
      const pending = ctx;
      blockCheckRef.current ??= setTimeout(() => {
        blockCheckRef.current = null;
        if (pending.state !== 'running' && pending.state !== 'closed') setAudioBlocked(true);
      }, 600);
    }
    return ctx;
  }, []);

  /** A narrator turn relayed from the player talking to the agent begins */
  const beginRemoteTurn = useCallback(
    (turnId: string) => {
      if (turnRef.current.id === turnId) return;
      turnRef.current.done = true;
      turnRef.current = newTurn(turnId);
      // The playhead stays: the new turn queues after any relayed voice still playing
      setState('thinking');
    },
    [setState],
  );

  /** Play a chunk of narrator voice relayed from the player talking to the agent */
  const playRemote = useCallback(
    (chunk: NarrationChunk) => {
      // A player who connected mid-turn never saw it begin
      beginRemoteTurn(chunk.turnId);
      ensureAudio();
      sampleRateRef.current = chunk.sampleRate;
      playChunk(chunk.audio, chunk.alignment);
    },
    [beginRemoteTurn, ensureAudio, playChunk],
  );

  /** Close the conversation, e.g. when this player hands the narrator to someone else */
  const stop = useCallback(() => {
    pendingRef.current = [];
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  /** The turn the latest voice belongs to */
  const currentTurn = useCallback(() => turnRef.current, []);

  /**
   * Open the conversation. Call from a click or key press so the browser lets audio play.
   * `context` (the story so far, when resuming) is given to the agent without a reply.
   */
  const start = useCallback(
    (openingMessage?: string, context?: string) => {
      if (!agentId || wsRef.current) return;

      ensureAudio();
      if (openingMessage) pendingRef.current.push(openingMessage);
      setState('thinking');

      const ws = new WebSocket(`${CONVERSATION_URL}?agent_id=${agentId}`);
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'conversation_initiation_client_data' }));
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'conversation_initiation_metadata': {
            const format: string =
              data.conversation_initiation_metadata_event?.agent_output_audio_format ?? 'pcm_16000';
            sampleRateRef.current = Number(format.split('_')[1]) || 16000;
            setConnected(true);
            if (context) ws.send(JSON.stringify({ type: 'contextual_update', text: context }));
            for (const text of pendingRef.current.splice(0)) sendNow(ws, text);
            break;
          }
          case 'agent_response': {
            const text = data.agent_response_event?.agent_response;
            if (text) onNarrationRef.current(text, turnRef.current);
            break;
          }
          case 'audio':
            playChunk(data.audio_event?.audio_base_64, data.audio_event?.alignment);
            if (data.audio_event?.audio_base_64) {
              onAudioChunkRef.current?.({
                turnId: turnRef.current.id,
                audio: data.audio_event.audio_base_64,
                sampleRate: sampleRateRef.current,
                alignment: data.audio_event.alignment,
              });
            }
            break;
          case 'interruption':
            stopAudio();
            break;
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', event_id: data.ping_event?.event_id }));
            break;
        }
      };
      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        setConnected(false);
      };
    },
    [agentId, ensureAudio, playChunk, sendNow, setState, stopAudio],
  );

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      stopAudio();
      void audioCtxRef.current?.close();
      if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
      if (blockCheckRef.current) clearTimeout(blockCheckRef.current);
    };
  }, [stopAudio]);

  return {
    start,
    send,
    stop,
    isStarted,
    connected,
    beginRemoteTurn,
    playRemote,
    currentTurn,
    audioBlocked,
    unlockAudio: ensureAudio,
  };
}
