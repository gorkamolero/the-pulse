# The Pulse - Test Harness

Automated playtesting system for The Pulse that simulates group sessions with AI player agents.

## Purpose

Surface narrator weaknesses, validate prompt changes, and ensure story quality before human players encounter issues. Run hundreds of randomized playthroughs with AI agents representing different player archetypes.

## Usage

### Run a Session

```bash
pnpm test:run --story shadow-over-innsmouth --narrator deepseek-v3.2
```

Options:
- `--story` - Story ID (shadow-over-innsmouth, the-hollow-choir, whispering-pines, siren-of-the-red-dust, endless-path)
- `--narrator` - Narrator model (opus-4.5, grok-4, deepseek-v3.2)
- `--players` - Force specific group size (2-5, default: random)
- `--max-turns` - Maximum turns (default: 100)

### Replay from Checkpoint

```bash
pnpm test:replay --checkpoint test-harness-checkpoints/abc123/turn-22.json
```

Replays from a saved checkpoint using the **current production prompt**. This is how you test prompt changes:

1. Find issue in a session transcript
2. Edit `lib/ai/prompts/system.ts` directly
3. Run replay with the checkpoint
4. If better, commit the prompt change

The replay always uses whatever is currently in the production prompt file - no variants needed.

## Architecture

```
src/
├── archetypes/    # 10 player archetype definitions with model assignments
├── agents/        # Player agent factory, spokesperson, narrator wrapper
├── session/       # Main orchestration, turn execution, classification
├── checkpoint/    # Save/load session state for replay
├── report/        # Issue detection, timeline generation, markdown reports
└── cli/           # Command-line interface
```

## Player Archetypes

Each archetype represents a realistic play style with specific behavioral patterns:

1. **Joker** (Grok) - Makes jokes, lightens mood (~30% humor)
2. **Engaged** (Qwen) - Takes story seriously, ideal baseline
3. **Questioner** (DeepSeek) - Asks clarifying questions, notices details
4. **Wildcard** (Grok) - Tries unexpected actions (~20% off-script)
5. **Follower** (Kimi K2) - Brief responses, defers to others
6. **Curious** (DeepSeek) - Interested in world details and lore
7. **Optimizer** (DeepSeek) - Strategic thinking, weighs options
8. **Invested** (Qwen) - Cares about characters and outcomes
9. **Drifter** (Kimi K2) - Attention wanders, needs catch-up
10. **Experienced** (Qwen) - Knows genre, has expectations

Groups are randomly composed (2-5 players, with replacement) each session.

## Output

Each session generates:
- **Checkpoints** - JSON snapshots at each turn (`sessions/[id]/turn-N.json`)
- **Report** - Markdown document with timeline and analysis (`sessions/[id]/report.md`)

Reports include:
- Session config and cost
- Group composition
- Timeline of pulses, tangents, private moments
- Detected issues (contradictions, loops, forced segues)
- Full transcript

## Iteration Workflow

1. Run session → Read report
2. Find problem at turn N (e.g., forced segue, contradiction)
3. Edit production prompt directly (`lib/ai/prompts/system.ts`)
4. Replay from turn N-1 checkpoint
5. Compare: did it help?
6. If yes, commit prompt change

The checkpoint system enables fast iteration without re-running entire sessions. You're always testing the production prompt.

## Cost Estimates

Per session (varies by narrator model):
- **Opus 4.5**: $2-5
- **Grok 4**: $0.50-1
- **DeepSeek v3.2**: $0.30-0.80

Player agents add ~$0.10-0.30 per session. Start testing with cheaper narrators, validate winners with Opus.

## Development Status

See the main spec document at `/specs/the-pulse-test-harness-spec.md` for full details and implementation phases.

## Langfuse experiments

Supply `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and your existing AI Gateway
model credentials through the process environment. `LANGFUSE_BASE_URL` defaults
to `https://cloud.langfuse.com`. The experiment CLI loads no environment files.
Without both Langfuse keys it silently returns without model or API calls;
existing CLIs keep running normally without telemetry.

From the repository root, run a small comparison:

```bash
pnpm cli:langfuse-experiment --story shadow-over-innsmouth --variants mechanical,minimal --items 1 --max-turns 6 --narrator deepseek-v4-flash --players 2
```

This runs two sessions against the same stored friend group. Each game has one
`play-session` trace with `play-turn` spans and `simulate-player` agents.
AI SDK `experimental_telemetry` captures model calls, usage, latency, and supported
reasoning automatically. Generation names include `generate-narration`,
`generate-player-response`, `classify-narration`, and `generate-judgment`.
The judge's `judge-session` evaluator contains its model generation.
Trace input shows story, archetypes, variant, and maxTurns. Output shows outcome,
final turn, and a short transcript excerpt. Full session payloads are metadata.
The game session ID and tags `pulse`, `narrator-eval`, and the variant allow filtering.

Dataset `pulse-player-groups` uses stable IDs based on story, player count, and
item index. Groups are generated once, cached under `sessions/langfuse-player-groups`,
and stored in the dataset. Later invocations reuse the hosted group. Every prompt
variant receives the same archetypes, identities, relationships, and group history.
In-story characters and player responses evolve during each session.

Experiment `pulse-narrator` creates runs named `pulse-<variant>-<ISO date>`.
Item scores include the 12 snake_case criteria, `weighted_overall`,
`judge_reported_overall`, four BOOLEAN smell checks, `cost_per_turn_usd`,
`latency_per_turn_ms`, and `cost_usd`. A true smell check indicates a problem.
Run scores are `mean_weighted_overall` and `mean_cost_usd`.

`weighted_overall` is computed in code with agency weighted 2.0,
declaration/invitation/branching weighted 1.5, and the eight remaining criteria
weighted 1.0. The denominator is their sum, **14.5**. Any of the four smell checks
caps the result at 8.5. The evaluator prompt uses the same **14.5** denominator.
`judge_reported_overall` retains its returned number so discrepancies are visible.
Generation pricing comes from Langfuse's model pricing table. Session cost scores
use the existing tracker and cover its recorded session calls. Judge and group
setup costs appear on their own generations.

`cli:run`, `cli:compare`, `cli:batch`, and `cli:eval` also emit telemetry when keys
are present. `sessions/<id>/langfuse.json` retains the trace parent and performance
metrics so a later evaluation attaches to the original trace. Older sessions
without this sidecar get a trace when evaluated; unavailable historical timings
and costs are not invented. All four CLIs flush and shut down telemetry on exit.

To rejudge existing transcripts without generating new play, pass
`--rejudge-sessions <comma-separated IDs>` to `cli:langfuse-experiment`, ordered
by variant then dataset item. Use the original story, players, items and max-turns.
This creates separate `pulse-<variant>-judge-full-replies-<ISO date>` runs;
baseline scores and files remain unchanged. Corrected reports are saved under
`sessions/<id>/judge-full-replies/`. The judge now receives all individual replies,
with separate PLAYER and SPOKESPERSON labels. See `ITERATION.md` for the measured comparison.

Offline checks (no provider calls):

```bash
pnpm --filter @pulse/test-harness test:langfuse
pnpm --filter @pulse/test-harness typecheck
```

The integration uses Langfuse SDK 6.1.1 (Node.js 22 or newer) with compatible
OpenTelemetry dependencies. Dataset operations use the bound `client.api` resource
methods; experiment links are exported as OpenTelemetry attributes.

## Local Codex experiments

Requires an authenticated `codex` CLI and Node.js 22+. No API key is needed.
`codex-local` implements the AI SDK 6 language-model v3 protocol in
`ai/codex-local.ts`. The production core/web model defaults are unchanged.

From the repository root, run both six-turn variants entirely through Codex:

```bash
PULSE_PLAYER_MODEL=codex-local PULSE_CLASSIFIER_MODEL=codex-local PULSE_JUDGE_MODEL=codex-local pnpm cli:langfuse-experiment --offline --story shadow-over-innsmouth --variants mechanical,minimal --items 1 --max-turns 6 --narrator codex-local --players 2
```

`--offline` explicitly bypasses Langfuse and requires all roles to use Codex;
without it, the existing missing-Langfuse-keys no-op is unchanged. Both variants
share one generated friend group. It saves normal reports and judge output under
`packages/test-harness/sessions/<sessionId>/`, plus `codex-run.json` with wall
time, subprocess attempts/failures/retries, and scores. `PULSE_CODEX_LOG` optionally
names a JSONL audit file (timings and usage only, never prompts or credentials).

Model selection:
- `--narrator codex-local`: narrator.
- `PULSE_PLAYER_MODEL`: group generation, players, spokesperson, character/state
  extraction, and final player feedback.
- `PULSE_CLASSIFIER_MODEL`: narration classification, private-moment checks, and
  semantic contradiction detection in reports (triggered after five turns).
- `PULSE_JUDGE_MODEL`: evaluation (default remains Gemini).
- `PULSE_CODEX_MODEL`: underlying CLI model (default `gpt-6.1-sol`).

Differences from gateway runs:
- Codex uses the authenticated subscription, not metered AI Gateway APIs. Local
  cost tracker values are zero, meaning **not priced**, not a measured free API
  cost; local Markdown/HTML reports omit dollar figures. Group generation, state
  extraction, feedback, report issue detection and judge calls remain outside
  the legacy session token totals.
- Usage comes from Codex `turn.completed`: input, cached input, and output tokens.
  It can include CLI framing/reasoning overhead; missing counts stay unknown in
  the provider (legacy report totals treat absent usage as zero).
- Streaming is buffered: one complete answer is emitted after the CLI finishes.
  Reasoning text is not exposed. Temperature and sampling/token-limit settings
  are not forwarded, so results are not sampling-equivalent to gateway runs.
- System and conversation messages are serialized into one prompt. Each call
  starts an ephemeral session in an isolated temporary directory; no conversation
  state, project rules, configured MCP servers, or user configuration is reused.
- Shell, browsing, image, apps, multi-agent and plan tools are disabled; attempted
  tool events fail the call. Text-only input and JSON-schema output are supported.
  Optional JSON properties are requested as present values to satisfy Codex's
  strict schema requirement; array roots are wrapped and unwrapped transparently.
- At most three subprocesses run concurrently per Node process. Each attempt has
  a three-minute timeout and one retry; failures do not trigger paid fallbacks.
- The judge uses the same model family as the narrator when both select Codex,
  reducing evaluator independence. Two turns only exercise an opening, not a
  full story. Offline runs have no hosted Langfuse traces/datasets/pricing.

Offline provider regression checks:

```bash
pnpm --filter @pulse/test-harness exec tsx --test tests/codex-local.test.ts
```

### Measured local run

On 2026-11-12, the six-turn command above with `--variants mechanical` and
`--max-turns 2` completed with exit 0:

- Session `ykNq5k0lWGe71DHaEaLGB`, two players, `gpt-6.1-sol` for every role.
- End-to-end wall time: **190.15 seconds** including pnpm startup; internal
  experiment clock: **189.017 seconds**. Session-only time shown in the report
  excludes group generation and judging.
- **15 Codex subprocess calls**, zero failed attempts, zero retries. Group setup:
  1; pre-game players: 2; two gameplay turns including classification,
  player/spokesperson responses and state extraction: 11; judge: 1.
- Outcome `timeout` is the expected max-turns stop, not a subprocess timeout.
- Code-computed weighted score **5.62069/10**; judge-reported score **5.32/10**.
- Report: `packages/test-harness/sessions/ykNq5k0lWGe71DHaEaLGB/report.md`.
  The same directory contains `transcript.md`, `gemini-eval.json`,
  `gemini-eval.md`, `codex-run.json`, and `codex-calls.jsonl`.

The first attempt ran two turns but failed character extraction and judging:
Codex rejected optional properties absent from JSON Schema `required`. A direct
CLI diagnostic confirmed `invalid_json_schema`; the strict-schema conversion
above fixed it. That attempt took 163.02 seconds and 21 subprocess calls; its
session is `0fMJCZ9kP-jqB4Lhi5CU-`. No paid providers were called: semantic issue
detection only runs after five narrator messages, and judging used Codex.

Estimate, not a six-turn measurement: **6–9 minutes per six-turn session**, or
roughly **12–18 minutes for both variants**. The observed split was about 45
seconds group/pre-game setup, 91 seconds for two turns, and 53 seconds judging.
Extending the turn work to six gives about 6.1 minutes before longer context,
extra discussions, and the two semantic report checks add variability.

The initial short run's judge omitted individual player replies. The corrected
judge now includes them; the six-session controlled rejudgment and the limits of
that measurement fix are documented in `ITERATION.md`.

Checks: harness TypeScript passes; provider plus Langfuse regression tests pass
(14 tests, mocked network); targeted Biome lint passes. No changes were pushed.
