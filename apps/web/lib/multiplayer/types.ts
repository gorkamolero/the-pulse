import type { Room, RoomPlayer } from "@/lib/db/schema";

// Room status enum
export type RoomStatus = "lobby" | "playing" | "ended";

// Room with players for API responses
export type RoomWithPlayers = Room & {
  players: RoomPlayer[];
};

// Player colors for assignment
export const PLAYER_COLORS = [
  "#E63946", // Red
  "#457B9D", // Blue
  "#2A9D8F", // Teal
  "#E9C46A", // Yellow
  "#F4A261", // Orange
  "#9B5DE5", // Purple
  "#00BBF9", // Cyan
  "#F15BB5", // Pink
] as const;

// Get a color based on player index
export function getPlayerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

// Chat message for player sidebar (ephemeral, not persisted)
export type PlayerChatMessage = {
  id: string;
  from: string;
  fromName: string;
  content: string;
  timestamp: number;
};
