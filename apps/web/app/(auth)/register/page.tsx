'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Form from 'next/form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/submit-button';
import { register, type RegisterActionState } from '../actions';

const ATMOSPHERIC_QUOTES = [
  {
    text: 'That is not dead which can eternal lie, and with strange aeons even death may die.',
    author: 'H.P. Lovecraft',
  },
  {
    text: 'The most merciful thing in the world is the inability of the human mind to correlate all its contents.',
    author: 'H.P. Lovecraft',
  },
  {
    text: 'Who knows the end? What has risen may sink, and what has sunk may rise.',
    author: 'H.P. Lovecraft',
  },
];

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [quote] = useState(
    () => ATMOSPHERIC_QUOTES[Math.floor(Math.random() * ATMOSPHERIC_QUOTES.length)]
  );

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    { status: 'idle' }
  );

  useEffect(() => {
    if (state.status === 'user_exists') {
      toast.error('Account already exists');
    } else if (state.status === 'failed') {
      toast.error('Failed to create account');
    } else if (state.status === 'invalid_data') {
      toast.error('Failed validating your submission!');
    } else if (state.status === 'invalid_invite_code') {
      toast.error('Invalid invite code');
    } else if (state.status === 'success') {
      toast.success('Account created successfully');
      setIsSuccessful(true);
      router.refresh();
    }
  }, [state, router]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get('email') as string);
    setInviteCode(formData.get('inviteCode') as string);
    formAction(formData);
  };

  return (
    <div className="min-h-dvh w-screen flex flex-col lg:flex-row">
      {/* Left Panel - Atmospheric */}
      <motion.div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-transparent to-black/80" />

        {/* Subtle noise texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Pulsing orb - larger, more atmospheric */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="size-32 bg-background rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.15, 0.3],
              boxShadow: [
                '0 0 0 0 rgba(255, 255, 255, 0.2)',
                '0 0 80px 40px rgba(255, 255, 255, 0.05)',
                '0 0 0 0 rgba(255, 255, 255, 0.2)',
              ],
            }}
            transition={{
              duration: 4,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
            }}
          />
        </div>

        {/* Quote content */}
        <div className="relative z-10 flex flex-col justify-end p-12 xl:p-16 text-background">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            {/* Vertical line accent */}
            <div className="w-px h-24 bg-gradient-to-b from-transparent via-background/40 to-transparent mb-8" />

            <blockquote className="max-w-md">
              <p className="font-serif text-xl xl:text-2xl leading-relaxed text-background/90 italic mb-6">
                "{quote.text}"
              </p>
              <cite className="text-sm text-background/50 not-italic tracking-wide">
                — {quote.author}
              </cite>
            </blockquote>
          </motion.div>
        </div>

        {/* Brand mark */}
        <motion.div
          className="absolute top-8 left-12 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <motion.div
            className="size-3 bg-background rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.7, 0.3, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
            }}
          />
          <span className="font-serif text-sm tracking-wide text-background/70">
            The Pulse
          </span>
        </motion.div>
      </motion.div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col min-h-dvh lg:min-h-0">
        {/* Mobile header */}
        <motion.header
          className="lg:hidden px-6 py-6 flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/" className="flex items-center gap-3">
            <motion.div
              className="size-3 bg-foreground rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.7, 0.3, 0.7],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              }}
            />
            <span className="font-serif text-sm tracking-wide">The Pulse</span>
          </Link>
        </motion.header>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:py-0">
          <motion.div
            className="w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            {/* Header */}
            <div className="mb-10">
              <motion.h1
                className="font-serif text-3xl lg:text-4xl font-light tracking-tight mb-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Begin your journey
              </motion.h1>
              <motion.p
                className="text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                Create an account to save your stories
              </motion.p>
            </div>

            {/* Form */}
            <Form action={handleSubmit} className="space-y-6">
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <Label
                  htmlFor="email"
                  className="text-sm font-normal text-muted-foreground"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  autoFocus
                  defaultValue={email}
                  className="h-12 bg-transparent border-border/50 focus:border-foreground/50 transition-colors"
                />
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <Label
                  htmlFor="password"
                  className="text-sm font-normal text-muted-foreground"
                >
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="h-12 bg-transparent border-border/50 focus:border-foreground/50 transition-colors"
                />
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                <Label
                  htmlFor="inviteCode"
                  className="text-sm font-normal text-muted-foreground"
                >
                  Invite Code
                </Label>
                <Input
                  id="inviteCode"
                  name="inviteCode"
                  type="text"
                  placeholder="Enter your invite code"
                  required
                  defaultValue={inviteCode}
                  className="h-12 bg-transparent border-border/50 focus:border-foreground/50 transition-colors"
                />
                <p className="text-xs text-muted-foreground/60 mt-1">
                  The Pulse is currently invite-only
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="pt-2"
              >
                <SubmitButton isSuccessful={isSuccessful}>
                  <span className="font-serif">Create Account</span>
                </SubmitButton>
              </motion.div>
            </Form>

            {/* Divider */}
            <motion.div
              className="flex items-center gap-4 my-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.4 }}
            >
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">
                or
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </motion.div>

            {/* Links */}
            <motion.div
              className="space-y-4 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.4 }}
            >
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-foreground hover:underline underline-offset-4 transition-colors"
                >
                  Sign in
                </Link>
              </p>
              <p className="text-sm">
                <Link
                  href="/"
                  className="text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                >
                  ← Back to stories
                </Link>
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Mobile quote */}
        <motion.div
          className="lg:hidden px-6 py-8 border-t border-border/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          <blockquote className="max-w-sm mx-auto text-center">
            <p className="font-serif text-sm italic text-muted-foreground/70 mb-2">
              "{quote.text}"
            </p>
            <cite className="text-xs text-muted-foreground/40 not-italic">
              — {quote.author}
            </cite>
          </blockquote>
        </motion.div>
      </div>
    </div>
  );
}
