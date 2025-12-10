# The Pulse - Test Harness

Automated playtesting system for The Pulse that simulates group sessions with AI player agents.

## Purpose

Surface narrator weaknesses, validate prompt changes, and ensure story quality before human players encounter issues. Run hundreds of randomized playthroughs with AI agents representing different player archetypes.

## Usage

### Run a Session

```bash
pnpm test:run --story innsmouth --prompt baseline --narrator opus-4.5
```

Options:
- `--story` - Story ID (innsmouth, hollow-choir, whispering-pines, etc.)
- `--prompt` - System prompt variant (baseline, pulse-aware, etc.)
- `--narrator` - Narrator model (opus-4.5, grok-4, deepseek-r2)
- `--players` - Force specific group size (2-5, default: random)

### Replay from Checkpoint

```bash
pnpm test:replay --checkpoint sessions/abc123/turn-22.json --prompt pulse-aware
```

Load a checkpoint and continue the session with a different prompt or narrator model. Perfect for A/B testing prompt changes on the exact same scenario.

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
2. Find problem at turn N
3. Paste transcript to Claude for analysis
4. Tweak prompt or story guide
5. Replay from turn N-1 with new config
6. Compare: did it help?

The checkpoint system enables fast iteration without re-running entire sessions.

## Cost Estimates

Per session (varies by narrator model):
- **Opus 4.5**: $2-5
- **Grok 4**: $0.50-1
- **DeepSeek R2**: $0.30-0.80

Player agents add ~$0.10-0.30 per session. Start testing with cheaper narrators, validate winners with Opus.

## Development Status

See the main spec document at `/specs/the-pulse-test-harness-spec.md` for full details and implementation phases.
