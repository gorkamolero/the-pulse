'use client';

import { storyTitleStyle } from '@/lib/story-fonts';

/**
 * Presentation metadata for the anthology — genre credit lines and epigraphs.
 * Keyed by story id so the app (Overview) and the marketing page (LandingPage)
 * render the same shelf of doors.
 */
export const STORY_META: Record<
  string,
  { genre: string; epigraph: { quote: string; author: string } }
> = {
  'shadow-over-innsmouth': {
    genre: 'A Lovecraftian Horror',
    epigraph: {
      quote:
        'The oldest and strongest emotion of mankind is fear, and the oldest and strongest kind of fear is fear of the unknown.',
      author: 'H.P. Lovecraft',
    },
  },
  'the-hollow-choir': {
    genre: 'A Spectral Mystery',
    epigraph: {
      quote: 'In the drowned city, even silence learns to sing.',
      author: 'Anonymous',
    },
  },
  'whispering-pines': {
    genre: 'A Psychological Horror',
    epigraph: {
      quote: "The cabin remembers what you've forgotten.",
      author: 'Local warning',
    },
  },
  'siren-of-the-red-dust': {
    genre: 'A Sci-Fi Thriller',
    epigraph: {
      quote: 'Mars keeps its secrets beneath the rust.',
      author: 'Colony proverb',
    },
  },
  'endless-path': {
    genre: 'A Cosmic Horror',
    epigraph: {
      quote: 'Every step forward is a step into the unknown.',
      author: 'The Wanderer',
    },
  },
};

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export const coverSrc = (id: string) => `/images/covers/${id}.webp`;

export interface StoryIndexItem {
  id: string;
  title: string;
  description: string;
  accentHex: string;
  comingSoon?: boolean;
}

/**
 * Engraved rule with a center fleuron — the title-page ornament.
 * Inherits color via currentColor; set text color on the wrapper.
 */
export function Ornament({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 ${className}`}
      aria-hidden
    >
      <span className="h-px w-12 bg-current opacity-40" />
      <svg width="7" height="7" viewBox="0 0 7 7" className="opacity-70">
        <path d="M3.5 0L7 3.5L3.5 7L0 3.5Z" fill="currentColor" />
      </svg>
      <span className="h-px w-12 bg-current opacity-40" />
    </div>
  );
}

/**
 * One door on the shelf — a full-height engraved plate that ignites on hover.
 * Parent decides the shelf layout: `flex flex-col md:flex-row` with a height.
 */
export function StoryDoor({
  story,
  index,
  onSelect,
}: {
  story: StoryIndexItem;
  index: number;
  onSelect: (id: string) => void;
}) {
  const meta = STORY_META[story.id];
  const accent = story.accentHex;
  const disabled = !!story.comingSoon;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(story.id)}
      className={`group relative overflow-hidden text-left min-h-44 md:min-h-0 md:h-full flex-1 border border-white/[0.06] transition-all duration-700 ease-out ${
        disabled
          ? 'cursor-not-allowed opacity-40'
          : 'cursor-pointer md:hover:flex-[2.2] hover:border-white/[0.14]'
      }`}
      style={{ '--ink': accent } as React.CSSProperties}
    >
      {/* The plate */}
      <img
        src={coverSrc(story.id)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center md:object-top brightness-[0.55] saturate-[0.85] group-hover:brightness-100 group-hover:saturate-100 group-hover:scale-[1.03] transition-all duration-700 ease-out"
      />

      {/* Legibility gradient */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10"
      />

      {/* The story's ink bleeding in on hover */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-25 transition-opacity duration-700 mix-blend-overlay"
        style={{ backgroundColor: accent }}
      />

      {/* Ink hairline igniting across the top */}
      <span
        aria-hidden
        className="absolute top-0 left-0 h-px w-0 group-hover:w-full transition-[width] duration-700 ease-out"
        style={{ backgroundColor: accent }}
      />

      {/* Title block */}
      <span className="absolute inset-x-0 bottom-0 flex flex-col p-5 md:p-6">
        <span
          className="font-literary text-xs tracking-[0.4em] pl-[0.4em] text-white/40 group-hover:text-[color:var(--ink)] transition-colors duration-500"
          aria-hidden
        >
          · {NUMERALS[index] ?? index + 1} ·
        </span>

        <span
          className="mt-2 uppercase tracking-[0.14em] text-lg md:text-xl leading-snug text-white/90 group-hover:text-white transition-colors duration-500 text-balance"
          style={storyTitleStyle(story.id)}
        >
          {story.title}
        </span>

        <span
          className="mt-2 text-[9px] uppercase tracking-[0.3em] transition-opacity duration-500 opacity-60 group-hover:opacity-100"
          style={{ color: disabled ? '#888' : accent }}
        >
          {disabled ? 'Coming Soon' : (meta?.genre ?? 'A Story')}
        </span>

        {/* Description + cue — unfold on hover (desktop) */}
        {!disabled && (
          <span className="hidden md:grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-700 ease-out">
            <span className="block overflow-hidden min-h-0">
              <span
                className="block pt-3 italic text-sm leading-relaxed text-white/60 max-w-xs"
                style={{ fontFamily: storyTitleStyle(story.id).fontFamily }}
              >
                {story.description}
              </span>
              <span className="mt-4 flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.4em] pl-[0.4em] text-[color:var(--ink)]">
                <span className="h-px w-6 bg-current" aria-hidden />
                Begin
              </span>
            </span>
          </span>
        )}
      </span>
    </button>
  );
}
