"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatInviteCode } from "@/lib/multiplayer/invite-code";
import { toast } from "sonner";

interface InviteModalProps {
  inviteCode: string;
}

export function InviteModal({ inviteCode }: InviteModalProps) {
  const [open, setOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<"code" | "link" | null>(null);

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${inviteCode}`
      : `/join/${inviteCode}`;

  const formattedCode = formatInviteCode(inviteCode);

  const copyToClipboard = async (text: string, field: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(field === "code" ? "Code copied" : "Link copied");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-muted-foreground/30 hover:border-foreground/50 hover:bg-transparent transition-all"
        >
          <span className="flex items-center gap-2">
            <span className="w-4 h-px bg-current" />
            Summon Others
            <span className="w-4 h-px bg-current" />
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md border-muted-foreground/20 bg-background/95 backdrop-blur">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="font-serif text-2xl font-light tracking-wide">
            Summon Travelers
          </DialogTitle>
          <DialogDescription className="text-muted-foreground/70 italic">
            Share the passage to bring others into the fold
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Invite Code - Featured Display */}
          <div className="space-y-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground/50 block text-center">
              Arcane Code
            </span>
            <motion.button
              type="button"
              onClick={() => copyToClipboard(inviteCode, "code")}
              className="w-full group relative"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="px-6 py-5 bg-foreground/5 border border-muted-foreground/20 rounded-sm text-center font-mono text-3xl tracking-[0.3em] text-foreground/90 hover:border-foreground/40 transition-colors">
                {formattedCode}
              </div>

              {/* Copy feedback overlay */}
              <AnimatePresence>
                {copiedField === "code" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-foreground/10 backdrop-blur-sm rounded-sm"
                  >
                    <span className="text-sm text-foreground/80">Copied</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tap to copy hint */}
              <span className="text-[10px] text-muted-foreground/40 mt-2 block text-center group-hover:text-muted-foreground/60 transition-colors">
                tap to copy
              </span>
            </motion.button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <span className="flex-1 h-px bg-muted-foreground/20" />
            <span className="text-xs text-muted-foreground/40 italic">or</span>
            <span className="flex-1 h-px bg-muted-foreground/20" />
          </div>

          {/* Join Link */}
          <div className="space-y-3">
            <label
              htmlFor="join-link"
              className="text-xs uppercase tracking-wider text-muted-foreground/50 block text-center"
            >
              Direct Passage
            </label>
            <div className="flex gap-2">
              <input
                id="join-link"
                type="text"
                value={joinUrl}
                readOnly
                className="flex-1 px-3 py-2.5 bg-foreground/5 border border-muted-foreground/20 rounded-sm text-xs text-muted-foreground truncate focus:outline-none focus:border-foreground/40"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(joinUrl, "link")}
                className="border-muted-foreground/30 hover:border-foreground/50 hover:bg-transparent shrink-0"
              >
                {copiedField === "link" ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-muted-foreground/40 text-center pb-2 italic">
          Those who possess the code may join your journey
        </p>
      </DialogContent>
    </Dialog>
  );
}
