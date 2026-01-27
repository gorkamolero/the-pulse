'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pulse } from './ui/pulse';

const INNSMOUTH_QUOTE = {
  text: 'The oldest and strongest emotion of mankind is fear, and the oldest and strongest kind of fear is fear of the unknown.',
  author: 'H.P. Lovecraft',
};

const INNSMOUTH_DESCRIPTION =
  'A decaying seaport hides a pact with the Deep Ones. Drawn by a cryptic call, players uncover a dread truth—or their own watery doom.';

export function LandingPage() {
  const router = useRouter();

  const handleBeginStory = () => {
    router.push('/');
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-4 flex items-center justify-between">
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
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-8">
        <motion.div
          className="flex flex-col items-center text-center max-w-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* Large Pulse */}
          <motion.div
            className="mb-10"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <motion.div
              className="size-16 md:size-20 bg-foreground rounded-full"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.7, 0.4, 0.7],
                boxShadow: [
                  '0 0 0 0 rgba(255, 255, 255, 0.4)',
                  '0 0 0 30px rgba(255, 255, 255, 0)',
                  '0 0 0 0 rgba(255, 255, 255, 0.4)',
                ],
              }}
              transition={{
                duration: 2.5,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              }}
            />
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-serif font-light tracking-tight mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            Stories that breathe.
          </motion.h1>

          {/* Subhead */}
          <motion.p
            className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            AI-powered interactive fiction with voice, imagery,
            <br className="hidden md:block" /> and choices that matter.
          </motion.p>

          {/* Animated divider */}
          <motion.div
            className="w-px h-16 bg-gradient-to-b from-transparent via-muted-foreground/40 to-transparent"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.8 }}
          />
        </motion.div>
      </section>

      {/* Story Showcase */}
      <section className="px-6 md:px-12 pb-12">
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.1, duration: 0.7 }}
        >
          <div
            className="
              border-l-4 border-foreground/20 hover:border-foreground/60
              pl-8 md:pl-12 py-8
              transition-all duration-500
            "
          >
            {/* Genre tag */}
            <span className="text-xs uppercase tracking-widest text-muted-foreground/60 mb-4 block">
              Lovecraftian Horror
            </span>

            {/* Title */}
            <h2 className="text-3xl md:text-4xl font-serif font-normal mb-6">
              Shadow Over Innsmouth
            </h2>

            {/* Epigraph */}
            <blockquote className="border-l border-muted-foreground/30 pl-4 mb-8">
              <p className="text-sm md:text-base italic text-muted-foreground/80 mb-2">
                "{INNSMOUTH_QUOTE.text}"
              </p>
              <cite className="text-xs text-muted-foreground/50 not-italic">
                — {INNSMOUTH_QUOTE.author}
              </cite>
            </blockquote>

            {/* Description */}
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-8">
              {INNSMOUTH_DESCRIPTION}
            </p>

            {/* Divider */}
            <div className="w-24 h-px bg-muted-foreground/20 mb-8" />

            {/* Features */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/60 uppercase tracking-wide mb-10">
              <span>~30 minutes</span>
              <span className="text-muted-foreground/30">·</span>
              <span>Voice narration</span>
              <span className="text-muted-foreground/30">·</span>
              <span>AI imagery</span>
              <span className="text-muted-foreground/30">·</span>
              <span>5 free pulses</span>
            </div>

            {/* CTA Button */}
            <motion.button
              type="button"
              onClick={handleBeginStory}
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
              <span>Begin Your Story</span>
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }}
              >
                →
              </motion.span>
            </motion.button>

            {/* No login note */}
            <p className="mt-4 text-xs text-muted-foreground/50">
              No account required to start
            </p>
          </div>
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
        <p className="text-xs text-muted-foreground/40">© 2024 The Pulse</p>
      </footer>
    </div>
  );
}
