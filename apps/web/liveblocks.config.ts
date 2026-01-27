"use client";

import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

// Create the Liveblocks client
const client = createClient({
  authEndpoint: "/api/liveblocks-auth",
});

// Presence: ephemeral data about each connected user
export type Presence = {
  playerId: string;
  displayName: string;
  color: string;
  isTyping: boolean;
};

// Broadcast events: real-time messages that don't persist
export type RoomEvent =
  | { type: "CHAT_MESSAGE"; from: string; fromName: string; content: string; timestamp: number }
  | { type: "SPOKESPERSON_CHANGED"; playerId: string; playerName: string }
  | { type: "GAME_STARTED"; chatId: string }
  | { type: "PLAYER_JOINED"; player: { id: string; name: string; color: string } }
  | { type: "PLAYER_LEFT"; playerId: string; playerName: string };

// User metadata from auth
export type UserMeta = {
  id: string;
  info: {
    name: string;
    color: string;
    isHost: boolean;
  };
};

// We don't use Storage for this feature - chat is ephemeral via broadcast
export type Storage = Record<string, never>;

// Room context with typed generics
const {
  RoomProvider: _RoomProvider,
  useMyPresence: _useMyPresence,
  useOthers: _useOthers,
  useSelf: _useSelf,
  useBroadcastEvent: _useBroadcastEvent,
  useEventListener: _useEventListener,
  useStatus: _useStatus,
} = createRoomContext<Presence, Storage, UserMeta, RoomEvent>(client);

// Re-export with explicit types to avoid TS2742 error
export const RoomProvider = _RoomProvider;
export const useMyPresence = _useMyPresence;
export const useOthers = _useOthers;
export const useSelf = _useSelf;
export const useBroadcastEvent = _useBroadcastEvent;
export const useStatus = _useStatus;

// useEventListener requires explicit type annotation due to TS2742
export type RoomEventCallback = (data: { event: RoomEvent }) => void;
export const useEventListener: (callback: RoomEventCallback) => void =
  _useEventListener;
