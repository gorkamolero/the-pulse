"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatInviteCode } from "@/lib/multiplayer/invite-code";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { Pulse } from "@/components/ui/pulse";

export default function JoinPage() {
  const params = useParams<{ inviteCode: string }>();
  const inviteCode = params.inviteCode;
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);

  // Initialize guest ID and fetch room in parallel
  useEffect(() => {
    // Get or create guest ID from cookie (sync)
    let existingGuestId = document.cookie
      .split("; ")
      .find((row) => row.startsWith("guest-id="))
      ?.split("=")[1];

    if (!existingGuestId) {
      existingGuestId = nanoid(16);
      document.cookie = `guest-id=${existingGuestId}; path=/; max-age=31536000`;
    }
    setGuestId(existingGuestId);

    // Fetch room (async, runs in parallel with render)
    async function fetchRoom() {
      try {
        const response = await fetch(`/api/room/join/${inviteCode}`);
        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Room not found");
          return;
        }
        const data = await response.json();
        setRoomId(data.room.id);

        if (data.room.status === "playing") {
          setError("This journey has already begun");
        } else if (data.room.status === "ended") {
          setError("This journey has concluded");
        }
      } catch {
        setError("Failed to find room");
      }
    }
    fetchRoom();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!displayName.trim() || !roomId || !guestId) {
      toast.error("Please enter your name");
      return;
    }

    setIsJoining(true);

    try {
      const response = await fetch(`/api/room/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          guestId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to join room");
        setIsJoining(false);
        return;
      }

      router.push(`/room/${roomId}`);
    } catch {
      toast.error("Failed to join room");
      setIsJoining(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && displayName.trim()) {
      handleJoin();
    }
  };

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <motion.div
          className="w-full max-w-md text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Pulse />

          <h1 className="mt-8 text-2xl font-serif font-light text-foreground/80">
            Path Unavailable
          </h1>

          <p className="mt-4 text-muted-foreground/70 italic">{error}</p>

          <motion.div
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              type="button"
              onClick={() => router.push("/")}
              variant="outline"
              className="border-muted-foreground/30 hover:border-foreground/50 hover:bg-transparent"
            >
              Return Home
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Loading state
  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <motion.div
          className="flex flex-col items-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Pulse />
          <p className="text-muted-foreground/60 italic text-sm">
            Seeking the gathering...
          </p>
        </motion.div>
      </div>
    );
  }

  // Main join form
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header with Pulse */}
        <motion.div
          className="flex flex-col items-center gap-6 mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Pulse />
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-serif font-light tracking-wide mb-2">
              Join the Journey
            </h1>
            <p className="text-muted-foreground text-sm italic">
              You have been summoned
            </p>
          </div>
        </motion.div>

        {/* Invite Code Display */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span className="text-xs uppercase tracking-wider text-muted-foreground/50 block mb-2">
            Passage Code
          </span>
          <span className="font-mono text-2xl tracking-[0.2em] text-foreground/80">
            {formatInviteCode(inviteCode)}
          </span>
        </motion.div>

        {/* Name Input */}
        <motion.div
          className="border-l-2 border-foreground/40 pl-6 py-6 space-y-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="space-y-3">
            <label
              htmlFor="displayName"
              className="text-sm text-muted-foreground block"
            >
              How shall you be known?
            </label>
            <Input
              id="displayName"
              type="text"
              placeholder="Enter your name..."
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={32}
              autoFocus
              className="text-lg bg-transparent border-muted-foreground/30 focus:border-foreground/50 placeholder:text-muted-foreground/30 h-12"
            />
          </div>

          <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
            <Button
              type="button"
              onClick={handleJoin}
              disabled={isJoining || !displayName.trim()}
              className="w-full h-12 font-serif text-base tracking-wide bg-foreground text-background hover:bg-foreground/90 transition-all"
              size="lg"
            >
              {isJoining ? (
                <span className="flex items-center gap-3">
                  <motion.span
                    className="w-2 h-2 bg-background rounded-full"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{
                      duration: 1.2,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                  />
                  Entering...
                </span>
              ) : (
                "Enter the Circle"
              )}
            </Button>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="mt-16 flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex items-center gap-4 text-muted-foreground/30">
            <span className="w-8 h-px bg-current" />
            <span className="text-xs tracking-widest uppercase">The Pulse</span>
            <span className="w-8 h-px bg-current" />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
