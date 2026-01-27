"use client";

import { RoomProvider as LiveblocksRoomProvider } from "@/liveblocks.config";
import type { ReactNode } from "react";

interface MultiplayerRoomProviderProps {
  roomId: string;
  playerId: string;
  displayName: string;
  color: string;
  children: ReactNode;
}

export function MultiplayerRoomProvider({
  roomId,
  playerId,
  displayName,
  color,
  children,
}: MultiplayerRoomProviderProps) {
  return (
    <LiveblocksRoomProvider
      id={roomId}
      initialPresence={{
        playerId,
        displayName,
        color,
        isTyping: false,
      }}
    >
      {children}
    </LiveblocksRoomProvider>
  );
}
