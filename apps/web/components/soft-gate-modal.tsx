'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button } from './ui/button';
import { Pulse } from './ui/pulse';

interface SoftGateModalProps {
  onClose: () => void;
  pulseCount: number;
}

export function SoftGateModal({ onClose, pulseCount }: SoftGateModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative max-w-lg w-full mx-4 p-8 bg-background border border-border rounded-lg shadow-2xl"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
        >
          {/* Pulse decoration */}
          <div className="flex justify-center mb-6">
            <Pulse />
          </div>

          {/* Headline */}
          <h2 className="text-2xl md:text-3xl font-serif text-center mb-4">
            The Story Continues...
          </h2>

          {/* Description */}
          <p className="text-muted-foreground text-center mb-6 leading-relaxed">
            You've experienced {pulseCount} pulses of{' '}
            <span className="text-foreground font-medium">
              Shadow Over Innsmouth
            </span>
            . Create a free account to continue your adventure and unlock all
            five stories.
          </p>

          {/* Teaser quote */}
          <blockquote className="border-l-2 border-foreground/20 pl-4 mb-8 py-2">
            <p className="text-sm italic text-muted-foreground/80">
              "The shadows deepen around you. The truth of Innsmouth awaits
              those who dare to continue..."
            </p>
          </blockquote>

          {/* Benefits list */}
          <div className="mb-8 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-foreground">✓</span>
              <span>Unlimited story pulses</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-foreground">✓</span>
              <span>Access to all 5 stories</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-foreground">✓</span>
              <span>Voice narration & AI imagery</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-foreground">✓</span>
              <span>Save your progress</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="w-full font-serif text-lg">
              <Link href="/register">Create Free Account</Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full"
            >
              <Link href="/login">Already have an account? Sign in</Link>
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
            >
              Maybe later
            </button>
          </div>

          {/* Note about progress */}
          <p className="text-xs text-muted-foreground/60 text-center mt-6">
            Your progress is saved locally and will be restored when you create
            an account.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
