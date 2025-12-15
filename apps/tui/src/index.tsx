/**
 * Pulse Control - Test Harness TUI
 *
 * Terminal UI for running and comparing test sessions.
 * Built with OpenTUI (React for terminal).
 */

import { createCliRenderer } from '@opentui/core';
import { createRoot, useKeyboard } from '@opentui/react';
import { useState, useEffect } from 'react';

// Import from test-harness
import {
  getAllStories,
  type Story,
} from '@pulse/test-harness/stories/loader';
import {
  PROMPT_STYLES,
  PROMPT_DESCRIPTIONS,
  type PromptStyle,
} from '@pulse/test-harness/prompts/loader';
import type { NarratorModel } from '@pulse/test-harness/agents/narrator';

// Import session orchestrator
import {
  TuiSessionOrchestrator,
  type SessionProgress,
  type SessionPhase,
  type SessionKey,
} from './session';

// ============================================================================
// Types
// ============================================================================

type Screen = 'config' | 'running';
type ConfigSection = 'story' | 'mode' | 'compare';
type ComparisonMode = 'prompts' | 'models';

interface TestConfig {
  storyId: string;
  comparisonMode: ComparisonMode;
  // For prompt comparison - single model, multiple prompts
  model: NarratorModel;
  promptStyles: PromptStyle[];
  // For model comparison - single prompt, multiple models
  promptStyle: PromptStyle;
  models: NarratorModel[];
}

// ============================================================================
// Data
// ============================================================================

const NARRATOR_MODELS: NarratorModel[] = ['opus-4.5', 'xai/grok-4-fast-reasoning', 'deepseek-v3.2', 'moonshotai/kimi-k2-thinking'];

const MODEL_LABELS: Record<NarratorModel, string> = {
  'opus-4.5': 'Opus 4.5',
  'xai/grok-4-fast-reasoning': 'Grok 4',
  'deepseek-v3.2': 'DeepSeek v3.2',
  'moonshotai/kimi-k2-thinking': 'Kimi K2',
};

const MODEL_DESCRIPTIONS: Record<NarratorModel, string> = {
  'opus-4.5': 'Premium quality',
  'xai/grok-4-fast-reasoning': 'xAI fast reasoning',
  'deepseek-v3.2': 'Thinking model',
  'moonshotai/kimi-k2-thinking': 'Moonshot thinking',
};

// ============================================================================
// Main App
// ============================================================================

function App() {
  const [screen, setScreen] = useState<Screen>('config');
  const [config, setConfig] = useState<TestConfig>({
    storyId: 'innsmouth-nonlinear',
    comparisonMode: 'models',
    // Prompt comparison settings
    model: 'deepseek-v3.2',
    promptStyles: ['mechanical', 'philosophical', 'minimal'],
    // Model comparison settings
    promptStyle: 'mechanical',
    models: ['xai/grok-4-fast-reasoning', 'deepseek-v3.2', 'moonshotai/kimi-k2-thinking'],
  });
  useKeyboard((key) => {
    if (key.name === 'q' && key.ctrl) {
      process.exit(0);
    }
  });

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Header />
      <box flexGrow={1} flexDirection="column">
        {screen === 'config' && (
          <ConfigScreen
            config={config}
            setConfig={setConfig}
            onStart={() => setScreen('running')}
          />
        )}
        {screen === 'running' && (
          <RunningScreen
            config={config}
            onAbort={() => setScreen('config')}
          />
        )}
      </box>
      <Footer screen={screen} />
    </box>
  );
}

// ============================================================================
// Header
// ============================================================================

function Header() {
  return (
    <box borderStyle="rounded" padding={1} flexDirection="column">
      <text fg="#666666">[?] help</text>
      <text fg="#ff6b6b">█▀█ █ █ █   █▀ █▀▀</text>
      <text fg="#ff6b6b">█▀▀ █▄█ █▄▄ ▄█ ██▄</text>
    </box>
  );
}

// ============================================================================
// Footer
// ============================================================================

function Footer({ screen }: { screen: Screen }) {
  const hints: Record<Screen, string> = {
    config: 'tab section  ↑↓ select  space/1-4 toggle  enter start  ctrl+q quit',
    running: '↑↓ session  esc back  ctrl+q quit',
  };

  return (
    <box borderStyle="rounded" padding={1}>
      <text fg="#888888">{hints[screen]}</text>
    </box>
  );
}

// ============================================================================
// Config Screen
// ============================================================================

function ConfigScreen({
  config,
  setConfig,
  onStart,
}: {
  config: TestConfig;
  setConfig: (c: TestConfig) => void;
  onStart: () => void;
}) {
  const [section, setSection] = useState<ConfigSection>('story');
  const stories = Array.from(getAllStories().values());
  const storyIds = stories.map((s) => s.id);

  // Initialize indices to match config defaults
  const [storyIndex, setStoryIndex] = useState(() => {
    const idx = storyIds.indexOf(config.storyId);
    return idx >= 0 ? idx : 0;
  });
  const [modelIndex, setModelIndex] = useState(NARRATOR_MODELS.indexOf(config.model));
  const [promptIndex, setPromptIndex] = useState(PROMPT_STYLES.indexOf(config.promptStyle));

  // Update config when story/single selections change
  useEffect(() => {
    setConfig({
      ...config,
      storyId: storyIds[storyIndex] || config.storyId,
      model: NARRATOR_MODELS[modelIndex] || config.model,
      promptStyle: PROMPT_STYLES[promptIndex] || config.promptStyle,
    });
  }, [storyIndex, modelIndex, promptIndex]);

  const canStart = config.comparisonMode === 'prompts'
    ? config.promptStyles.length > 0
    : config.models.length > 0;

  useKeyboard((key) => {
    // Section navigation
    if (key.name === 'tab') {
      const sections: ConfigSection[] = ['story', 'mode', 'compare'];
      const idx = sections.indexOf(section);
      setSection(sections[(idx + 1) % sections.length]);
      return;
    }

    // Up/Down navigation
    if (key.name === 'up' || key.name === 'down') {
      const delta = key.name === 'up' ? -1 : 1;

      if (section === 'story') {
        setStoryIndex((i) => Math.max(0, Math.min(stories.length - 1, i + delta)));
      } else if (section === 'mode') {
        // Toggle between prompts and models
        setConfig({
          ...config,
          comparisonMode: config.comparisonMode === 'prompts' ? 'models' : 'prompts',
        });
      } else if (section === 'compare') {
        // Move single selection (model for prompts mode, prompt for models mode)
        if (config.comparisonMode === 'prompts') {
          setModelIndex((i) => Math.max(0, Math.min(NARRATOR_MODELS.length - 1, i + delta)));
        } else {
          setPromptIndex((i) => Math.max(0, Math.min(PROMPT_STYLES.length - 1, i + delta)));
        }
      }
      return;
    }

    // Space to toggle mode
    if (key.name === 'space' && section === 'mode') {
      setConfig({
        ...config,
        comparisonMode: config.comparisonMode === 'prompts' ? 'models' : 'prompts',
      });
      return;
    }

    // Number keys for toggling items in compare section
    if (section === 'compare' && key.raw >= '1' && key.raw <= '4') {
      const idx = Number.parseInt(key.raw, 10) - 1;

      if (config.comparisonMode === 'prompts') {
        // Toggle prompt styles
        const style = PROMPT_STYLES[idx];
        if (style) {
          const newStyles = config.promptStyles.includes(style)
            ? config.promptStyles.filter((s) => s !== style)
            : [...config.promptStyles, style];
          if (newStyles.length > 0) {
            setConfig({ ...config, promptStyles: newStyles });
          }
        }
      } else {
        // Toggle models
        const model = NARRATOR_MODELS[idx];
        if (model) {
          const newModels = config.models.includes(model)
            ? config.models.filter((m) => m !== model)
            : [...config.models, model];
          if (newModels.length > 0) {
            setConfig({ ...config, models: newModels });
          }
        }
      }
      return;
    }

    // Enter to start
    if (key.name === 'return' && canStart) {
      onStart();
      return;
    }
  });

  return (
    <box flexDirection="row" flexGrow={1} padding={1}>
      {/* Left column - Story & Mode */}
      <box flexDirection="column" width="50%">
        <SectionBox
          title="STORY"
          active={section === 'story'}
          hint="↑↓ select"
        >
          {stories.map((story, i) => (
            <StoryItem
              key={story.id}
              story={story}
              selected={i === storyIndex}
              active={section === 'story'}
            />
          ))}
        </SectionBox>

        <box height={1} />

        <SectionBox
          title="COMPARISON MODE"
          active={section === 'mode'}
          hint="space toggle"
        >
          <ModeItem
            label="Compare Prompts"
            description="Same model, different prompt styles"
            selected={config.comparisonMode === 'prompts'}
            active={section === 'mode'}
          />
          <ModeItem
            label="Compare Models"
            description="Same prompt, different LLMs"
            selected={config.comparisonMode === 'models'}
            active={section === 'mode'}
          />
        </SectionBox>

        <box height={1} />

        <SummaryBox config={config} stories={stories} />
      </box>

      <box width={2} />

      {/* Right column - Compare settings & Start */}
      <box flexDirection="column" width="50%">
        {config.comparisonMode === 'prompts' ? (
          <>
            {/* Single model selector */}
            <SectionBox
              title="NARRATOR MODEL"
              active={section === 'compare'}
              hint="↑↓ select"
            >
              {NARRATOR_MODELS.map((model, i) => (
                <SingleSelectItem
                  key={model}
                  label={MODEL_LABELS[model]}
                  description={MODEL_DESCRIPTIONS[model]}
                  selected={i === modelIndex}
                  active={section === 'compare'}
                />
              ))}
            </SectionBox>

            <box height={1} />

            {/* Multi-prompt selector */}
            <SectionBox
              title="PROMPT STYLES TO COMPARE"
              active={section === 'compare'}
              hint="[1-4] toggle"
            >
              {PROMPT_STYLES.map((style, i) => (
                <MultiSelectItem
                  key={style}
                  index={i + 1}
                  label={style}
                  description={PROMPT_DESCRIPTIONS[style].slice(0, 30)}
                  enabled={config.promptStyles.includes(style)}
                  active={section === 'compare'}
                />
              ))}
            </SectionBox>
          </>
        ) : (
          <>
            {/* Single prompt selector */}
            <SectionBox
              title="PROMPT STYLE"
              active={section === 'compare'}
              hint="↑↓ select"
            >
              {PROMPT_STYLES.map((style, i) => (
                <SingleSelectItem
                  key={style}
                  label={style}
                  description={PROMPT_DESCRIPTIONS[style].slice(0, 30)}
                  selected={i === promptIndex}
                  active={section === 'compare'}
                />
              ))}
            </SectionBox>

            <box height={1} />

            {/* Multi-model selector */}
            <SectionBox
              title="MODELS TO COMPARE"
              active={section === 'compare'}
              hint="[1-4] toggle"
            >
              {NARRATOR_MODELS.map((model, i) => (
                <MultiSelectItem
                  key={model}
                  index={i + 1}
                  label={MODEL_LABELS[model]}
                  description={MODEL_DESCRIPTIONS[model]}
                  enabled={config.models.includes(model)}
                  active={section === 'compare'}
                />
              ))}
            </SectionBox>
          </>
        )}

        <box flexGrow={1} />

        <StartButton enabled={canStart} />
      </box>
    </box>
  );
}

// ============================================================================
// Config Components
// ============================================================================

function SectionBox({
  title,
  active,
  hint,
  children,
}: {
  title: string;
  active: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  const titleColor = active ? '#4ecdc4' : '#888888';

  return (
    <box
      flexDirection="column"
      borderStyle={active ? 'double' : 'single'}
      borderColor={active ? '#4ecdc4' : '#444444'}
      padding={1}
    >
      <text fg={titleColor}>{hint ? `${title}  [${hint}]` : title}</text>
      <box height={1} />
      {children}
    </box>
  );
}

function StoryItem({
  story,
  selected,
  active,
}: {
  story: Story;
  selected: boolean;
  active: boolean;
}) {
  const bullet = selected ? '>' : ' ';
  const fg = selected ? (active ? '#ffffff' : '#aaaaaa') : '#666666';
  const title = story.title || story.id;
  const display = selected && active ? `[${title}]` : title;

  return (
    <text fg={fg}>{bullet} {display}</text>
  );
}

function ModeItem({
  label,
  description,
  selected,
  active,
}: {
  label: string;
  description: string;
  selected: boolean;
  active: boolean;
}) {
  const bullet = selected ? '>' : ' ';
  const fg = selected ? (active ? '#f9c74f' : '#aaaaaa') : '#666666';
  const display = selected && active ? `[${label}]` : label;

  return (
    <text fg={fg}>{bullet} {display} - {description}</text>
  );
}

function SingleSelectItem({
  label,
  description,
  selected,
  active,
}: {
  label: string;
  description: string;
  selected: boolean;
  active: boolean;
}) {
  const bullet = selected ? '>' : ' ';
  const fg = selected ? (active ? '#4ecdc4' : '#aaaaaa') : '#666666';
  const display = selected && active ? `[${label}]` : label;

  return (
    <text fg={fg}>{bullet} {display} - {description}</text>
  );
}

function MultiSelectItem({
  index,
  label,
  description,
  enabled,
  active,
}: {
  index: number;
  label: string;
  description: string;
  enabled: boolean;
  active: boolean;
}) {
  const checkbox = enabled ? '[x]' : '[ ]';
  const fg = enabled ? (active ? '#95e77a' : '#aaaaaa') : '#666666';

  return (
    <text fg={fg}>{checkbox} {index}) {label} - {description}</text>
  );
}

function SummaryBox({
  config,
  stories,
}: {
  config: TestConfig;
  stories: Story[];
}) {
  const story = stories.find((s) => s.id === config.storyId);

  const isPromptMode = config.comparisonMode === 'prompts';
  const sessionCount = isPromptMode ? config.promptStyles.length : config.models.length;
  const compareItems = isPromptMode
    ? config.promptStyles.join(', ')
    : config.models.map((m) => MODEL_LABELS[m]).join(', ');

  return (
    <box flexDirection="column" borderStyle="single" borderColor="#333333" padding={1}>
      <text fg="#888888">SESSION SUMMARY</text>
      <box height={1} />
      <text fg="#ffffff">{story?.title || config.storyId}</text>
      <text fg="#f9c74f">{isPromptMode ? 'Compare Prompts' : 'Compare Models'}</text>
      <text fg="#4ecdc4">{isPromptMode ? MODEL_LABELS[config.model] : config.promptStyle}</text>
      <text fg="#666666">{`${sessionCount} sessions:`}</text>
      <text fg="#95e77a">{compareItems}</text>
    </box>
  );
}

function StartButton({ enabled }: { enabled: boolean }) {
  return (
    <box justifyContent="center" padding={1}>
      {enabled ? (
        <box borderStyle="double" borderColor="#4ecdc4" padding={1}>
          <text fg="#4ecdc4">▶ START TEST RUN (enter)</text>
        </box>
      ) : (
        <box borderStyle="single" borderColor="#444444" padding={1}>
          <text fg="#666666">select at least one prompt style</text>
        </box>
      )}
    </box>
  );
}

// ============================================================================
// Running Screen
// ============================================================================

/** Message entry in the log */
interface MessageEntry {
  sessionId: string;
  role: string;
  content: string;
  turn: number;
}

function RunningScreen({
  config,
  onAbort,
}: {
  config: TestConfig;
  onAbort: () => void;
}) {
  const [sessions, setSessions] = useState<Map<SessionKey, SessionProgress>>(new Map());
  const [messages, setMessages] = useState<Map<string, MessageEntry[]>>(new Map());
  const [selectedSession, setSelectedSession] = useState(0);
  const [orchestrator] = useState(() => new TuiSessionOrchestrator({
    storyId: config.storyId,
    comparisonMode: config.comparisonMode,
    model: config.model,
    promptStyles: config.promptStyles,
    promptStyle: config.promptStyle,
    models: config.models,
    maxTurns: 20,
  }));

  const sessionKeys = config.comparisonMode === 'prompts'
    ? config.promptStyles
    : config.models;

  const isModelMode = config.comparisonMode === 'models';

  // Get display label for a session key
  const getLabel = (key: SessionKey): string => {
    if (isModelMode) {
      return MODEL_LABELS[key as NarratorModel] || key;
    }
    return key;
  };

  // Start sessions on mount
  useEffect(() => {
    const handleProgress = (progress: SessionProgress) => {
      setSessions((prev) => new Map(prev).set(progress.sessionKey, progress));
    };

    const handleMessage = (msg: { sessionId: string; role: string; content: string; turn: number }) => {
      setMessages((prev) => {
        const sessionMsgs = prev.get(msg.sessionId) || [];
        const newMap = new Map(prev);
        newMap.set(msg.sessionId, [...sessionMsgs, msg]);
        return newMap;
      });
    };

    orchestrator.on('session:progress', handleProgress);
    orchestrator.on('session:message', handleMessage);
    // No all:complete handler - stay on this screen to view content

    orchestrator.start().catch((err) => {
      console.error('Session error:', err);
    });

    return () => {
      orchestrator.removeAllListeners();
      orchestrator.abort();
    };
  }, []);

  useKeyboard((key) => {
    if (key.name === 'escape') {
      orchestrator.abort();
      onAbort();
    }
    if (key.name === 'up') {
      setSelectedSession((i) => Math.max(0, i - 1));
    }
    if (key.name === 'down') {
      setSelectedSession((i) => Math.min(sessionKeys.length - 1, i + 1));
    }
    if (key.raw >= '1' && key.raw <= '9') {
      const idx = Number.parseInt(key.raw, 10) - 1;
      if (idx < sessionKeys.length) {
        setSelectedSession(idx);
      }
    }
  });

  const selectedKey = sessionKeys[selectedSession];
  const selectedProgress = selectedKey ? sessions.get(selectedKey) : undefined;

  // Get ALL messages for selected session - keyed by sessionKey for consistency
  const sessionMessages = selectedKey ? (messages.get(selectedKey) || []) : [];

  return (
    <box flexDirection="row" flexGrow={1} padding={1}>
      {/* Sessions sidebar */}
      <box width="30%" flexDirection="column" borderStyle="single" padding={1}>
        <text fg="#4ecdc4">{isModelMode ? 'MODELS' : 'PROMPTS'}</text>
        <box height={1} />
        {sessionKeys.map((key, i) => {
          const progress = sessions.get(key);
          const isSelected = i === selectedSession;
          const progressPct = progress ? getProgressPercent(progress) : 0;
          const bars = Math.floor(progressPct / 5);
          const bar = '='.repeat(bars) + '-'.repeat(20 - bars);
          const phaseIcon = getPhaseIcon(progress?.phase);
          const pointer = isSelected ? '>' : ' ';
          const fg = isSelected ? '#ffffff' : '#888888';
          // Use short labels to fit
          const shortLabel = getShortLabel(key, isModelMode);

          return (
            <text key={key} fg={fg}>{`${pointer}${shortLabel} [${bar}] ${phaseIcon}`}</text>
          );
        })}

        <box height={1} />

        {/* Group info for selected session */}
        {selectedProgress?.group && (
          <>
            <text fg="#666666">Group:</text>
            {selectedProgress.group.players.map((p) => {
              const isSpokesp = p.name === selectedProgress.group?.spokesperson;
              const icon = isSpokesp ? '🎙️' : '👤';
              return (
                <text key={p.name} fg={isSpokesp ? '#f9c74f' : '#888888'}> {icon} {p.name}</text>
              );
            })}
          </>
        )}

        <box flexGrow={1} />
        <text fg="#555555">↑↓ session</text>
      </box>

      <box width={1} />

      {/* Main view - message log */}
      <box flexGrow={1} flexDirection="column" borderStyle="single" padding={1}>
        <text fg="#4ecdc4">{getLabel(selectedKey || '').toUpperCase()} - {selectedProgress?.phase || 'waiting'}</text>
        <text fg="#666666">Turn {selectedProgress?.turn || 0}/{selectedProgress?.maxTurns || 20} | Pulses {selectedProgress?.pulses || 0} | Msgs {sessionMessages.length}</text>
        <box height={1} />

        {/* Message log - ALL messages, FULL content */}
        <box flexDirection="column" flexGrow={1}>
          {sessionMessages.length === 0 ? (
            <text fg="#555555">Waiting for messages...</text>
          ) : (
            sessionMessages.map((msg, i) => {
              const roleColor = msg.role === 'narrator' ? '#ff6b6b'
                : msg.role === 'spokesperson' ? '#f9c74f'
                : '#4ecdc4';
              return (
                <text key={`${msg.turn}-${i}`} fg={roleColor}>{msg.content}</text>
              );
            })
          )}
        </box>

        {/* Current speaker - FULL content */}
        {selectedProgress?.currentSpeaker && selectedProgress?.lastMessage && (
          <box borderStyle="single" borderColor="#4ecdc4" padding={1}>
            <text fg="#4ecdc4">{selectedProgress.currentSpeaker}: {selectedProgress.lastMessage}</text>
          </box>
        )}

        <text fg="#666666">[esc] abort</text>
      </box>
    </box>
  );
}

/** Get short fixed-width label for session key */
function getShortLabel(key: string, isModelMode: boolean): string {
  if (isModelMode) {
    // Short model names
    const shortNames: Record<string, string> = {
      'opus-4.5': 'Opus',
      'xai/grok-4-fast-reasoning': 'Grok',
      'deepseek-v3.2': 'DSek',
      'moonshotai/kimi-k2-thinking': 'Kimi',
    };
    return (shortNames[key] || key.slice(0, 4)).padEnd(4);
  }
  // Short prompt names
  return key.slice(0, 4).padEnd(4);
}

function getProgressPercent(progress: SessionProgress): number {
  if (progress.phase === 'completed') return 100;
  if (progress.phase === 'failed') return 0;
  if (progress.phase === 'initializing') return 5;
  if (progress.phase === 'generating-group') return 8;
  if (progress.phase === 'group-ready') return 10;
  if (progress.phase === 'pre-game') return 12;
  if (progress.phase === 'pre-game-message') return 14;
  // During running, progress is based on turn
  const turnProgress = (progress.turn / progress.maxTurns) * 85;
  return Math.min(95, 15 + turnProgress);
}

function getPhaseIcon(phase?: SessionPhase): string {
  switch (phase) {
    case 'completed': return '✓';
    case 'failed': return '✗';
    case 'narrator-turn': return '📖';
    case 'player-turn': return '👤';
    case 'spokesperson-turn': return '🎙️';
    case 'generating-group': return '⏳';
    case 'group-ready': return '👥';
    case 'pre-game': return '💬';
    case 'pre-game-message': return '💬';
    case 'running': return '▶';
    default: return '○';
  }
}

// ============================================================================
// Initialize
// ============================================================================

async function main() {
  const renderer = await createCliRenderer();
  const root = createRoot(renderer);
  root.render(<App />);
}

main().catch(console.error);
