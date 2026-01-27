"use client";

import { useMemo, memo } from "react";
import { motion } from "framer-motion";
import type { RoomPlayer } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const slideInLeft = { opacity: 0, x: -10 };
const slideInLeftVisible = { opacity: 1, x: 0 };

interface PlayerListProps {
  players: RoomPlayer[];
  hostPlayerId: string | null;
  spokespersonPlayerId: string | null;
  currentPlayerId: string | null;
  onlinePlayerIds?: string[];
  showRoles?: boolean;
}

const PlayerItem = memo(function PlayerItem({
  player,
  isHost,
  isSpokesperson,
  isCurrentPlayer,
  isOnline,
  showOnlineIndicator,
  showRoles,
  index,
}: {
  player: RoomPlayer;
  isHost: boolean;
  isSpokesperson: boolean;
  isCurrentPlayer: boolean;
  isOnline: boolean;
  showOnlineIndicator: boolean;
  showRoles: boolean;
  index: number;
}) {
  return (
    <motion.li
      initial={slideInLeft}
      animate={slideInLeftVisible}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "group flex items-center gap-3 py-2 px-3 -ml-3 rounded-sm transition-colors",
        isCurrentPlayer && "bg-foreground/5"
      )}
    >
      {/* Color indicator with subtle glow for current player */}
      <div className="relative">
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-transform",
            isCurrentPlayer && "scale-110"
          )}
          style={{ backgroundColor: player.color }}
        />
        {isCurrentPlayer ? (
          <div
            className="absolute inset-0 rounded-full animate-pulse opacity-50"
            style={{
              backgroundColor: player.color,
              filter: "blur(4px)",
            }}
          />
        ) : null}
      </div>

      {/* Name */}
      <span className="flex-1 text-sm">
        <span className={cn(isCurrentPlayer && "font-medium")}>
          {player.displayName}
        </span>
        {isCurrentPlayer ? (
          <span className="text-muted-foreground/50 ml-1.5 text-xs italic">
            you
          </span>
        ) : null}
      </span>

      {/* Role indicators - literary style */}
      {showRoles ? (
        <div className="flex items-center gap-2">
          {isHost ? (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 border-b border-muted-foreground/30">
              host
            </span>
          ) : null}
          {isSpokesperson ? (
            <span className="text-[10px] uppercase tracking-wider text-foreground/70 border-b border-foreground/40">
              voice
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Online indicator - subtle */}
      {showOnlineIndicator ? (
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full transition-all",
            isOnline ? "bg-emerald-500/70" : "bg-muted-foreground/30"
          )}
          title={isOnline ? "Online" : "Away"}
        />
      ) : null}
    </motion.li>
  );
});

const EMPTY_ARRAY: string[] = [];

export function PlayerList({
  players,
  hostPlayerId,
  spokespersonPlayerId,
  currentPlayerId,
  onlinePlayerIds = EMPTY_ARRAY,
  showRoles = true,
}: PlayerListProps) {
  const onlineSet = useMemo(
    () => new Set(onlinePlayerIds),
    [onlinePlayerIds]
  );

  const showOnlineIndicator = onlinePlayerIds.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="font-serif text-lg">Travelers</h3>
        <span className="text-xs text-muted-foreground/50">
          {players.length} {players.length === 1 ? "soul" : "souls"}
        </span>
      </div>

      <ul className="space-y-2">
        {players.map((player, index) => (
          <PlayerItem
            key={player.id}
            player={player}
            isHost={player.id === hostPlayerId}
            isSpokesperson={player.id === spokespersonPlayerId}
            isCurrentPlayer={player.id === currentPlayerId}
            isOnline={onlineSet.has(player.id)}
            showOnlineIndicator={showOnlineIndicator}
            showRoles={showRoles}
            index={index}
          />
        ))}
      </ul>

      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground/50 italic py-4">
          No one has arrived yet...
        </p>
      ) : null}
    </div>
  );
}
