'use client';

import type { UIMessage, CreateUIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';

type Attachment = {
  url: string;
  name?: string;
  contentType?: string;
};
type ChatRequestOptions = {
  experimental_attachments?: Array<Attachment>;
  body?: Record<string, unknown>;
};
import { useState, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { BookOpen, MessageSquare, Volume2 } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { useAtomValue, useSetAtom } from 'jotai';
import { stories } from '@pulse/core/ai/stories';
import { initStoryTypography, resetStoryTypography } from '@/lib/font-loader';

import { StoryDisplay } from '@/components/story-display';
import { StoryLoadingModal } from '@/components/story-loading-modal';
import { ShareCard } from '@/components/share-card';
import {
  agentMessageIdsAtom,
  audioEnabledAtom,
  narratorStateAtom,
  storyAccentAtom,
  storyBegunAtom,
} from '@/lib/atoms';
import { ChatHeader } from '@/components/chat-header';
import { getUIMessageContent } from '@/lib/utils';
import { DEFAULT_STORY_ID } from '@pulse/core/ai/stories';
import { useGuestSession } from '@/hooks/use-guest-session';
import { useAmbientAudio } from '@/hooks/use-ambient-audio';
import { bindLiveNarration, useNarratorAgent } from '@/hooks/use-narrator-agent';
import { getNarratorAgentId } from '@/lib/ai/narrator-agents';
import { RoomNarrationContext } from '@/components/multiplayer/room-narration';
import { SoftGateModal } from './soft-gate-modal';

import { Overview } from './overview';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useIsMobile } from '@/hooks/use-mobile';

export function Chat({
  id,
  initialMessages,
  selectedVisibilityType,
  isReadonly,
  user,
  disabled,
  disabledReason,
  initialStoryId,
  initialSoloMode = true,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
  disabled?: boolean;
  disabledReason?: string;
  initialStoryId?: string;
  initialSoloMode?: boolean;
}) {
  const { mutate } = useSWRConfig();
  const isMobile = useIsMobile();
  const [mobilePanelView, setMobilePanelView] = useState<'story' | 'messages'>(
    'messages',
  );
  const [selectedStoryId, setSelectedStoryId] = useState(
    initialStoryId ?? DEFAULT_STORY_ID,
  );
  const [isSoloMode, setIsSoloMode] = useState(initialSoloMode);
  const [language, setLanguage] = useState<string>('en');
  const audioEnabled = useAtomValue(audioEnabledAtom);
  const setStoryBegun = useSetAtom(storyBegunAtom);

  // In a multiplayer room, only the spokesperson's browser talks to the narrator agent;
  // it relays the voice and text so every other player hears and reads it live
  const roomBus = useContext(RoomNarrationContext);
  const isRoomListener = roomBus !== null && Boolean(disabled);

  // Simple 3-phase UI state (no race conditions):
  // - 'overview': Story selection screen
  // - 'loading': Black screen + loading modal (story starting)
  // - 'chat': Full chat interface
  // A room chose its story in the lobby, so its players go straight to Begin
  const roomBeginsAtModal =
    initialMessages.length === 0 &&
    roomBus !== null &&
    Boolean(initialStoryId && getNarratorAgentId(initialStoryId, false));
  const [phase, setPhase] = useState<'overview' | 'loading' | 'chat'>(
    initialMessages.length > 0 ? 'chat' : roomBeginsAtModal ? 'loading' : 'overview',
  );
  const roomBeginsAtModalRef = useRef(roomBeginsAtModal);

  // If returning to existing session, mark story as begun for audio autoplay
  useEffect(() => {
    if (initialMessages.length > 0) {
      setStoryBegun(true);
    }
  }, [initialMessages.length, setStoryBegun]);

  // Get selected story for ambient audio
  const selectedStory = useMemo(
    () => stories.find((s) => s.id === selectedStoryId),
    [selectedStoryId],
  );

  // Tint the narrator orb with the story's ink
  const setStoryAccent = useSetAtom(storyAccentAtom);
  useEffect(() => {
    setStoryAccent(selectedStory?.theme?.accentHex ?? null);
  }, [selectedStory, setStoryAccent]);

  // Play ambient audio when in chat phase
  useAmbientAudio(phase === 'chat' ? selectedStory?.ambientAudio : undefined);

  // Guest session tracking
  const isGuest = !user?.id;
  const {
    session: guestSession,
    initSession,
    addMessage: addGuestMessage,
    shouldShowSoftGate,
    markSoftGateShown,
    pulseCount,
    maxPulses,
  } = useGuestSession();
  const [showSoftGate, setShowSoftGate] = useState(false);

  // Initialize guest session on mount if guest
  useEffect(() => {
    if (isGuest && !guestSession) {
      initSession();
    }
  }, [isGuest, guestSession, initSession]);

  // Check for soft gate after pulse count changes
  useEffect(() => {
    if (isGuest && shouldShowSoftGate()) {
      setShowSoftGate(true);
      markSoftGateShown();
    }
  }, [isGuest, shouldShowSoftGate, markSoftGateShown, pulseCount]);

  // Load the language preference from cookies on component mount
  useEffect(() => {
    const languageCookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('language='));

    if (languageCookie) {
      const language = languageCookie.split('=')[1];
      setLanguage(language);
    }
  }, []);

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  // Guest limit check
  const guestLimitReached = isGuest && pulseCount >= maxPulses;

  // Create transport with custom API endpoint and body
  // This is the solo play flow - multiplayer uses a different route
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/pulse',
        body: {
          selectedStoryId,
          language,
          solo: isSoloMode, // Solo mode - skips multi-player character creation
          ...(isGuest && {
            guestPulseCount: pulseCount,
            guestSessionId: guestSession?.id,
          }),
        },
      }),
    [
      guestSession?.id,
      isGuest,
      pulseCount,
      selectedStoryId,
      language,
      isSoloMode,
    ],
  );

  // Track when audio is ready from the stream data
  const [audioReady, setAudioReady] = useState(false);

  const { messages, setMessages, sendMessage, status, stop, regenerate } =
    useChat({
      id,
      transport,
      messages: initialMessages,
      experimental_throttle: 100,
      // Handle custom data parts from the stream
      onData: (dataPart) => {
        // Check for audio-ready signal
        if (dataPart && typeof dataPart === 'object' && 'type' in dataPart) {
          if ((dataPart as { type: string }).type === 'data-audio-ready') {
            setAudioReady(true);
          }
        }
      },
      // Track assistant responses for guest pulse counting
      onFinish: ({ message }) => {
        if (isGuest && message.role === 'assistant') {
          addGuestMessage({ role: 'assistant', content: '' });
        }
      },
    });

  // Solo stories with a narrator agent are narrated live by ElevenLabs instead of /api/pulse
  // Agents narrate in English; other languages keep the text model + TTS pipeline
  const narratorAgentId =
    language !== 'es' ? getNarratorAgentId(selectedStoryId, isSoloMode) : null;
  const narratorState = useAtomValue(narratorStateAtom);
  const setNarratorState = useSetAtom(narratorStateAtom);
  const setAgentMessageIds = useSetAtom(agentMessageIdsAtom);
  const lastPlayerMoveRef = useRef<{ id: string; text: string } | null>(null);
  // The narration this browser relayed last, sent again when its voice ends for players who missed it
  const lastRelayedTextRef = useRef<{ turnId: string; messageId: string; text: string } | null>(null);

  const {
    start: startNarrator,
    send: sendToNarrator,
    stop: stopNarrator,
    isStarted: narratorStarted,
    beginRemoteTurn,
    playRemote,
    currentTurn,
    audioBlocked,
    unlockAudio,
  } = useNarratorAgent({
    agentId: narratorAgentId,
    onStateChange: (state) => {
      setNarratorState(state);
      if (state === null && lastRelayedTextRef.current) {
        roomBus?.publish({ type: 'NARRATION_TEXT', ...lastRelayedTextRef.current });
        lastRelayedTextRef.current = null;
      }
    },
    onTurnStart: (turnId) => {
      lastRelayedTextRef.current = null;
      roomBus?.publish({ type: 'NARRATION_TURN', turnId });
    },
    onAudioChunk: (chunk) => roomBus?.publish({ type: 'NARRATION_AUDIO', ...chunk }),
    onNarration: (raw, turn) => {
      // Delivery tags like [whisper] steer the voice; keep them out of the text
      const text = raw.replace(/\[[^\]]{1,24}\]\s*/g, '').trim();
      if (!text) return;

      const messageId = crypto.randomUUID();
      bindLiveNarration(messageId, turn);
      setAgentMessageIds((ids) => new Set(ids).add(messageId));
      setMessages((prev) => [
        ...prev,
        { id: messageId, role: 'assistant', parts: [{ type: 'text', text }] },
      ]);
      if (roomBus) {
        lastRelayedTextRef.current = { turnId: turn.id, messageId, text };
        roomBus.publish({ type: 'NARRATION_TEXT', ...lastRelayedTextRef.current });
      }

      const move = lastPlayerMoveRef.current;
      lastPlayerMoveRef.current = null;
      void fetch('/api/pulse/agent-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: id,
          storyId: selectedStoryId,
          userText: move?.text ?? null,
          userMessageId: move?.id,
          narration: text,
          assistantMessageId: messageId,
          solo: isSoloMode,
        }),
      });
      if (isGuest) {
        addGuestMessage({ role: 'assistant', content: '' });
      }
    },
  });

  // Narration relayed from the spokesperson's browser: queue the voice, show the text and moves
  useEffect(() => {
    if (!roomBus) return;
    const appendRelayed = (messageId: string, role: 'user' | 'assistant', text: string) =>
      setMessages((prev) =>
        prev.some((m) => m.id === messageId)
          ? prev
          : [...prev, { id: messageId, role, parts: [{ type: 'text', text }] }],
      );
    return roomBus.subscribe((event) => {
      switch (event.type) {
        case 'NARRATION_TURN':
          beginRemoteTurn(event.turnId);
          break;
        case 'NARRATION_AUDIO':
          playRemote(event);
          break;
        case 'NARRATION_TEXT':
          // Highlight follows the voice only when this player heard that turn
          if (currentTurn().id === event.turnId) bindLiveNarration(event.messageId, currentTurn());
          setAgentMessageIds((ids) => new Set(ids).add(event.messageId));
          appendRelayed(event.messageId, 'assistant', event.text);
          break;
        case 'PLAYER_MOVE':
          appendRelayed(event.messageId, 'user', event.text);
          break;
      }
    });
  }, [roomBus, beginRemoteTurn, playRemote, currentTurn, setAgentMessageIds, setMessages]);

  // Browsers hold the relayed voice until the player interacts; any click or key lets it play
  useEffect(() => {
    if (!audioBlocked) return;
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [audioBlocked, unlockAudio]);

  // A player who hands over the spokesperson role stops narrating; the new spokesperson's
  // browser opens the narrator with the story so far on their first move
  useEffect(() => {
    if (isRoomListener) stopNarrator();
  }, [isRoomListener, stopNarrator]);

  // Without a narrator agent (Spanish), a room starts from the story picker as before
  useEffect(() => {
    if (roomBeginsAtModalRef.current && !narratorAgentId) {
      roomBeginsAtModalRef.current = false;
      setPhase('overview');
    }
  }, [narratorAgentId]);

  const handleStorySelection = useCallback(
    async (storyId: string, solo: boolean) => {
      setSelectedStoryId(storyId);
      setIsSoloMode(solo);

      // Get story and immediately switch to loading phase
      const story = stories.find((s) => s.id === storyId);
      if (story) {
        setAudioReady(false);
        setPhase('loading'); // Instantly show loading screen + modal

        // Lazy-load story-specific typography (non-blocking)
        initStoryTypography(story.theme?.typography);
      }

      mutate('/api/history');
    },
    [mutate],
  );

  // Load story typography when returning to existing session or entering a room (runs once on mount)
  useEffect(() => {
    if (phase !== 'overview' && selectedStory?.theme?.typography) {
      initStoryTypography(selectedStory.theme.typography);
    }
    // Only run on mount - don't re-run when story changes (handleStorySelection handles that)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup typography only on unmount (separate effect)
  useEffect(() => {
    return () => resetStoryTypography();
  }, []);

  // Create wrapper functions to match the old API
  const handleSubmit = useCallback(
    (
      event?: { preventDefault?: () => void },
      chatRequestOptions?: ChatRequestOptions,
    ) => {
      event?.preventDefault?.();
      if (!input.trim() && !attachments.length) return;
      if (isRoomListener) return;

      if (narratorAgentId) {
        const text = input.trim();
        if (!narratorStarted()) {
          // Resumed or reloaded game: open the agent and give it the story so far
          const storySoFar = messages
            .map((m) => {
              const content = getUIMessageContent(m);
              if (/let's start the (story|group session)/i.test(content)) return null;
              return `${m.role === 'assistant' ? 'Narrator' : 'Player'}: ${content}`;
            })
            .filter(Boolean)
            .join('\n\n')
            .slice(-12000);
          startNarrator(
            undefined,
            storySoFar
              ? `The story so far (continue it; do not start over):\n\n${storySoFar}`
              : undefined,
          );
        }
        const move = { id: crypto.randomUUID(), text };
        setMessages((prev) => [
          ...prev,
          { id: move.id, role: 'user', parts: [{ type: 'text', text }] },
        ]);
        roomBus?.publish({ type: 'PLAYER_MOVE', messageId: move.id, text });
        lastPlayerMoveRef.current = move;
        sendToNarrator(text);
        setInput('');
        setAttachments([]);
        return;
      }

      // Convert attachments to files format if needed
      // For now, sending just text - file handling needs to be implemented
      sendMessage(
        {
          text: input,
        },
        {
          body: chatRequestOptions?.body,
        },
      );

      setInput('');
      setAttachments([]);
      mutate('/api/history');
    },
    [
      input,
      attachments,
      sendMessage,
      mutate,
      narratorAgentId,
      narratorStarted,
      startNarrator,
      sendToNarrator,
      setMessages,
      messages,
      isRoomListener,
      roomBus,
    ],
  );

  const append = useCallback(
    async (
      message: UIMessage | CreateUIMessage<UIMessage>,
      chatRequestOptions?: ChatRequestOptions,
    ) => {
      // In a room, only the spokesperson starts the narration
      if (isRoomListener) return null;

      const body = chatRequestOptions?.body as
        | { selectedStoryId?: string; solo?: boolean }
        | undefined;
      if (
        language !== 'es' &&
        body?.selectedStoryId &&
        getNarratorAgentId(body.selectedStoryId, body.solo ?? true)
      ) {
        // The narrator agent opens the story when the player presses Begin
        return null;
      }

      const textContent = getUIMessageContent(message as UIMessage);
      await sendMessage(
        {
          text: textContent,
        },
        {
          body: chatRequestOptions?.body,
        },
      );
      return null;
    },
    [sendMessage, isRoomListener, language],
  );

  const reload = useCallback(
    async (chatRequestOptions?: {
      experimental_attachments?: Array<Attachment>;
    }) => {
      await regenerate();
      return null;
    },
    [regenerate],
  );

  const isLoading =
    status === 'streaming' || (Boolean(narratorAgentId) && narratorState === 'thinking');

  // On mobile, switch back to messages view when narrator finishes responding
  useEffect(() => {
    if (
      isMobile &&
      !isLoading &&
      messages.some((m) => m.role === 'assistant')
    ) {
      setMobilePanelView('messages');
    }
  }, [isMobile, isLoading, messages]);

  const currentMessageId = useMemo(() => {
    // Get the most recent assistant message ID for image/audio display
    const lastAssistantMessage = messages
      .filter((m) => m.role === 'assistant')
      .pop();
    return lastAssistantMessage?.id ?? null;
  }, [messages]);

  const isGroupSetupPrompt = useMemo(() => {
    if (isSoloMode) return false;

    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    if (assistantMessages.length !== 1) return false;

    const content = getUIMessageContent(assistantMessages[0]).toLowerCase();
    return (
      content.includes('how many players') ||
      (content.includes('player') && content.includes('name'))
    );
  }, [isSoloMode, messages]);

  const storyDisplayMessageId = isGroupSetupPrompt ? null : currentMessageId;

  // Check if narrator has responded
  const hasNarratorResponse = useMemo(() => {
    return messages.some((m) => m.role === 'assistant');
  }, [messages]);

  // Story is ready when:
  // - Narrator has responded AND
  // - Audio is ready (signaled via stream data) OR audio is disabled
  const isStoryReady = useMemo(() => {
    if (narratorAgentId) return true;
    if (!hasNarratorResponse) return false;
    if (!audioEnabled) return true;
    if (audioReady) return true;
    return status === 'ready' || status === 'error';
  }, [narratorAgentId, hasNarratorResponse, audioEnabled, audioReady, status]);

  const handleBeginStory = useCallback(() => {
    setStoryBegun(true); // Enable audio autoplay
    setPhase('chat'); // Transition to chat interface
    roomBeginsAtModalRef.current = false;
    if (isRoomListener) {
      // The spokesperson's browser runs the narrator; this click lets its relayed voice play here
      unlockAudio();
      return;
    }
    if (narratorAgentId && selectedStory) {
      // Same hidden opening the text pipeline gets from the overview
      startNarrator(
        isSoloMode
          ? `Let's start the story "${selectedStory.title}".`
          : `Let's start the group session for "${selectedStory.title}". Ask for the number of players and each player's name before beginning the story.`,
      );
    }
  }, [
    setStoryBegun,
    narratorAgentId,
    selectedStory,
    startNarrator,
    isSoloMode,
    isRoomListener,
    unlockAudio,
  ]);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          user={user}
          isGuest={isGuest}
          pulseCount={pulseCount}
          maxPulses={maxPulses}
          storyTitle={phase !== 'overview' ? selectedStory?.title : undefined}
          shareSlot={
            phase === 'chat' && hasNarratorResponse ? (
              <ShareCard
                chatId={id}
                story={selectedStory}
                pulseCount={
                  messages.filter((m) => m.role === 'assistant').length
                }
                soloMode={isSoloMode}
              />
            ) : undefined
          }
        />

        {/*
        Simple 3-phase layout (no race conditions):
        - 'overview': Story selection screen
        - 'loading': Black screen (modal covers this)
        - 'chat': Full chat interface
      */}
        {phase === 'overview' && (
          <Overview
            chatId={id}
            append={append}
            onSelectStory={handleStorySelection}
            user={user}
          />
        )}
        {phase === 'loading' && <div className="flex-1 bg-black" />}
        {phase === 'chat' &&
          (isGroupSetupPrompt ? (
            <div className="flex-1 min-h-0">
              <Messages
                chatId={id}
                isLoading={isLoading}
                messages={messages}
                storyId={selectedStoryId}
                setupMode
              />
            </div>
          ) : isMobile ? (
            <div className="flex-1 flex flex-col min-h-0 relative">
              {/* Mobile panel toggle */}
              <div className="flex border-b border-border/50 bg-background/95">
                <button
                  type="button"
                  onClick={() => setMobilePanelView('messages')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                    mobilePanelView === 'messages'
                      ? 'text-foreground border-b-2 border-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Story
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePanelView('story')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                    mobilePanelView === 'story'
                      ? 'text-foreground border-b-2 border-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Visuals
                </button>
              </div>
              {mobilePanelView === 'messages' ? (
                <Messages
                  chatId={id}
                  isLoading={isLoading}
                  messages={messages}
                  storyId={selectedStoryId}
                  setupMode={isGroupSetupPrompt}
                />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 overflow-hidden">
                  <StoryDisplay currentMessageId={storyDisplayMessageId} />
                </div>
              )}
            </div>
          ) : (
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={50}>
                <Messages
                  chatId={id}
                  isLoading={isLoading}
                  messages={messages}
                  storyId={selectedStoryId}
                />
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel defaultSize={50}>
                <div className="flex flex-col items-center justify-center h-full overflow-hidden">
                  <StoryDisplay currentMessageId={storyDisplayMessageId} />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ))}

        {phase === 'chat' && !isReadonly && (
          <form
            className="flex mx-auto bg-background p-3 md:p-4 gap-2 w-full md:max-w-3xl"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
              disabled={disabled || guestLimitReached}
              disabledReason={
                guestLimitReached
                  ? 'Create an account to continue your adventure'
                  : disabledReason
              }
            />
          </form>
        )}
      </div>

      {roomBus && audioBlocked && phase === 'chat' && (
        <button
          type="button"
          onClick={unlockAudio}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur"
        >
          <Volume2 className="w-4 h-4" />
          Tap to hear the narrator
        </button>
      )}

      {/* Soft Gate Modal for guests */}
      {showSoftGate && (
        <SoftGateModal
          onClose={() => setShowSoftGate(false)}
          pulseCount={pulseCount}
        />
      )}

      {/* Story Loading Modal - appears immediately on story selection */}
      <StoryLoadingModal
        isVisible={phase === 'loading'}
        isReady={isStoryReady}
        story={selectedStory}
        onBegin={handleBeginStory}
      />
    </>
  );
}
