'use client';

import { Loader2, Volume2, VolumeX, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import Link from 'next/link';
import { audioEnabledAtom } from '@/lib/atoms';
import { storyTitleStyle } from '@/lib/story-fonts';
import { coverSrc, Ornament, STORY_META } from './story-index';
import type { Story } from '@pulse/core/ai/stories';

interface StoryStartModalProps {
  story: Story | null;
  epigraph?: { quote: string; author: string };
  onStartSolo: () => void;
  onStartGroup: () => void;
  onStartMultiplayer: () => void;
  onClose: () => void;
  isAuthenticated: boolean;
  isCreatingRoom?: boolean;
}

function ModeRow({
  name,
  detail,
  onClick,
  disabled,
  primary,
  accent,
  loading,
}: {
  name: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  accent: string;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group w-full flex items-center justify-between gap-4 px-3 py-4 border-t border-white/[0.08] text-left transition-colors duration-300 ${
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-white/[0.03]'
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span
          className="font-literary text-lg leading-snug transition-colors duration-300"
          style={{ color: primary ? accent : 'rgba(255,255,255,0.85)' }}
        >
          {name}
        </span>
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          {detail}
        </span>
      </span>
      {loading ? (
        <Loader2 className="w-4 h-4 shrink-0 animate-spin text-white/40" />
      ) : (
        <span
          aria-hidden
          className="shrink-0 text-white/25 group-hover:translate-x-1 transition-all duration-300 group-hover:text-[color:var(--ink)]"
        >
          →
        </span>
      )}
    </button>
  );
}

export function StoryStartModal({
  story,
  epigraph,
  onStartSolo,
  onStartGroup,
  onStartMultiplayer,
  onClose,
  isAuthenticated,
  isCreatingRoom = false,
}: StoryStartModalProps) {
  const [audioEnabled, setAudioEnabled] = useAtom(audioEnabledAtom);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!story) return null;

  const accent = story.theme?.accentHex || '#888888';
  const genre = STORY_META[story.id]?.genre;

  return (
    <motion.div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 backdrop-blur-md p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={story.title}
        className="relative w-full max-w-lg my-auto overflow-hidden bg-[#0b0b0d] border border-white/10 px-7 py-10 md:px-12 md:py-12"
        style={{ '--ink': accent } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* The story's plate behind the title */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-72 pointer-events-none"
        >
          <img
            src={coverSrc(story.id)}
            alt=""
            className="h-full w-full object-cover object-top opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#0b0b0d]/70 to-[#0b0b0d]" />
        </div>

        {/* Ink hairline across the top */}
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: `linear-gradient(to right, transparent, ${accent}, transparent)`,
          }}
        />

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1 text-white/30 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative flex flex-col items-center text-center">
          {/* Genre credit line */}
          {genre && (
            <p
              className="text-[10px] uppercase tracking-[0.35em] pl-[0.35em]"
              style={{ color: accent }}
            >
              {genre}
            </p>
          )}

          {/* Title */}
          <h2
            className="mt-4 uppercase tracking-[0.15em] text-2xl md:text-3xl leading-snug text-white/95 text-balance"
            style={storyTitleStyle(story.id)}
          >
            {story.title}
          </h2>

          <div className="mt-6" style={{ color: accent }}>
            <Ornament />
          </div>

          {/* Epigraph */}
          {epigraph && (
            <blockquote className="mt-6 max-w-sm">
              <p
                className="italic text-[15px] leading-relaxed text-white/60"
                style={{ fontFamily: storyTitleStyle(story.id).fontFamily }}
              >
                &ldquo;{epigraph.quote}&rdquo;
              </p>
              <cite className="mt-2 block text-xs not-italic text-white/30">
                — {epigraph.author}
              </cite>
            </blockquote>
          )}

          {/* Description */}
          <p className="mt-6 font-literary text-[15px] leading-relaxed text-white/45 max-w-md text-balance">
            {story.description}
          </p>

          {/* Modes */}
          <div className="mt-10 w-full">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.4em] pl-[0.4em] text-white/30">
              Choose how to play
            </p>

            <div className="border-b border-white/[0.08] text-left">
              <ModeRow
                name="Solo"
                detail="Play by yourself"
                onClick={onStartSolo}
                disabled={isCreatingRoom}
                primary
                accent={accent}
              />
              <ModeRow
                name="Same Screen"
                detail="Pass the device around"
                onClick={onStartGroup}
                disabled={isCreatingRoom}
                accent={accent}
              />
              <ModeRow
                name="Invite Room"
                detail={
                  isAuthenticated ? 'Friends join by link' : 'Sign in to host'
                }
                onClick={onStartMultiplayer}
                disabled={!isAuthenticated || isCreatingRoom}
                accent={accent}
                loading={isCreatingRoom}
              />
            </div>
          </div>

          {/* Narration toggle */}
          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`mt-8 flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.3em] pl-[0.3em] transition-colors duration-300 ${
              audioEnabled ? 'text-white/70' : 'text-white/30'
            } hover:text-white`}
          >
            {audioEnabled ? (
              <Volume2 className="w-3.5 h-3.5" style={{ color: accent }} />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            Narration {audioEnabled ? 'On' : 'Off'}
          </button>

          {/* Meta */}
          <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.25em] pl-[0.25em] text-white/20">
            ~30 minutes · Your choices shape the narrative
          </p>

          {/* Sign in link for guests */}
          {!isAuthenticated && (
            <p className="mt-4 font-literary text-xs text-white/35">
              <Link
                href="/login"
                className="text-white/60 hover:text-white underline underline-offset-4 decoration-white/20 transition-colors"
              >
                Sign in
              </Link>{' '}
              to host a gathering or save your progress
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
