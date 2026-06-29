# The Pulse

AI-powered interactive fiction for solo and multiplayer story sessions. Pick a curated world, create a character, and let an AI narrator run the game in real time with text, images, voice, atmosphere, and group decision-making.

The Pulse started from the Vercel AI Chatbot template, then grew into a story-game platform: narrator prompts, story guides, model routing, multiplayer rooms, voice narration, image generation, ambient audio, and an automated playtest harness that simulates groups of AI players.

## What It Proves

- Product taste for AI-native entertainment: story selection, no-prep play, narrator voice, atmosphere, invite rooms, and a tight "pulse" concept.
- Deep prompt/system design: narrator constraints, story guides, model comparisons, agency-preserving narration, and fourth-wall research.
- Multiplayer AI UX: rooms, invite codes, spokesperson flow, player chat, player lists, and host/lobby states.
- Multimodal execution: AI narration, image generation, TTS, ambient audio, audio controls, generated thumbnails, and story-specific themes.
- Evaluation discipline: a full test harness that simulates player groups, runs sessions, saves checkpoints, generates reports, and compares narrator models/prompts.

## Product Model

```text
story guide
  -> player or group starts a session
  -> AI narrator delivers a pulse
  -> players discuss and choose
  -> spokesperson sends group action
  -> narrator resolves the world
  -> text, voice, images, ambience, and state update
```

Test harness model:

```text
story + narrator model + prompt style
  -> generated player group
  -> simulated discussion
  -> narrator response
  -> checkpoint
  -> issue detection
  -> markdown/html report
  -> prompt or model iteration
```

## Stories

Current story worlds:

- **Shadow Over Innsmouth** - Lovecraftian mystery in a decaying seaport.
- **The Hollow Choir** - spectral mystery in a flooded city.
- **Whispering Pines** - psychological horror in a remote cabin.
- **Siren of the Red Dust** - sci-fi thriller on a silent Mars colony.
- **The Endless Path** - cosmic horror with fractured time.

Stories live in `packages/core/ai/stories/` and include story guide, description, narrator defaults, ambient audio, and visual theme data.

## Main Features

- Story selector with persistent selection.
- Solo play and multiplayer room flow.
- Invite modal, lobby, player list, player chat, and spokesperson indicator.
- AI narrator API routes for pulse generation and streaming.
- Guest/soft-gate flow for low-friction play.
- Voice narration and audio controls.
- Ambient audio and story atmosphere.
- AI image generation and story image display.
- Model routing through OpenRouter, Vercel AI Gateway, Replicate, ElevenLabs, and other providers.
- Test harness for simulated sessions and narrator evaluation.
- TUI experiment for terminal-based harness interaction.

## Monorepo Structure

```text
apps/web                 Next.js 16 web app, auth, game UI, rooms, APIs
apps/tui                 OpenTUI experiment for terminal interaction
packages/core            shared stories, narrator logic, prompts, model config
packages/test-harness    simulated playtesting, reports, checkpoints, CLI tools
docs                     narrator/model research and interaction design notes
specs                    product and harness specs
```

Key web routes and APIs:

```text
apps/web/app/(chat)/api/pulse/route.ts
apps/web/app/(chat)/api/pulse-stream/route.ts
apps/web/app/api/room/route.ts
apps/web/app/api/room/[roomId]/route.ts
apps/web/app/api/room/join/[inviteCode]/route.ts
apps/web/app/api/tts/route.ts
apps/web/app/api/liveblocks-auth/route.ts
```

## Test Harness

The harness is one of the strongest parts of the project. It lets the game be tested as a system, not only as a UI.

It supports:

- AI player archetypes with different play styles.
- Random 2-5 player group composition.
- Spokesperson selection.
- Narrator model comparison.
- Prompt-style comparison.
- Story comparison.
- Checkpoint/replay.
- Cost tracking.
- Tangent/private-moment/issue detection.
- Markdown, transcript, HTML, and Gemini evaluation reports.

Example commands:

```bash
pnpm --filter @pulse/test-harness cli:run --story shadow-over-innsmouth --narrator deepseek-v4-flash
pnpm --filter @pulse/test-harness cli:compare --story shadow-over-innsmouth
pnpm --filter @pulse/test-harness cli:compare-narrators --story shadow-over-innsmouth
pnpm --filter @pulse/test-harness cli:eval --latest
```

See [`packages/test-harness/README.md`](packages/test-harness/README.md) and [`specs/the-pulse-test-harness-spec.md`](specs/the-pulse-test-harness-spec.md).

## Narrator Research

Useful docs:

- [`docs/narrator-model-comparison.md`](docs/narrator-model-comparison.md) - first-pulse model comparison and current guest narrator choice.
- [`docs/the-fourth-wall.md`](docs/the-fourth-wall.md) - agency-preserving narration framework.
- [`specs/the-pulse-test-harness-spec.md`](specs/the-pulse-test-harness-spec.md) - automated playtesting spec.

The project treats the narrator as a product surface: speed, prose quality, agency boundaries, tone, and session stability all matter.

## Development

Requirements:

- Node.js 20+
- pnpm 9+

Install:

```bash
pnpm install
```

Run the web app:

```bash
PORT=7272 pnpm dev:web
```

Run the TUI experiment:

```bash
pnpm tui
```

Verify:

```bash
pnpm typecheck
```

The root `pnpm lint` script currently runs Biome with write flags, so use it intentionally when you want formatting/lint fixes applied.

## Environment

The web app and harness use provider credentials depending on the feature being exercised:

```env
OPENROUTER_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
REPLICATE_API_TOKEN=
ELEVENLABS_API_KEY=
POSTGRES_URL=
AUTH_SECRET=
LIVEBLOCKS_SECRET_KEY=
```

Use `.env.example` as the starting point and keep local `.env*` files out of public commits.

## Status

Active prototype.

Working or substantially implemented:

- Next.js web app and game UI.
- Five story definitions.
- Pulse/narrator APIs.
- Multiplayer room surfaces.
- Voice/audio components.
- Image/story components.
- Narrator model comparison scripts.
- Automated test harness with checkpointing and reports.

Needs public packaging work:

- Replace remaining chatbot-template docs in `docs/01-quick-start.md` and `docs/02-update-models.md`.
- Capture clean screenshots from `apps/web/screenshots/` or a fresh run.
- Add a short demo clip showing story selection, lobby, and gameplay.
- Decide which deployed URL should be public.
- Scrub local `.env.local`, `.next`, generated test sessions, and audio artifacts before broader promotion.

## Portfolio Context

The Pulse is the strongest AI game/product proof in this portfolio. It shows creative product direction, serious narrator-system design, multiplayer UX, and an engineering loop for measuring whether the AI experience is actually good.

The key signal is not "chatbot with a story prompt." The key signal is the surrounding system: story guides, model selection, agency rules, multimodal output, multiplayer coordination, and an automated harness that turns subjective narrative quality into inspectable reports.
