# The Pulse - Claude Code Project Notes

## Project Overview

**The Pulse** is an AI-powered interactive storytelling platform - immersive narrative fiction with text, AI-generated images, and audio narration.

**Core concept:** 5 curated story experiences (~20 "pulses"/story beats per session, 30-60 min gameplay) where player choices shape narrative outcomes. Features character creation, multimodal storytelling (text/image/voice), sophisticated AI narrator with detailed story guides, and multiple LLM support.

**Stories Available:**
1. **Shadow Over Innsmouth** (default) - Lovecraftian mystery (`lib/ai/stories/shadow-over-innsmouth.ts`)
2. **The Hollow Choir** - Flooded city with haunting song (`lib/ai/stories/the-hollow-choir.ts`)
3. **Whispering Pines** - Psychological horror cabin (`lib/ai/stories/whispering-pines.ts`)
4. **Siren of the Red Dust** - Mars colony sci-fi thriller (`lib/ai/stories/siren-of-the-red-dust.ts`)
5. **Endless Path** - Additional narrative (`lib/ai/stories/endless-path.ts`)

Based on [Vercel's AI Chatbot](https://github.com/vercel/ai-chatbot) template. Port 7272 (72 BPM, like a pulse).

## Next.js 16 - Important Changes

### Linting in Next.js 16

**CRITICAL**: Next.js 16 **removed** the `next lint` command entirely.

#### What Changed

- ❌ `next lint` command **NO LONGER EXISTS**
- ❌ `next build` **NO LONGER RUNS** linting automatically
- ✅ Use ESLint, Biome, or any linter **directly** via npm scripts

#### This Project's Setup

This project uses **Biome** exclusively for linting and formatting (following the Vercel AI Chatbot template):

```bash
# Lint and auto-fix
pnpm lint

# Format code
pnpm format
```

**Configuration**: See `biome.jsonc` for linting rules and settings.

**Why Biome?**
- Faster than ESLint (written in Rust)
- Unified tool for both linting and formatting
- Official Vercel template standard
- No ESLint configuration needed

#### If You Need ESLint

If you must add ESLint for specific plugins:

1. Install: `pnpm add -D eslint @eslint/js @eslint/eslintrc`
2. Create `eslint.config.mjs` (flat config format - ESLint v9+ requirement)
3. Update `package.json` scripts to include eslint
4. **DO NOT** use `.eslintrc.json` (legacy format, deprecated in ESLint v9)

**References:**
- [Next.js 16 Upgrading Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [ESLint Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)

### Middleware in Next.js 16

**CHANGED**: The `middleware.ts` file convention is deprecated.

- Old: `middleware.ts`
- New: `proxy.ts` (Next.js 16+ convention)

This project uses `proxy.ts` for authentication and route protection.

## Development

### Port Configuration

This project runs on **PORT 7272** (72 bpm, like a pulse).

```bash
PORT=7272 pnpm dev
```

### Key Technologies

#### Core Framework
- **Next.js 16** (App Router with Turbopack)
- **React 19 RC** (cutting-edge, note RC API differences)
- **TypeScript 5.6**
- **Biome** (linting & formatting, no ESLint)

#### UI & Styling
- **Tailwind CSS v4** with PostCSS
- **shadcn/ui** + Radix UI primitives
- **Framer Motion** (animations)
- **Geist** font
- **next-themes** (dark mode)

#### AI & LLM Integration
- **Vercel AI SDK 5.0.108**
- **OpenRouter** (primary model routing)
  - Claude 3.7 Sonnet (chat-model-small)
  - Claude 3.7 Sonnet Thinking (chat-model-large, default)
  - Claude 3.5 Haiku (title generation)
- **Fireworks AI**
  - DeepSeek R1 (reasoning model)
  - Flux-1-dev (image generation)
- **OpenAI** (GPT-4o-mini for artifacts)

#### Audio/Voice
- **Orate** (unified TTS interface)
- **@11labs/react** (ElevenLabs integration)
- ElevenLabs API + OpenAI TTS support

#### Data & State
- **Drizzle ORM 0.34** + Vercel Postgres
- **Jotai** (atomic state management)
- **SWR** (data fetching/caching)
- **Vercel Blob** (file storage)

#### Rich Text & Code Editing
- **ProseMirror** (rich text editor)
- **CodeMirror 6** (code editing with JS/Python support)
- **react-markdown** + remark-gfm

#### Auth & Security
- **NextAuth.js v5 beta** (credentials provider)
- **bcrypt-ts** (password hashing)
- Invite code system: "ACYBORG", "CYBERYOGIN", "RTT"

#### Other Key Dependencies
- **Pyodide** (Python in browser, loaded in chat layout)
- **nanoid** (ID generation)
- **date-fns** (date utilities)
- **Sonner** (toast notifications)
- **react-resizable-panels** (split view layout)

## Linting Standards

This project enforces **ZERO-WARNING, ZERO-ERROR** policy. All code must pass Biome checks before committing.

```bash
# Always run before committing
pnpm lint
```

Common Biome rules enforced:
- Button elements must have `type` attribute
- No unused imports
- No non-null assertions (`!`) without safety checks
- Accessibility (a11y) rules enabled

## Project Structure

```
app/
  (auth)/          # Authentication routes
  (chat)/          # Main chat interface and API routes
components/        # React components
lib/
  ai/              # AI-related utilities and prompts
  db/              # Database queries and schema
proxy.ts           # Next.js 16 middleware (auth)
biome.jsonc        # Biome configuration
```

## Test Harness (`packages/test-harness`)

Automated testing framework for narrator quality evaluation. Runs simulated sessions with AI players.

### CLI Commands

```bash
pnpm cli:run --story <id> --prompt <style> --narrator <model>  # Single session
pnpm cli:compare --story <id>                                   # Compare prompt styles
pnpm cli:compare-stories --story1 <id> --story2 <id>           # Compare stories
pnpm cli:compare-narrators --story <id> --narrators <models>   # Compare narrators
pnpm cli:batch --sessions <n> --story <id> --narrator <model>  # Batch analysis
pnpm cli:eval <sessionId>                                       # Run Gemini evaluation
pnpm cli:eval --latest                                          # Evaluate most recent
```

### Key File Locations

```
packages/test-harness/
├── cli/
│   ├── shared-options.ts    # Centralized CLI defaults (players=3, narrator=deepseek-v3.2, prompt=mechanical)
│   ├── run.ts               # Single session runner
│   ├── compare.ts           # Prompt style comparison
│   ├── compare-stories.ts   # Story version comparison
│   ├── compare-narrators.ts # Narrator model comparison
│   ├── batch.ts             # Batch analysis
│   └── eval.ts              # Gemini evaluation CLI
├── session/
│   ├── runner.ts            # Main orchestration loop, narrator generation, player responses
│   ├── discussion.ts        # Multi-player discussion orchestration
│   ├── turn.ts              # Turn types and message schema
│   ├── state.ts             # Game state tracking, character extraction
│   ├── feedback.ts          # Player feedback collection
│   ├── tangent.ts           # Tangent detection and tracking
│   ├── private.ts           # Private moment detection
│   └── cost.ts              # Token/cost tracking
├── agents/
│   ├── narrator.ts          # Narrator model config (NARRATOR_MODEL_MAP, THINK_TAG_MODELS)
│   ├── player.ts            # Player agent creation, group generation
│   └── character-generator.ts # Character generation with LLM
├── prompts/
│   ├── loader.ts            # Prompt style loader (production, mechanical, philosophical, minimal)
│   └── evaluator.ts         # 9-dimension Gemini evaluation prompt
├── report/
│   ├── markdown.ts          # Session report generation
│   └── gemini-eval.ts       # Gemini Pro evaluation (uses google/gemini-3-pro-preview)
├── checkpoint/
│   ├── schema.ts            # Checkpoint data structure
│   ├── save.ts              # Checkpoint persistence
│   └── load.ts              # Checkpoint loading for replay
├── archetypes/
│   ├── types.ts             # ArchetypeId type, model fallback chain
│   └── definitions.ts       # Player archetype definitions (director, contrarian, etc.)
├── stories/
│   └── loader.ts            # Story loading (getStory, listStoryIds, hasStory)
├── utils/
│   └── retry.ts             # Retry logic, exponential backoff, withModelFallback helper
└── sessions/                # Output directory for session data
    ├── <sessionId>/
    │   ├── turn-XXX.json    # Checkpoint per turn
    │   ├── report.md        # Session summary
    │   ├── transcript.md    # Full conversation
    │   ├── narrator-log.md  # Narrator thinking + output
    │   ├── gemini-eval.md   # Gemini evaluation (if run)
    │   └── metrics.json     # Session metrics
    └── comparisons/         # Comparison reports
```

### Prompt Styles (in `packages/core/ai/prompts/`)

- `mechanical.ts` - Structure-focused with pulse tracking, three-act structure, directed questions phase
- `philosophical.ts` - Feelings-first, curiosity/dread/connection over plot
- `minimal.ts` - Stripped to essentials, trust the model
- `system.ts` - Production prompt (what ships in the real game)

### Narrator Models

Defined in `agents/narrator.ts` as `NARRATOR_MODEL_MAP`:
- `deepseek-v3.2` (default) - DeepSeek V3.2 via Vercel AI Gateway
- `kimi-k2-thinking` - Kimi K2 with reasoning
- `opus-4.5` - Claude Opus 4.5
- `grok-4` - Grok 4

### Guest Narrator Model

**Current:** `moonshotai/kimi-k2` - Selected for speed (2.6s) + atmospheric prose quality.

Configured in `apps/web/app/(chat)/api/pulse/route.ts`

**Model comparison results:** See `docs/narrator-model-comparison.md`

**Test first pulse across models:**
```bash
pnpm test:first-pulse              # All models
pnpm test:first-pulse --model=kimi-k2  # Specific model
```

**Selection criteria for guest narrator:**
1. Speed < 5 seconds (UX)
2. Prose quality - atmospheric, evocative, no markdown formatting
3. Length 60-120 words for first pulse
4. Immersion - no "What do you do?" prompts, no headers

**Tested models (2025-01-28):**
| Model | Time | Words | Verdict |
|-------|------|-------|---------|
| **kimi-k2** | **2.6s** | **103** | ⭐ Winner |
| minimax-her | 3.0s | 61 | Good, concise |
| opus-4.5 | 5.7s | 102 | Great but slower |
| deepseek-v3.2 | 5.1s | 60 | Short, poetic |
| haiku-4.5 | 3.9s | 164 | ❌ Markdown headers |
| mistral-creative | 1.2s | 127 | ❌ Markdown formatting |

### Player Model Fallback Chain

Defined in `archetypes/types.ts`:
- Primary models: deepseek, qwen, grok
- Fallback: qwen → grok → gemini-flash

### Garbage Output Detection

In `packages/core/narrator/validation.ts`:
- Detects changelog/release notes hallucinations
- Flags any backticks (code patterns don't belong in narrative)
- Detects repetition loops (same line 4+ times)

### Debugging Failed Sessions

1. Check session report: `sessions/<id>/report.md` (outcome, turns, error)
2. Check metrics: `sessions/<id>/metrics.json`
3. Check last checkpoint: `sessions/<id>/turn-XXX.json` (highest number)
4. Check narrator log: `sessions/<id>/narrator-log.md` (thinking + output)
5. Re-run to capture error: `pnpm cli:run --story <id> --prompt <style>`

Errors during comparison runs are logged to console but not saved to disk.

## Notes for AI Assistants

When working on this codebase:

1. **Always use Biome for linting**, not ESLint
2. Run `pnpm lint` before committing
3. Respect the zero-warning policy
4. Follow existing patterns from Vercel AI Chatbot template
5. Port 7272 is project standard
6. Use `proxy.ts` not `middleware.ts`

## Remote Access

When the user asks to start/view a dev server, always provide the **full Tailscale URL** since they may be on a different machine:

- Tailscale IP: `100.92.166.126` (gorkbook-pro)
- Example: `http://100.92.166.126:7272/login`

Don't just say "localhost" - give the complete Tailscale address.
