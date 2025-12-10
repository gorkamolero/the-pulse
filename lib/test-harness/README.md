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
