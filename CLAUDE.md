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

## Notes for AI Assistants

When working on this codebase:

1. **Always use Biome for linting**, not ESLint
2. Run `pnpm lint` before committing
3. Respect the zero-warning policy
4. Follow existing patterns from Vercel AI Chatbot template
5. Port 7272 is project standard
6. Use `proxy.ts` not `middleware.ts`
