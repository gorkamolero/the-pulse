"use client";

import { createContext, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useBroadcastEvent, useEventListener, type RoomEvent } from "@/liveblocks.config";

export type NarrationEvent = Extract<
  RoomEvent,
  { type: "NARRATION_TURN" | "NARRATION_AUDIO" | "NARRATION_TEXT" | "PLAYER_MOVE" }
>;
type NarrationHandler = (event: NarrationEvent) => void;

export interface RoomNarrationBus {
  publish: (event: NarrationEvent) => void;
  subscribe: (handler: NarrationHandler) => () => void;
}

/** Present only inside a multiplayer room; solo and same-screen games have none */
export const RoomNarrationContext = createContext<RoomNarrationBus | null>(null);

const NARRATION_TYPES = new Set(["NARRATION_TURN", "NARRATION_AUDIO", "NARRATION_TEXT", "PLAYER_MOVE"]);

/**
 * Relays live narration between the player whose browser talks to the narrator agent
 * and everyone else in the room, so all players hear the voice and see the text as it plays.
 */
export function RoomNarrationProvider({ children }: { children: ReactNode }) {
  const broadcast = useBroadcastEvent();
  const handlers = useRef(new Set<NarrationHandler>());

  useEventListener(({ event }) => {
    if (!NARRATION_TYPES.has(event.type)) return;
    for (const handler of handlers.current) handler(event as NarrationEvent);
  });

  const publish = useCallback(
    (event: NarrationEvent) => {
      try {
        broadcast(event);
      } catch {
        // Relay is best effort; the narration still plays for this player
      }
    },
    [broadcast],
  );

  const subscribe = useCallback((handler: NarrationHandler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }, []);

  const bus = useMemo(() => ({ publish, subscribe }), [publish, subscribe]);
  return <RoomNarrationContext.Provider value={bus}>{children}</RoomNarrationContext.Provider>;
}
