'use client';

import { motion } from 'framer-motion';
import {
  Mic,
  Sparkles,
  Users,
  Compass,
  Play,
  UserRound,
  BookOpen,
  Headphones,
  MousePointerClick,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pulse } from './ui/pulse';

const STORIES = [
  {
    title: 'Shadow Over Innsmouth',
    genre: 'Lovecraftian Horror',
    tagline: 'A decaying seaport hides a pact with the Deep Ones.',
    quote: '"The smell of salt and rot hung in the air. The locals wouldn\'t meet your eyes."',
    accentHex: '#4A9B8C',
  },
  {
    title: 'The Hollow Choir',
    genre: 'Spectral Mystery',
    tagline: 'A flooded city echoes with a song that should not exist.',
    quote: '"The melody rose from the water — beautiful, impossible, and very old."',
    accentHex: '#7B5AA6',
  },
  {
    title: 'The Whispering Pines',
    genre: 'Psychological Horror',
    tagline: 'A remote cabin where the forest whispers and the past returns.',
    quote: '"The trees leaned in closer at night. You were sure they hadn\'t been that close before."',
    accentHex: '#5B8A5B',
  },
  {
    title: 'Siren of the Red Dust',
    genre: 'Sci-Fi Thriller',
    tagline: 'A Mars colony falls silent. Something calls from the dunes.',
    quote: '"Colony New Cydonia went quiet on Sol 847. The last transmission was just breathing."',
    accentHex: '#B85C3A',
  },
  {
    title: 'The Endless Path',
    genre: 'Cosmic Horror',
    tagline: 'The comet returns. Time fractures. You become hunter and hunted.',
    quote: '"You saw yourself crossing the plaza. But you hadn\'t left the room yet."',
    accentHex: '#A8B4C4',
  },
];

const HOW_IT_WORKS = [
  {
    icon: BookOpen,
    step: '1',
    title: 'Pick a story',
    description: '5 worlds — from Lovecraftian horror to Mars thrillers. Solo or with friends.',
  },
  {
    icon: Headphones,
    step: '2',
    title: 'The AI narrates',
    description: 'A living narrator reads aloud, reacts to your choices, and shapes the story around you.',
  },
  {
    icon: MousePointerClick,
    step: '3',
    title: 'You decide',
    description: 'Every choice matters. The story branches, twists, and never plays the same way twice.',
  },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI Narrator',
    description: 'A living narrator that reacts to every choice. No two sessions are alike.',
  },
  {
    icon: Mic,
    title: 'Voice Narration',
    description: 'The story is read aloud with expressive AI voices. Just listen and play.',
  },
  {
    icon: Users,
    title: 'Solo or Multiplayer',
    description: 'Play alone or invite friends. Share a link — they join in seconds.',
  },
  {
    icon: Compass,
    title: '5 Story Worlds',
    description: 'Lovecraft horror, sci-fi thriller, psychological mystery, and more.',
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export function LandingPage() {
  const router = useRouter();

  const handlePlayNow = () => {
    router.push('/');
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-4 flex items-center justify-between bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Pulse />
          <span className="font-serif text-lg tracking-wide">The Pulse</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-16 md:pt-32 md:pb-20">
        <motion.div
          className="flex flex-col items-center text-center max-w-3xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {/* Pulse animation */}
          <motion.div
            className="mb-8"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <Pulse size="lg" />
          </motion.div>

          {/* Headline — what it IS */}
          <motion.h1
            className="text-3xl md:text-5xl lg:text-6xl font-serif font-light tracking-tight mb-5 leading-tight"
            {...fadeUp}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Play a story with your friends.
            <br />
            <span className="text-muted-foreground">No prep. No DM. Just play.</span>
          </motion.h1>

          {/* Subhead — how it works */}
          <motion.p
            className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl"
            {...fadeUp}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            An AI narrator runs the game in real-time. You make the choices.
            The story adapts. Think D&D — without the 4 hours of setup.
          </motion.p>

          {/* Dual CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row items-center gap-4 mb-4"
            {...fadeUp}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            {/* Primary: Play Now (solo) */}
            <motion.button
              type="button"
              onClick={handlePlayNow}
              className="
                inline-flex items-center gap-3
                px-8 py-4
                bg-foreground text-background
                font-serif text-lg
                rounded-md
                hover:bg-foreground/90
                transition-colors
                cursor-pointer
                w-full sm:w-auto justify-center
              "
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="w-5 h-5" />
              <span>Play Now</span>
            </motion.button>

            {/* Secondary: Start a Room (multiplayer) */}
            <motion.button
              type="button"
              onClick={handlePlayNow}
              className="
                inline-flex items-center gap-3
                px-8 py-4
                border border-foreground/20 text-foreground
                font-serif text-lg
                rounded-md
                hover:border-foreground/50 hover:bg-foreground/5
                transition-colors
                cursor-pointer
                w-full sm:w-auto justify-center
              "
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Users className="w-5 h-5" />
              <span>Start a Room</span>
            </motion.button>
          </motion.div>

          <motion.p
            className="text-xs text-muted-foreground/50"
            {...fadeUp}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            No account required — start playing in seconds
          </motion.p>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="px-6 md:px-12 py-16 border-t border-border/20">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-light text-center mb-12"
            {...fadeUp}
            whileInView="animate"
            viewport={{ once: true }}
            initial="initial"
          >
            Three steps. That&apos;s it.
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ staggerChildren: 0.15 }}
          >
            {HOW_IT_WORKS.map((step) => (
              <motion.div
                key={step.step}
                className="text-center"
                variants={fadeUp}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-foreground/10 mb-4">
                  <step.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="font-serif text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 md:px-12 py-16 border-t border-border/20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-12"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ staggerChildren: 0.1 }}
          >
            {FEATURES.map((feature) => (
              <motion.div
                key={feature.title}
                className="flex gap-4"
                variants={fadeUp}
                transition={{ duration: 0.5 }}
              >
                <div className="shrink-0 mt-1">
                  <feature.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-serif text-lg mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Story Worlds */}
      <section className="px-6 md:px-12 py-16 border-t border-border/20">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="font-serif text-2xl md:text-3xl font-light text-center mb-12"
            {...fadeUp}
            whileInView="animate"
            viewport={{ once: true }}
            initial="initial"
          >
            5 worlds. Each one different.
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 gap-4"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-40px' }}
            transition={{ staggerChildren: 0.08 }}
          >
            {STORIES.map((story) => (
              <motion.button
                key={story.title}
                type="button"
                onClick={handlePlayNow}
                className="
                  text-left w-full
                  border-l-4 pl-6 md:pl-8 py-6
                  hover:bg-foreground/[0.03]
                  transition-all duration-300
                  cursor-pointer group
                  rounded-r-md
                "
                style={{ borderColor: `${story.accentHex}40` }}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                whileHover={{
                  borderColor: story.accentHex,
                }}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1.5">
                      {story.genre}
                    </span>
                    <h3 className="font-serif text-lg md:text-xl group-hover:text-foreground transition-colors">
                      {story.title}
                    </h3>
                  </div>
                  <span className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 hidden sm:block">
                    →
                  </span>
                </div>
                <p className="text-sm text-muted-foreground/60 mt-1.5 leading-relaxed">
                  {story.tagline}
                </p>
                <p
                  className="text-xs italic mt-3 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ color: story.accentHex }}
                >
                  {story.quote}
                </p>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Social Proof / Why It Works */}
      <section className="px-6 md:px-12 py-16 border-t border-border/20">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          {...fadeUp}
          whileInView="animate"
          viewport={{ once: true }}
          initial="initial"
        >
          <p className="text-muted-foreground/60 text-sm uppercase tracking-widest mb-6">
            Every session is unique
          </p>
          <p className="font-serif text-xl md:text-2xl font-light leading-relaxed mb-10">
            No scripts. No rails. The AI narrator reads the room and adapts the story
            to your choices. What happens is up to you.
          </p>

          {/* Player quotes / atmosphere */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 text-left">
            <motion.div
              className="border border-border/20 rounded-md p-5"
              variants={fadeUp}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                &ldquo;We lost two players in Innsmouth and the narrator turned our grief into a plot twist.&rdquo;
              </p>
              <p className="text-xs text-muted-foreground/40 mt-3">— 4-player session, 47 min</p>
            </motion.div>
            <motion.div
              className="border border-border/20 rounded-md p-5"
              variants={fadeUp}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                &ldquo;The voice narration made it feel like someone was actually running the game for us.&rdquo;
              </p>
              <p className="text-xs text-muted-foreground/40 mt-3">— Solo session, The Hollow Choir</p>
            </motion.div>
            <motion.div
              className="border border-border/20 rounded-md p-5"
              variants={fadeUp}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                &ldquo;D&D without the 4 hours of prep. Shared the link and we were playing in 30 seconds.&rdquo;
              </p>
              <p className="text-xs text-muted-foreground/40 mt-3">— 3-player session, Red Dust</p>
            </motion.div>
          </div>

          {/* Final CTA */}
          <motion.button
            type="button"
            onClick={handlePlayNow}
            className="
              inline-flex items-center gap-3
              px-8 py-4
              bg-foreground text-background
              font-serif text-lg
              rounded-md
              hover:bg-foreground/90
              transition-colors
              cursor-pointer
            "
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <UserRound className="w-5 h-5" />
            <span>Start Your First Story</span>
          </motion.button>
          <p className="mt-3 text-xs text-muted-foreground/40">
            ~30 minutes · Free to play · No signup
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center border-t border-border/30">
        <p className="text-sm text-muted-foreground mb-2">
          Already have an account?{' '}
          <Link href="/login" className="text-foreground hover:underline">
            Sign in
          </Link>
        </p>
        <p className="text-xs text-muted-foreground/40">© 2026 The Pulse</p>
      </footer>
    </div>
  );
}
