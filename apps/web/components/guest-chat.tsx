'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useGuestSession } from '@/hooks/use-guest-session';
import { Pulse } from './ui/pulse';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { SoftGateModal } from './soft-gate-modal';
import { ArrowUpIcon, StopIcon } from './icons';
import { MAX_GUEST_PULSES } from '@/lib/guest-session';

interface GuestChatProps {
  onBack?: () => void;
}

export function GuestChat({ onBack }: GuestChatProps) {
  const {
    session,
    addMessage,
    shouldShowSoftGate,
    markSoftGateShown,
    pulseCount,
    maxPulses,
  } = useGuestSession();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showSoftGate, setShowSoftGate] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check for soft gate on mount and after each message
  useEffect(() => {
    if (shouldShowSoftGate()) {
      setShowSoftGate(true);
      markSoftGateShown();
    }
  }, [shouldShowSoftGate, markSoftGateShown, pulseCount]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!input.trim() || isLoading || !session) return;

      // Check pulse limit before sending
      if (pulseCount >= MAX_GUEST_PULSES) {
        setShowSoftGate(true);
        return;
      }

      const userMessage = input.trim();
      setInput('');
      setIsLoading(true);
      setStreamingContent('');

      // Add user message to session
      addMessage({ role: 'user', content: userMessage });

      // Prepare messages for API (convert to format expected by AI SDK)
      const apiMessages = [
        ...(session.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })) || []),
        { role: 'user' as const, content: userMessage },
      ];

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch('/api/guest-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            pulseCount: session.pulseCount,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (errorData.error === 'GUEST_LIMIT_REACHED') {
            setShowSoftGate(true);
            setIsLoading(false);
            return;
          }
          throw new Error(errorData.message || 'Failed to get response');
        }

        // Stream the response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullContent += chunk;
            setStreamingContent(fullContent);
          }
        }

        // Add assistant message to session
        addMessage({ role: 'assistant', content: fullContent });
        setStreamingContent('');
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User stopped generation
          if (streamingContent) {
            addMessage({ role: 'assistant', content: streamingContent });
          }
        } else {
          console.error('Chat error:', error);
          // Optionally show error toast
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [input, isLoading, session, pulseCount, addMessage, streamingContent]
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Combine session messages with streaming content for display
  const displayMessages = [
    ...(session?.messages || []),
    ...(streamingContent
      ? [{ id: 'streaming', role: 'assistant' as const, content: streamingContent, createdAt: '' }]
      : []),
  ];

  const isFirstMessage = !session?.messages.length;

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Pulse />
            <span className="font-serif text-lg">The Pulse</span>
          </Link>
          <span className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded">
            Guest
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Pulse counter */}
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{pulseCount}</span>
            <span className="mx-1">/</span>
            <span>{maxPulses}</span>
            <span className="ml-1 text-xs">pulses</span>
          </div>

          <Link
            href="/register"
            className="text-sm text-primary hover:underline"
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* First message prompt */}
          {isFirstMessage && !isLoading && (
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-2xl font-serif mb-4">
                Shadow Over Innsmouth
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Send your first message to begin the story. The narrator will
                guide you through character creation and into the mystery.
              </p>
              <p className="text-sm text-muted-foreground/60 italic">
                Try: "I'm ready to begin" or "Let's start the adventure"
              </p>
            </motion.div>
          )}

          {/* Messages */}
          {displayMessages.map((message, index) => (
            <motion.div
              key={message.id || index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </p>
              </div>
            </motion.div>
          ))}

          {/* Loading indicator */}
          {isLoading && !streamingContent && (
            <motion.div
              className="flex justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <motion.div
                    className="size-2 bg-foreground/40 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                  />
                  <span>The narrator is crafting your tale...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 p-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto flex gap-2 items-end"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              pulseCount >= MAX_GUEST_PULSES
                ? 'Create an account to continue...'
                : 'What do you do?'
            }
            disabled={isLoading || pulseCount >= MAX_GUEST_PULSES}
            className="min-h-[44px] max-h-[200px] resize-none"
            rows={1}
          />

          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handleStop}
              className="shrink-0"
            >
              <StopIcon size={16} />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || pulseCount >= MAX_GUEST_PULSES}
              className="shrink-0"
            >
              <ArrowUpIcon size={16} />
            </Button>
          )}
        </form>

        {/* Progress indicator */}
        <div className="max-w-2xl mx-auto mt-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-foreground/30"
              initial={{ width: 0 }}
              animate={{ width: `${(pulseCount / maxPulses) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1 text-center">
            {pulseCount < maxPulses
              ? `${maxPulses - pulseCount} free pulses remaining`
              : 'Create an account to continue your adventure'}
          </p>
        </div>
      </div>

      {/* Soft Gate Modal */}
      {showSoftGate && (
        <SoftGateModal
          onClose={() => setShowSoftGate(false)}
          pulseCount={pulseCount}
        />
      )}
    </div>
  );
}
