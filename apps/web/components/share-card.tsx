'use client';

import { useState } from 'react';
import { Share2, Twitter, Copy, Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Story } from '@pulse/core/ai/stories';

interface ShareCardProps {
  chatId: string;
  story: Story | undefined;
  pulseCount: number;
  soloMode: boolean;
  className?: string;
}

export function ShareCard({
  chatId,
  story,
  pulseCount,
  soloMode,
  className,
}: ShareCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const sessionUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/pulse/${chatId}`
      : `/pulse/${chatId}`;

  const storyTitle = story?.title ?? 'The Pulse';
  const accentHex = story?.theme?.accentHex ?? '#4A9B8C';
  const pulsesLabel = pulseCount === 1 ? '1 pulse' : `${pulseCount} pulses`;
  const sessionLabel = soloMode ? 'solo' : 'group';

  const shareText = `I just played ${storyTitle} on The Pulse — ${pulsesLabel} of AI-narrated interactive fiction. Join me:`;
  const twitterText = `${shareText}\n${sessionUrl}`;
  const whatsappText = `${shareText}\n${sessionUrl}`;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  function handleCopy() {
    navigator.clipboard.writeText(sessionUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleNativeShare() {
    if (navigator.share) {
      navigator.share({
        title: storyTitle,
        text: shareText,
        url: sessionUrl,
      });
    } else {
      setOpen(true);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('h-7 gap-1.5 text-xs', className)}
        onClick={handleNativeShare}
        title="Share this session"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Share</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="font-literary text-lg">
              Share Your Session
            </DialogTitle>
          </DialogHeader>

          {/* Preview card */}
          <div
            className="rounded-lg overflow-hidden border mb-4"
            style={{ borderColor: `${accentHex}40` }}
          >
            <div
              className="p-5"
              style={{
                background: `linear-gradient(135deg, #0A0A0F 0%, ${accentHex}18 100%)`,
                borderBottom: `1px solid ${accentHex}30`,
              }}
            >
              <div
                className="text-xs tracking-widest uppercase mb-2"
                style={{ color: accentHex }}
              >
                The Pulse
              </div>
              <div className="text-lg font-literary font-semibold text-foreground mb-1">
                {storyTitle}
              </div>
              <div className="text-sm text-muted-foreground">
                {pulsesLabel} · {sessionLabel} session
              </div>
            </div>
            <div className="px-5 py-3 bg-muted/30 text-xs text-muted-foreground truncate">
              {sessionUrl}
            </div>
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-3 gap-2">
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-center"
            >
              <Twitter className="w-5 h-5 text-sky-400" />
              <span className="text-xs">Twitter / X</span>
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-center"
            >
              <MessageCircle className="w-5 h-5 text-green-400" />
              <span className="text-xs">WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-center"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-400" />
              ) : (
                <Copy className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="text-xs">{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-1">
            Anyone with this link can continue the session
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
