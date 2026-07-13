'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Pulse } from './ui/pulse';
import {
  coverSrc,
  Ornament,
  StoryDoor,
  type StoryIndexItem,
} from './story-index';

/* The brand's red ink — used sparingly, like the covers */
const INK = '#B04A50';

/* Lightweight story list for the public page (no story guides in this bundle) */
const STORIES: StoryIndexItem[] = [
  {
    id: 'shadow-over-innsmouth',
    title: 'Shadow Over Innsmouth',
    description:
      'A decaying seaport hides a pact with the Deep Ones. Drawn by a cryptic call, players uncover a dread truth—or their own watery doom.',
    accentHex: '#4A9B8C',
  },
  {
    id: 'the-hollow-choir',
    title: 'The Hollow Choir',
    description:
      'A flooded city echoes with a spectral song. Adrift on a raft with name-etched shards, players face a sunken mystery—or its haunting pull.',
    accentHex: '#7B5AA6',
  },
  {
    id: 'whispering-pines',
    title: 'The Whispering Pines',
    description:
      'Strangers drawn to a remote cabin where the forest whispers secrets and the past refuses to stay buried.',
    accentHex: '#5B8A5B',
  },
  {
    id: 'siren-of-the-red-dust',
    title: 'Siren of the Red Dust',
    description:
      'A Mars colony stood firm until a siren called from the dunes. Crews faced dust chanters—and a traitor holding the reins.',
    accentHex: '#B85C3A',
  },
  {
    id: 'endless-path',
    title: 'The Endless Path',
    description:
      "Every century, Taggart's Comet returns—and with it, a night where time fractures and you become both hunter and hunted.",
    accentHex: '#A8B4C4',
  },
];

const SAMPLE_CHOICES = [
  'Walk down into the town before the light fails',
  'Ask the driver what he knows — and why he won’t stay',
  'Follow the sound of the bell',
];

const HOW_IT_PLAYS = [
  {
    numeral: 'I',
    title: 'Pick a story',
    detail: 'Five worlds, from a drowned seaport to the red dust of Mars.',
  },
  {
    numeral: 'II',
    title: 'The narrator reads',
    detail: 'Out loud, with pictures. It sets the scene and waits.',
  },
  {
    numeral: 'III',
    title: 'You answer',
    detail: 'Type what you do. The narrator deals with it.',
  },
];

function InkButton({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-8 py-3.5 font-mono text-[11px] uppercase tracking-[0.3em] pl-[calc(2rem+0.3em)] border transition-colors duration-300 cursor-pointer"
      style={
        primary
          ? { borderColor: `${INK}99`, color: '#d98a8e' }
          : {
              borderColor: 'rgba(255,255,255,0.25)',
              color: 'rgba(255,255,255,0.75)',
            }
      }
    >
      {children}
    </button>
  );
}

/** Slow crossfading slideshow of the five plates behind the hero. */
function HeroPlates() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setActive((a) => (a + 1) % STORIES.length);
    }, 7000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {STORIES.map((s, i) => (
        <motion.img
          key={s.id}
          src={coverSrc(s.id)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
          initial={false}
          animate={{
            opacity: i === active ? 0.45 : 0,
            scale: i === active ? 1.06 : 1,
          }}
          transition={{ duration: 2.4, ease: 'easeInOut' }}
        />
      ))}
      {/* Keep the title legible */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_45%,rgba(0,0,0,0.75)_0%,rgba(0,0,0,0.35)_60%,rgba(0,0,0,0.1)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[hsl(240,10%,3.9%)] to-transparent" />
    </div>
  );
}

export function LandingPage() {
  const router = useRouter();

  const begin = () => router.push('/');

  return (
    <div className="relative min-h-dvh">
      {/* Film grain */}
      <div
        className="fixed inset-0 pointer-events-none z-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: 0.03,
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-5 bg-gradient-to-b from-black/70 to-transparent">
        <span className="font-literary uppercase tracking-[0.3em] text-xs text-white/70">
          The Pulse
        </span>
        <Link
          href="/login"
          className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 hover:text-white transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* ————— The cover ————— */}
      <section className="relative min-h-dvh flex flex-col items-center justify-center px-6 py-24 text-center">
        <HeroPlates />

        <motion.div
          className="relative flex flex-col items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.5em] pl-[0.5em] text-white/40">
            AI-narrated interactive fiction
          </p>

          <div className="my-8">
            <Pulse size="md" />
          </div>

          <h1
            className="font-literary uppercase tracking-[0.25em] pl-[0.25em] text-4xl md:text-6xl leading-tight"
            style={{ color: INK, textShadow: `0 0 50px ${INK}55` }}
          >
            The Pulse
          </h1>

          <p className="mt-5 text-[10px] uppercase tracking-[0.45em] pl-[0.45em] text-white/50">
            An Anthology of Unwritten Stories
          </p>

          <div className="mt-8 text-white/50">
            <Ornament />
          </div>

          <p className="mt-8 font-literary italic text-lg md:text-xl leading-relaxed text-white/70 max-w-xl text-balance">
            An AI narrator tells the story out loud and makes it up around you
            as you play. No prep. No DM. Nobody knows the ending — not even us.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row items-center gap-4">
            <InkButton onClick={begin} primary>
              Begin a story
            </InkButton>
            <InkButton onClick={begin}>Start a room</InkButton>
          </div>

          <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.3em] pl-[0.3em] text-white/35">
            Free to play · No account required
          </p>
        </motion.div>
      </section>

      {/* ————— Contents: the shelf of doors ————— */}
      <section className="px-3 md:px-5 py-20 md:py-28">
        <motion.p
          className="mb-8 text-center font-mono text-[10px] uppercase tracking-[0.5em] pl-[0.5em] text-white/30"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9 }}
        >
          Contents · Five doors
        </motion.p>

        <motion.div
          className="h-[78vh] min-h-[540px] max-h-[900px] flex flex-col md:flex-row gap-2 md:gap-2.5 max-w-[1800px] mx-auto"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1 }}
        >
          {STORIES.map((story, index) => (
            <StoryDoor
              key={story.id}
              story={story}
              index={index}
              onSelect={begin}
            />
          ))}
        </motion.div>
      </section>

      {/* ————— A pulse, shown not told ————— */}
      <section className="px-6 py-20 md:py-28">
        <motion.div
          className="mx-auto max-w-xl"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9 }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] pl-[0.4em] text-white/30 mb-8 text-center">
            How a pulse reads — Shadow Over Innsmouth
          </p>

          <div
            className="pl-6 md:pl-8"
            style={{ borderLeft: '2px solid #4A9B8C' }}
          >
            <p className="font-literary italic text-lg md:text-xl leading-[1.9] text-white/75">
              The bus coughs to a stop where the cliff road ends. Below,
              Innsmouth spreads along the grey harbor like something washed
              ashore — salt-bleached roofs, a church with no cross, streets that
              bend away from the water as if flinching. The driver won&rsquo;t
              look at you. &ldquo;Last stop,&rdquo; he says, to the windshield.
              Somewhere below, a bell begins to ring, though the church tower
              stands empty.
            </p>
          </div>

          <div className="mt-10 border-b border-white/[0.08]">
            {SAMPLE_CHOICES.map((choice, i) => (
              <button
                key={choice}
                type="button"
                onClick={begin}
                className="group w-full flex items-baseline gap-4 px-3 py-4 border-t border-white/[0.08] text-left hover:bg-white/[0.03] transition-colors duration-300 cursor-pointer"
              >
                <span className="font-literary text-sm text-white/25 group-hover:text-[#4A9B8C] transition-colors">
                  {i + 1}.
                </span>
                <span className="font-literary text-base text-white/60 group-hover:text-white/90 transition-colors">
                  {choice}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-8 text-center font-literary italic text-sm text-white/30">
            Then it&rsquo;s your turn.
          </p>
        </motion.div>
      </section>

      {/* ————— How it plays ————— */}
      <section className="px-6 py-20 md:py-28">
        <motion.div
          className="mx-auto max-w-xl flex flex-col items-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9 }}
        >
          <div className="text-white/40 mb-10">
            <Ornament />
          </div>

          <div className="w-full space-y-10">
            {HOW_IT_PLAYS.map((step) => (
              <div
                key={step.numeral}
                className="flex flex-col items-center text-center"
              >
                <span
                  className="font-literary text-sm tracking-[0.5em] pl-[0.5em]"
                  style={{ color: INK }}
                >
                  · {step.numeral} ·
                </span>
                <h3 className="mt-3 font-literary uppercase tracking-[0.2em] pl-[0.2em] text-lg text-white/85">
                  {step.title}
                </h3>
                <p className="mt-2 font-literary italic text-[15px] text-white/40 max-w-sm">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ————— Closing ————— */}
      <section className="px-6 py-20 md:py-28 flex flex-col items-center text-center">
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9 }}
        >
          <p className="font-literary italic text-xl md:text-2xl text-white/70">
            The narrator is waiting.
          </p>
          <div className="mt-10">
            <InkButton onClick={begin} primary>
              Begin a story
            </InkButton>
          </div>
          <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.3em] pl-[0.3em] text-white/25">
            ~30 minutes · Free to play · No signup
          </p>
        </motion.div>
      </section>

      {/* ————— Colophon ————— */}
      <footer className="px-6 pb-14 pt-8 flex flex-col items-center gap-4 text-center">
        <div className="text-white/25">
          <Ornament />
        </div>
        <p className="font-literary text-xs text-white/35">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-white/60 hover:text-white underline underline-offset-4 decoration-white/20 transition-colors"
          >
            Sign in
          </Link>
        </p>
        <p className="font-mono text-[9px] uppercase tracking-[0.5em] pl-[0.5em] text-white/20">
          The Pulse · MMXXVI
        </p>
      </footer>
    </div>
  );
}
