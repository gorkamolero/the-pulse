"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PlayerList } from "./player-list";
import { InviteModal } from "./invite-modal";
import type { RoomWithPlayers } from "@/lib/multiplayer/types";
import type { Story } from "@pulse/core/ai/stories";
import { toast } from "sonner";
import { Pulse } from "@/components/ui/pulse";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fadeIn = { opacity: 0 };
const fadeInVisible = { opacity: 1 };
const slideInLeft = { opacity: 0, x: -20 };
const slideInLeftVisible = { opacity: 1, x: 0 };
const slideInUp = { opacity: 0, y: -20 };
const slideInUpVisible = { opacity: 1, y: 0 };
const pulseAnimation = { opacity: [1, 0.3, 1] };
const pulseTransition = { duration: 1.2, repeat: Number.POSITIVE_INFINITY };
const dotAnimation = { opacity: [0.3, 1, 0.3] };

interface GameLobbyProps {
  room: RoomWithPlayers;
  currentPlayerId: string;
  guestId?: string;
  story?: Story;
}

export function GameLobby({ room, currentPlayerId, guestId, story }: GameLobbyProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [selectedSpokesperson, setSelectedSpokesperson] = useState(
    room.spokespersonPlayerId || ""
  );

  // Derive values during render
  const isHost = room.hostPlayerId === currentPlayerId;
  const currentPlayer = room.players.find((p) => p.id === currentPlayerId);

  const handleChangeSpokesperson = useCallback(
    async (playerId: string) => {
      try {
        const response = await fetch(`/api/room/${room.id}/spokesperson`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spokespersonPlayerId: playerId,
            guestId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          toast.error(data.error || "Failed to change spokesperson");
          return;
        }

        setSelectedSpokesperson(playerId);
        const newSpokesperson = room.players.find((p) => p.id === playerId);
        toast.success(`${newSpokesperson?.displayName} is now the spokesperson`);
      } catch {
        toast.error("Failed to change spokesperson");
      }
    },
    [room.id, room.players, guestId]
  );

  const handleStartGame = useCallback(async () => {
    setIsStarting(true);

    try {
      const response = await fetch(`/api/room/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "playing",
          guestId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to start game");
        setIsStarting(false);
        return;
      }

      router.push(`/room/${room.id}/play`);
    } catch {
      toast.error("Failed to start game");
      setIsStarting(false);
    }
  }, [room.id, guestId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 overflow-y-auto">
      <motion.div
        className="w-full max-w-lg"
        initial={fadeIn}
        animate={fadeInVisible}
        transition={{ duration: 0.6 }}
      >
        {/* Header with Pulse branding */}
        <motion.div
          className="flex flex-col items-center gap-6 mb-12"
          initial={slideInUp}
          animate={slideInUpVisible}
          transition={{ delay: 0.2 }}
        >
          <Pulse />
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-serif font-light tracking-wide mb-2">
              Gathering
            </h1>
            <p className="text-muted-foreground text-sm italic">
              Awaiting fellow travelers...
            </p>
          </div>
        </motion.div>

        {/* Story Info Section */}
        {story && (
          <motion.div
            className="mb-8"
            initial={slideInLeft}
            animate={slideInLeftVisible}
            transition={{ delay: 0.3 }}
          >
            <div className="border-l-2 border-foreground/40 pl-6 py-4">
              <h2 className="text-xl font-serif mb-2">{story.title}</h2>
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                {story.description}
              </p>
            </div>
          </motion.div>
        )}

        {/* Player List Section */}
        <motion.div
          className="mb-8"
          initial={slideInLeft}
          animate={slideInLeftVisible}
          transition={{ delay: 0.4 }}
        >
          <div className="border-l-2 border-muted-foreground/20 pl-6 py-4">
            <PlayerList
              players={room.players}
              hostPlayerId={room.hostPlayerId}
              spokespersonPlayerId={selectedSpokesperson}
              currentPlayerId={currentPlayerId}
            />
          </div>
        </motion.div>

        {isHost ? (
          <motion.div
            className="border-l-2 border-foreground/40 pl-6 py-6 mb-8 space-y-6"
            initial={slideInLeft}
            animate={slideInLeftVisible}
            transition={{ delay: 0.5 }}
          >
            <div>
              <h3 className="font-serif text-lg mb-1">Host Controls</h3>
              <p className="text-xs text-muted-foreground/60 italic">
                You guide this session
              </p>
            </div>

            {/* Spokesperson Selection */}
            <div className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground block mb-1">
                  Voice of the Party
                </span>
                <p className="text-xs text-muted-foreground/60">
                  The spokesperson channels your collective will to the narrator
                </p>
              </div>
              <Select
                value={selectedSpokesperson}
                onValueChange={handleChangeSpokesperson}
              >
                <SelectTrigger className="bg-transparent border-muted-foreground/30 hover:border-foreground/50 transition-colors">
                  <SelectValue placeholder="Choose who speaks..." />
                </SelectTrigger>
                <SelectContent>
                  {room.players.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: player.color }}
                        />
                        <span>{player.displayName}</span>
                        {player.id === currentPlayerId ? (
                          <span className="text-muted-foreground/60 text-xs">
                            (you)
                          </span>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Game Button */}
            <motion.div
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="button"
                onClick={handleStartGame}
                disabled={isStarting || room.players.length < 1}
                className="w-full h-12 font-serif text-base tracking-wide bg-foreground text-background hover:bg-foreground/90 transition-all"
                size="lg"
              >
                {isStarting ? (
                  <span className="flex items-center gap-3">
                    <motion.span
                      className="w-2 h-2 bg-background rounded-full"
                      animate={pulseAnimation}
                      transition={pulseTransition}
                    />
                    Beginning...
                  </span>
                ) : (
                  "Begin the Journey"
                )}
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            className="border-l-2 border-muted-foreground/20 pl-6 py-4 mb-8"
            initial={slideInLeft}
            animate={slideInLeftVisible}
            transition={{ delay: 0.5 }}
          >
            <p className="text-muted-foreground italic text-sm">
              The host will begin when all are ready...
            </p>
            <motion.div
              className="flex gap-1 mt-3"
              initial={fadeIn}
              animate={fadeInVisible}
              transition={{ delay: 0.8 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full"
                  animate={dotAnimation}
                  transition={{
                    duration: 1.5,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* Invite Section */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={fadeIn}
          animate={fadeInVisible}
          transition={{ delay: 0.7 }}
        >
          <InviteModal inviteCode={room.inviteCode} />

          {/* Current player info */}
          <p className="text-xs text-muted-foreground/50 tracking-wide">
            Appearing as{" "}
            <span
              className="font-medium"
              style={{ color: currentPlayer?.color }}
            >
              {currentPlayer?.displayName}
            </span>
          </p>
        </motion.div>

        {/* Footer flourish */}
        <motion.div
          className="mt-16 flex justify-center"
          initial={fadeIn}
          animate={fadeInVisible}
          transition={{ delay: 1 }}
        >
          <div className="flex items-center gap-4 text-muted-foreground/30">
            <span className="w-8 h-px bg-current" />
            <span className="text-xs tracking-widest uppercase">
              Room {room.inviteCode.slice(0, 4)}
            </span>
            <span className="w-8 h-px bg-current" />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
