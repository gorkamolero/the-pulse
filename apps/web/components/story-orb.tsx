'use client';

import { useAtomValue } from 'jotai';
import { Orb } from '@/components/ui/orb';
import { useAudioAnalyser } from '@/hooks/use-audio-analyser';
import { narratorStateAtom, storyAccentAtom } from '@/lib/atoms';
import { cn } from '@/lib/utils';

/**
 * Fallback palettes when no story is active — pale ghostly blue-grey.
 */
const FALLBACK_COLORS = {
  idle: ['#8fa4b8', '#6b8299'] as [string, string],
  thinking: ['#9a8ba8', '#7a6b88'] as [string, string],
  talking: ['#a8b4c4', '#8899aa'] as [string, string],
};

type OrbState = 'idle' | 'thinking' | 'talking';

function hexToHsl(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * The narrator's presence takes on the story's ink:
 * a darker and a lighter cut of the accent, brightening as it speaks.
 */
function orbPalette(accent: string | null, state: OrbState): [string, string] {
  if (!accent) return FALLBACK_COLORS[state];
  const [h, s] = hexToHsl(accent);
  switch (state) {
    case 'thinking':
      return [hslToHex(h, s * 0.5, 0.3), hslToHex(h, s * 0.6, 0.5)];
    case 'talking':
      return [hslToHex(h, s * 0.95, 0.48), hslToHex(h, s, 0.72)];
    default:
      return [hslToHex(h, s * 0.7, 0.38), hslToHex(h, s * 0.8, 0.6)];
  }
}

interface StoryOrbProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * The Pulse's audio-reactive orb visualization.
 *
 * Connects to global narrator state and audio playback for:
 * - Visual state changes (idle, thinking, talking)
 * - Audio-reactive pulsing during TTS playback (via proxy for CORS)
 * - Story-tinted palette via storyAccentAtom
 */
export function StoryOrb({ className, size = 'md' }: StoryOrbProps) {
  const narratorState = useAtomValue(narratorStateAtom);
  const accent = useAtomValue(storyAccentAtom);
  const { getOutputVolume, isPlaying } = useAudioAnalyser();

  const state: OrbState =
    narratorState === 'thinking' ? 'thinking' : isPlaying ? 'talking' : 'idle';
  const colors = orbPalette(accent, state);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
    xl: 'w-96 h-96',
  };

  return (
    <div className={cn(sizeClasses[size], className)}>
      <Orb
        colors={colors}
        agentState={narratorState}
        getOutputVolume={getOutputVolume}
        className="w-full h-full"
      />
    </div>
  );
}
