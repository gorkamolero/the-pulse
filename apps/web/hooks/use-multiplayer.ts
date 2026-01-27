"use client";

import { useState, useEffect, useCallback } from "react";
import type { RoomWithPlayers, PlayerChatMessage } from "@/lib/multiplayer/types";
import {
  useMyPresence,
  useOthers,
  useSelf,
  useBroadcastEvent,
  useEventListener,
  useStatus,
  type RoomEvent,
} from "@/liveblocks.config";

export function useMultiplayer(roomId: string) {
  const [room, setRoom] = useState<RoomWithPlayers | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<PlayerChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Liveblocks hooks
  const status = useStatus();
  const [myPresence, updateMyPresence] = useMyPresence();
  const others = useOthers();
  const self = useSelf();
  const broadcast = useBroadcastEvent();

  // Fetch room data - stable callback for use in event listener
  const fetchRoom = useCallback(async () => {
    try {
      const response = await fetch(`/api/room/${roomId}`);
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to fetch room");
        return null;
      }
      const data = await response.json();
      setRoom(data.room);
      return data.room as RoomWithPlayers;
    } catch {
      setError("Failed to fetch room");
      return null;
    }
  }, [roomId]);

  // Initial fetch
  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // Listen for room events
  useEventListener(({ event: roomEvent }) => {
    switch (roomEvent.type) {
      case "CHAT_MESSAGE":
        setChatMessages((prev) => [
          ...prev,
          {
            id: `${roomEvent.from}-${roomEvent.timestamp}`,
            from: roomEvent.from,
            fromName: roomEvent.fromName,
            content: roomEvent.content,
            timestamp: roomEvent.timestamp,
          },
        ]);
        break;
      case "PLAYER_JOINED":
      case "PLAYER_LEFT":
      case "SPOKESPERSON_CHANGED":
      case "GAME_STARTED":
        fetchRoom();
        break;
    }
  });

  // Send chat message
  const sendChatMessage = useCallback(
    (content: string) => {
      if (!self?.info || !content.trim()) return;

      const event: RoomEvent = {
        type: "CHAT_MESSAGE",
        from: self.id,
        fromName: self.info.name,
        content: content.trim(),
        timestamp: Date.now(),
      };

      broadcast(event);

      // Add to local messages immediately
      setChatMessages((prev) => [
        ...prev,
        {
          id: `${self.id}-${event.timestamp}`,
          from: self.id,
          fromName: self.info.name,
          content: event.content,
          timestamp: event.timestamp,
        },
      ]);
    },
    [self, broadcast]
  );

  // Set typing status
  const setTyping = useCallback(
    (isTyping: boolean) => {
      updateMyPresence({ isTyping });
    },
    [updateMyPresence]
  );

  // Computed values
  const isHost = room?.hostPlayerId === playerId;
  const isSpokesperson = room?.spokespersonPlayerId === playerId;
  const isConnected = status === "connected";
  const onlinePlayers = others.map((other) => ({
    id: other.id,
    name: other.info?.name || "Unknown",
    color: other.info?.color || "#888888",
    isTyping: other.presence?.isTyping || false,
  }));

  return {
    room,
    playerId,
    setPlayerId,
    isHost,
    isSpokesperson,
    isConnected,
    status,
    onlinePlayers,
    chatMessages,
    sendChatMessage,
    setTyping,
    fetchRoom,
    error,
    myPresence,
    self,
  };
}
