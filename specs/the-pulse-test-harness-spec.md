# The Pulse - Test Harness Spec

## Purpose

An automated playtesting system that simulates group sessions with AI player agents. The harness runs hundreds of randomized playthroughs to surface narrator weaknesses, validate prompt changes, and ensure story quality before human players encounter issues.

---

## Core Concept

The test harness simulates how The Pulse is actually played:

- A group of 2-5 players
- One spokesperson relays group decisions to the narrator
- The narrator delivers story in pulses (~20 beats)
- Players go on tangents, joke around, get distracted
- The narrator must gracefully return to the story
- Occasionally the narrator addresses individual players privately

The harness replaces human players with AI agents that have distinct personalities, backstories, and behavioral patterns. By randomizing group composition and running many sessions, we discover which narrator behaviors are robust and which break under pressure.

---

## Player Agent Pool

### Philosophy

Rather than fixed "test personas," we maintain a pool of rich character archetypes. Each has a personality, a backstory that explains that personality, and behavioral tendencies that emerge from both.

The backstory isn't just flavor—it informs how the agent responds to narrative beats. A trauma survivor reacts differently to horror than a thrill-seeker. A skeptic who was once fooled asks different questions than one who's naturally analytical.

### The Pool (10 Archetypes)

These are play style tendencies, not character studies. Each archetype is 70-80% normal engagement with 20-30% personality coloring. The quirk is seasoning, not the whole dish.

**1. The Joker**
- Style: Makes jokes, lightens the mood
- Context: Works in sales, plays pub trivia on Thursdays
- Patterns: ~30% of responses include humor. Puns, references, gentle teasing. Engages seriously when genuinely interested. Doesn't derail constantly—just adds levity.
- Tests: Tangent recovery, tone flexibility

**2. The Engaged**
- Style: Takes the story seriously, plays along fully
- Context: Enjoys escape rooms, reads fantasy novels on the train
- Patterns: Describes actions clearly. Asks "what do I see?" type questions. Stays in the fiction. Good baseline for what normal play looks like.
- Tests: Baseline narrative quality, happy path

**3. The Questioner**
- Style: Asks clarifying questions, notices details
- Context: Works in QA, likes puzzles
- Patterns: ~25% of responses ask for clarification or note something specific. "Wait, is the door still locked?" Not adversarial, just attentive.
- Tests: Consistency, world logic, detail retention

**4. The Wildcard**
- Style: Occasionally tries something unexpected
- Context: Likes video games, curious about systems
- Patterns: 80% normal play, ~20% tries something off-script. "Can I climb to the roof instead?" Not trying to break things—just exploring possibility space.
- Tests: Flexibility, edge case handling

**5. The Follower**
- Style: Goes along with the group, brief responses
- Context: Came because friends invited them, enjoys the social aspect
- Patterns: Short responses. "Sure, I'll go with them." Defers to others. Engages more when directly addressed or when something personally interests them.
- Tests: Handling quiet players, spotlight distribution

**6. The Curious**
- Style: Interested in world details and lore
- Context: Watches video essays, likes knowing how things work
- Patterns: ~30% of responses ask about the world. "What year is this set in?" "Tell me more about that symbol." Genuine interest, not stalling.
- Tests: World depth, valid exploration vs. tangent

**7. The Optimizer**
- Style: Wants to make good decisions, asks about options
- Context: Plays strategy games, likes planning
- Patterns: Asks "what are our options?" Thinks through consequences. ~20% of responses involve weighing choices. Not aggressive, just deliberate.
- Tests: Agency clarity, decision framing

**8. The Invested**
- Style: Cares about characters and outcomes
- Context: Gets attached to NPCs in video games, remembers names
- Patterns: Asks about NPC motivations. Remembers character names. ~25% of responses reference relationships or express concern about outcomes.
- Tests: Emotional beats, NPC handling, consequence weight

**9. The Drifter**
- Style: Attention wanders, sometimes needs catch-up
- Context: Busy week, playing while tired
- Patterns: ~20% of responses are slightly off—missed a detail, asks for recap, responds to earlier context. Not disruptive, just not fully locked in.
- Tests: Clarity, recap handling, re-engagement

**10. The Experienced**
- Style: Knows the genre, has expectations
- Context: Has played TTRPGs, read Lovecraft, seen the tropes
- Patterns: Recognizes conventions. ~20% of responses show awareness—"classic red herring" or anticipating genre beats. Not obnoxious about it.
- Tests: Trope handling, subverting expectations, satisfying experienced players

---

## Model Strategy

### Player Agents (Cost-Optimized)

Player agents are created dynamically when characters are generated. Each agent gets a system prompt built from their archetype + generated character + story context. AI SDK v5 handles dynamic prompt composition.

**Model assignment by archetype:**

| Archetype | Model | Rationale |
|-----------|-------|-----------|
| Joker | Grok | Natural humor, irreverent tone |
| Engaged | Qwen | Solid baseline, cost-effective |
| Questioner | DeepSeek | Analytical, detail-oriented |
| Wildcard | Grok | Unpredictable, creative |
| Follower | Kimi K2 | Simple responses, cheapest |
| Curious | DeepSeek | Thoughtful world exploration |
| Optimizer | DeepSeek | Strategic thinking |
| Invested | Qwen | Emotional engagement |
| Drifter | Kimi K2 | Simple, occasionally off |
| Experienced | Qwen | Genre awareness |

**Cost tiers:**
- Tier 1 (cheapest): Kimi K2 - Follower, Drifter
- Tier 2 (moderate): Qwen - Engaged, Invested, Experienced
- Tier 3 (capable): DeepSeek - Questioner, Curious, Optimizer
- Tier 4 (personality): Grok - Joker, Wildcard

### Narrator Models (Under Test)

The harness tests narrator performance across:

- **Claude Opus 4.5** - Best narrative quality, highest cost
- **Grok 4** - Fast, good at tone, unpredictable
- **DeepSeek R2** - Strong reasoning, cost-effective

Each matrix run can test one or all narrator models.

### Spokesperson

Uses same model as their archetype assignment. The spokesperson's model affects relay style—Grok spokesperson adds flavor, DeepSeek spokesperson is more precise.

### Cost Estimation

Per session (rough estimates):
- Player agents (4 players avg): ~$0.10-0.30
- Spokesperson: ~$0.05-0.10
- Narrator (varies by model):
  - Opus 4.5: ~$2-5 per session
  - Grok 4: ~$0.50-1 per session
  - DeepSeek R2: ~$0.30-0.80 per session
- Observer/scoring: ~$0.10-0.20

**Total per session**: $0.50-6.00 depending on narrator model

**Matrix estimates:**
- Mini (20 sessions): $10-120
- Standard (100 sessions): $50-600
- Full (500 sessions): $250-3000

The wide range depends heavily on narrator model choice. Test with cheaper narrators first, validate with Opus.

---

## Group Composition

### Dynamic Agent Creation

Player agents are created dynamically when a session starts:

1. **Draw archetypes**: Random selection from pool (2-5 players, with replacement)
2. **Assign models**: Each archetype has a designated model
3. **Generate names**: Random names appropriate to story setting
4. **Generate backstories**: Based on archetype context + story setting
5. **Build system prompts**: Combine archetype patterns + character + story context
6. **Select spokesperson**: Random from group

The system prompt for each agent is built at runtime using AI SDK v5's dynamic composition. This means every session has unique players even when using the same archetypes.

**Example agent creation:**

```
Archetype: Joker
Story: Shadow Over Innsmouth

→ Name: Danny
→ Model: Grok
→ Backstory: "Works at a comedy club in Boston, came to check out 
   the weird town his uncle mentioned."
→ System prompt: Joker patterns + Danny's backstory + Innsmouth 
   context + "respond as player in interactive fiction"
```

### Randomization Strategy

Rather than fixed "test groups," each session draws randomly from the pool:

1. **Group size**: Random 2-5 players
2. **Composition**: Random draw from pool, with replacement (repeats allowed)
3. **Spokesperson selection**: Random from group
4. **Backstory generation**: Each agent gets a unique backstory instance based on their archetype template

### Why Repeats?

Real groups sometimes have two jokers, or three passive players, or no one willing to lead. These configurations stress-test the narrator differently than balanced groups. Two Wildcards in one session will surface problems that one never would.

### Spokesperson Dynamics

The spokesperson is randomly selected and inherits traits from their archetype:

- A Joker spokesperson might relay decisions with unnecessary commentary
- A Follower spokesperson might undersell the group's enthusiasm
- A Questioner spokesperson might over-explain the group's reasoning
- An Optimizer spokesperson might advocate for their preferred choice

This adds realistic noise to the relay.

---

## Checkpoint System

The key feature that enables fast iteration. Every turn is a potential checkpoint.

### How It Works

At each turn, the harness saves:

- Full conversation history
- Current pulse count (detected)
- Player agent states (names, backstories, system prompts)
- Group configuration
- Story + narrator config
- Any detected tangents/private moments so far

This is serializable state. You can stop a session, come back later, or branch from any point.

### Replay Workflow

1. Run session, generate full transcript
2. Paste to Claude, identify problem: "Turn 23, the tangent recovery feels forced"
3. Load checkpoint from turn 22
4. Tweak the system prompt (or story guide, or model)
5. Replay from turn 22 with new config
6. Compare: did the tweak help?

### Branching

From one checkpoint, you can generate multiple branches:

```
Turn 22 checkpoint
    ├── Branch A: baseline prompt → forced segue
    ├── Branch B: tweaked prompt → natural segue  
    └── Branch C: different model → ???
```

This lets you A/B test changes on the exact same scenario.

### Storage

Checkpoints are JSON files. A 50-turn session might be ~100KB of checkpoint data. Keep recent sessions, archive old ones.

---

## Session Flow

### Character Creation Phase

1. Narrator asks how many players and their names
2. For each player agent, generate a unique character based on:
   - Their archetype's backstory template
   - The story being played (Lovecraft needs different characters than sci-fi)
   - Random variation to prevent repetition
3. Narrator asks personality questions
4. Player agents answer according to their archetype
5. Story begins

### Main Loop

```
REPEAT until story ends or max turns reached:
  
  1. Narrator delivers output
  
  2. System classifies output:
     - Story pulse (advances narrative)
     - Tangent response (handling distraction)
     - Private moment (addressing individual)
     - Clarification (answering question)
  
  3. If private moment:
     - Route to target player agent
     - Get individual response
     - Log for payoff tracking
  
  4. Each player agent generates reaction based on:
     - Their archetype's behavioral patterns
     - Their generated character
     - Current narrative state
     - Random mood variation
  
  5. Spokesperson synthesizes group response:
     - Influenced by their own archetype
     - May misinterpret, editorialize, or filter
  
  6. Response sent to narrator
  
  7. Metrics observer records:
     - Pulse detection
     - Tangent detection
     - Quality signals
     - Failures
```

### Story Completion

The session ends when:
- Narrator delivers clear conclusion (detected via patterns/classification)
- Maximum turns reached (safety limit)
- Hard failure occurs (loop, contradiction, breakdown)

---

## Tangent Dynamics

### What Creates Tangents

Player agents generate tangents naturally based on their archetype:

- **Joker**: Humor that invites response
- **Wildcard**: Unexpected actions that need addressing
- **Drifter**: Questions about earlier events
- **Curious**: Deep dives into world details
- **Optimizer**: Extended discussion about options

### Tangent Intensity

Not all tangents are equal. The harness should vary:

- **Light tangent**: One off-topic message, easy to redirect
- **Medium tangent**: 2-3 exchanges, requires narrative hook to return
- **Heavy tangent**: Full group derailment, extended non-story conversation
- **Spiral**: Tangent leads to tangent leads to tangent

The archetype mix influences tangent likelihood and intensity. A group with Joker + Wildcard + Drifter will generate more tangents than Engaged + Invested + Experienced.

### What We're Measuring

1. Does the narrator recognize a tangent vs. valid story exploration?
2. How many turns until story resumes?
3. Is the return natural or forced?
4. Does the tangent get woven into the narrative or just discarded?
5. Does narrator patience degrade over multiple tangents?

---

## Private Moments

### When They Should Occur

Private moments are narrator-initiated asides to individual players:

- Personal revelation matching their backstory
- Visions or dreams
- NPC singling them out
- Secrets that would spoil group experience

### Detection

The harness detects private moments via:
- Direct addressing patterns ("Morgan, you alone notice...")
- Explicit private tags in narrator output
- Context suggesting individual rather than group address

### Validation

For each private moment:
- Was the target appropriate? (backstory alignment)
- Was the timing appropriate? (narrative beat)
- Did the information pay off later? (tracking)
- Did it avoid spoiling group experience?

### Player Agent Response

When receiving a private moment, the agent responds according to:
- Their archetype (Questioner asks probing questions, Joker makes it weird)
- The nature of the revelation
- Their relationship to the group (do they share? withhold?)

---

## Metrics

### Pulse Tracking

A "pulse" is a story beat that advances the narrative. Not every narrator output is a pulse.

**Is a pulse:**
- New scene or location
- Plot revelation
- Character confrontation
- Challenge presented
- Major decision point

**Is not a pulse:**
- Answering player questions
- Handling tangents
- Clarifications
- Acknowledgments
- Recaps

**Metrics:**
- Pulses detected (target: ~20)
- Pulse completion rate
- Turns per pulse (efficiency)
- Pulse distribution (pacing)

### Tangent Handling

**Metrics:**
- Tangent count
- Average tangent length (turns to return)
- Maximum tangent length
- Recovery rate (successful returns)
- Segue quality (1-5, naturalness of return)
- Forced segue count ("anyway, back to...")

### Narrative Quality

LLM-as-judge evaluation of completed transcript:

- **Coherence**: Does the story make sense? Any contradictions?
- **Atmosphere**: Consistent tone matching story guide?
- **Player agency**: Did choices meaningfully affect outcomes?
- **Pacing**: Appropriate build-up, not rushed or dragging?
- **Story guide adherence**: Used specified locations, NPCs, devices?
- **Character integration**: Referenced player backstories naturally?

### Failures

Hard problems that should be flagged:

- **Story breakdown**: Narrative became incoherent
- **Loop**: Narrator repeated same content
- **Contradiction**: Conflicting facts stated
- **Character break**: NPC acted wildly inconsistent
- **Guide deviation**: Created elements not in story guide
- **Player confusion**: Agents couldn't parse what happened

### Composite Score

Weighted combination of all metrics producing 0-100 score. Weights tunable based on what matters most.

---

## Matrix Testing

### Dimensions

**Stories**: All available (currently 5)

**System prompts**: Variants being tested
- Baseline (current production)
- Pulse-aware (explicit tracking)
- Tangent-focused (recovery patterns)
- Structured (output markers)

**Narrator models**:
- Claude Opus 4.5
- Grok 4
- DeepSeek R2

**Group composition**: Random per session (2-5 players from pool)

### Run Configurations

**Smoke test**: 5 sessions
- Quick validation that harness works
- Single narrator model
- ~15 minutes, ~$3-15

**Mini matrix**: 20 sessions  
- Per-prompt comparison, single narrator
- ~1 hour, ~$10-100

**Standard matrix**: 100 sessions
- Statistical significance, single narrator
- ~5 hours, ~$50-500

**Full matrix**: 300 sessions
- All narrators (100 each), comprehensive coverage
- ~15 hours, ~$150-1500

**Cost note**: Opus 4.5 is 5-10x more expensive than Grok/DeepSeek. Start testing with cheaper narrators, validate winning prompts with Opus.

### Randomization Per Run

Each session in a matrix run gets:
- Random group size (2-5)
- Random archetype draw (with replacement)
- Random spokesperson from group
- Random backstory instances
- Random "mood" variations on archetype behavior

This means even with same story + prompt + model, each session plays differently.

---

## Output

### Session Report (Markdown)

The primary output. A formatted document you can read or paste for analysis.

```markdown
# Session Report

## Config
- Story: Shadow Over Innsmouth
- Narrator: Claude Opus 4.5
- System prompt: pulse-aware-v2
- Duration: 43 minutes
- Cost: $3.42

## Group
| Player | Archetype | Model |
|--------|-----------|-------|
| Danny (spokesperson) | Joker | Grok |
| Sam | Questioner | DeepSeek |
| Alex | Follower | Kimi K2 |

## Summary
- Turns: 47
- Pulses detected: 17/20
- Tangents: 3 (avg 2.1 turns to recover)
- Private moments: 2

## Timeline

### Turn 1-3: Character Creation
Players introduced themselves. Danny (Joker) made a joke about 
the town name. Sam (Questioner) asked about the time period.

### Turn 4: Pulse 1 - Arrival
> "The bus rattles to a stop at the edge of Innsmouth. Through 
> grimy windows, you see..."

Players decided to explore the main street first.

### Turn 8-10: Tangent
Danny started riffing on fish puns. Narrator recovered with 
fog rolling in.

**Segue**: "As Danny's laugh echoes strangely off the empty 
storefronts, the fog thickens and you notice movement..."

→ Natural recovery, good.

### Turn 15: Private Moment → Sam
> "[To Sam only] As you examine the symbol, a flash—you've 
> seen this before, in your grandmother's jewelry box..."

Sam kept it secret from the group.

### Turn 31: ⚠️ Issue Detected
Narrator said the church door was locked, but it was opened 
in Turn 18.

[... continues ...]

## Full Transcript

[Complete turn-by-turn transcript here]
```

### Checkpoint Files

JSON snapshots at each turn. Used for replay, not for reading.

### Cost Tracking

Running total of API costs per session, broken down by:
- Narrator tokens
- Player agent tokens  
- Spokesperson tokens

---

---

## Evaluation Workflow

The core iteration loop. Keep it simple.

### The Loop

1. **Run session**
   ```bash
   pnpm test:run --story innsmouth --prompt baseline
   ```

2. **Read the report**
   Open `sessions/[timestamp]/report.md`
   Scan the timeline, note any issues

3. **Analyze with Claude**
   Paste the transcript (or relevant sections)
   "This tangent recovery at turn 15 feels forced, how can we improve?"
   "The story got stuck around pulse 12, what happened?"

4. **Tweak and replay**
   Modify system prompt or story guide
   Load checkpoint from before the problem
   ```bash
   pnpm test:replay --checkpoint sessions/[timestamp]/turn-14.json --prompt tweaked-v1
   ```

5. **Compare**
   Did the tweak help? Read both transcripts.
   If yes, run a fresh session with the new prompt.
   If no, try something else.

### What We're Evaluating

**System prompt:**
- Does the narrator track pulse progress?
- Is tangent recovery natural or forced?
- Are private moments well-timed and targeted?
- Does momentum sustain across the session?

**Story guides:**
- Enough direction without railroading?
- Pulses well-defined?
- NPCs and locations usable?
- Achievable in ~20 pulses?

**Narrative quality:**
- Is it fun?
- Does it get stuck?
- Do choices feel meaningful?
- Would you want to play this?

The ultimate question: **Would you want to play this?**

---

## Open Questions

1. **Archetype calibration**: Run a few sessions per archetype, review with Claude—do they feel realistic? Adjust system prompts accordingly.

2. **Backstory variation**: Start with moderate variation. If sessions feel repetitive, increase. If archetypes feel inconsistent, decrease.

3. **Pulse detection**: Start with LLM classification (ask a cheap model "is this a story beat?"). If unreliable, add narrator structured output later.

4. **Checkpoint granularity**: Save every turn? Every 5 turns? Start with every turn, optimize if storage becomes an issue.

5. **Session length cap**: Max turns before timeout? 100 seems reasonable—if it hasn't concluded by then, something's wrong.

---

## Implementation Tasks

Tasks for the implementing agent. Work through in order. Each task should be completable and testable before moving to the next.

### Phase 1: Foundation

**1.1 Project Setup**
- Create new package in The Pulse monorepo (or standalone if preferred)
- Set up TypeScript, AI SDK v5
- Configure environment for multiple model providers (Anthropic, OpenAI, Grok, DeepSeek, Kimi)
- Create folder structure: `src/archetypes`, `src/agents`, `src/session`, `src/checkpoint`, `src/report`

**1.2 Define Archetypes**
- Create `archetypes.ts` with all 10 archetype definitions
- Each archetype includes: id, name, style, context, patterns, quirkFrequency, model assignment
- Export as typed constant

**1.3 Player Agent Factory**
- Create function that takes an archetype + story context and generates a PlayerAgent
- Dynamic name generation (appropriate to story setting)
- Dynamic backstory generation (based on archetype context + story)
- Dynamic system prompt composition (archetype patterns + character + story)
- Returns fully configured agent ready to respond

**1.4 Spokesperson Agent**
- Create spokesperson agent that synthesizes multiple player responses
- Takes array of player responses + spokesperson's own archetype
- Outputs single coherent relay to narrator
- Adds realistic noise based on spokesperson personality

### Phase 2: Session Engine

**2.1 Session Runner**
- Main orchestration loop
- Initialize narrator with config (model, system prompt, story guide)
- Generate random group (2-5 players from archetype pool)
- Select random spokesperson from group
- Run character creation phase
- Main loop: narrator → classify output → route (group or private) → collect responses → synthesize → repeat
- Detect session end (completion, timeout, failure)

**2.2 Output Classification**
- Function to classify narrator output: pulse | tangent-response | private-moment | clarification | recap
- Use cheap model (GPT-4o-mini or similar) for classification
- Return classification + confidence

**2.3 Private Moment Detection & Routing**
- Detect when narrator addresses individual player
- Route to correct player agent (bypass spokesperson)
- Collect individual response
- Return to main flow

**2.4 Turn Execution**
- Single turn logic extracted as reusable function
- Narrator generates → classify → route → agents respond → spokesperson synthesizes → return
- Each turn returns all data needed for checkpoint

### Phase 3: Checkpoint System

**3.1 Checkpoint Schema**
- Define Checkpoint interface (conversation history, agent states, session config, detected events)
- Serializable to JSON

**3.2 Save Checkpoints**
- After each turn, save checkpoint to file
- File naming: `sessions/[session-id]/turn-[n].json`
- Include all state needed to resume

**3.3 Load & Replay**
- Function to load checkpoint from file
- Function to resume session from checkpoint with (optionally) modified config
- Allow changing: system prompt, story guide, narrator model
- Keep: conversation history, player agents, group composition

**3.4 CLI for Replay**
- Command: `pnpm test:replay --checkpoint [path] --prompt [new-prompt-name]`
- Loads checkpoint, applies new config, continues session
- Outputs new session with branched ID

### Phase 4: Reporting

**4.1 Issue Detection**
- Detect contradictions (narrator stated X, now states not-X)
- Detect loops (same content repeated)
- Detect forced segues ("anyway, back to...")
- Detect stuck moments (no pulse progress for N turns)
- Return list of Issue objects with turn, type, description, severity

**4.2 Timeline Generation**
- Process full transcript into timeline entries
- Group by: character creation, pulses, tangents, recoveries, private moments, issues
- Each entry has turn, type, title, content, notes

**4.3 Session Report Generator**
- Take completed session data
- Generate formatted markdown report
- Sections: Config, Group, Summary, Timeline, Issues, Full Transcript
- Write to `sessions/[session-id]/report.md`

**4.4 CLI for Running Sessions**
- Command: `pnpm test:run --story [story-id] --prompt [prompt-name] --narrator [model]`
- Runs full session
- Outputs checkpoints + report
- Prints summary to console

### Phase 5: Integration & Polish

**5.1 Cost Tracking**
- Track tokens used per agent per turn
- Calculate cost based on model pricing
- Include in session report

**5.2 Multiple Narrator Models**
- Ensure Opus 4.5, Grok 4, DeepSeek R2 all work as narrators
- Handle different API patterns/auth

**5.3 Multiple Player Models**
- Ensure Grok, Qwen, DeepSeek, Kimi K2 all work as player agents
- Map archetypes to models correctly

**5.4 Error Handling**
- Handle API failures gracefully
- Retry logic for transient errors
- Save checkpoint before crash if possible
- Clear error messages in report

**5.5 End-to-End Test**
- Run 5 sessions with different configs
- Verify: sessions complete, reports generate, checkpoints save, replay works
- Review reports manually for sanity

---

## File Structure

```
pulse-test-harness/
├── src/
│   ├── archetypes/
│   │   └── index.ts           # 10 archetype definitions
│   ├── agents/
│   │   ├── player.ts          # Player agent factory
│   │   ├── spokesperson.ts    # Spokesperson agent
│   │   └── narrator.ts        # Narrator wrapper
│   ├── session/
│   │   ├── runner.ts          # Main session orchestration
│   │   ├── turn.ts            # Single turn execution
│   │   ├── classifier.ts      # Output classification
│   │   └── private.ts         # Private moment handling
│   ├── checkpoint/
│   │   ├── schema.ts          # Checkpoint types
│   │   ├── save.ts            # Save checkpoint to file
│   │   └── load.ts            # Load and replay
│   ├── report/
│   │   ├── issues.ts          # Issue detection
│   │   ├── timeline.ts        # Timeline generation
│   │   └── markdown.ts        # Report generation
│   ├── cli/
│   │   ├── run.ts             # pnpm test:run
│   │   └── replay.ts          # pnpm test:replay
│   └── index.ts               # Exports
├── sessions/                   # Output directory
│   └── [session-id]/
│       ├── turn-0.json
│       ├── turn-1.json
│       ├── ...
│       └── report.md
├── prompts/
│   ├── baseline.ts            # Current narrator prompt
│   └── pulse-aware.ts         # Improved variants
├── stories/
│   └── [imported from The Pulse or referenced]
├── package.json
└── tsconfig.json
```

---

## CLI Reference

```bash
# Run a new session
pnpm test:run --story innsmouth --prompt baseline --narrator opus-4.5

# Run with specific group size
pnpm test:run --story innsmouth --prompt baseline --narrator grok-4 --players 3

# Replay from checkpoint with different prompt
pnpm test:replay --checkpoint sessions/abc123/turn-22.json --prompt pulse-aware

# Replay with different narrator model
pnpm test:replay --checkpoint sessions/abc123/turn-22.json --narrator deepseek-r2

# Dry run (show config, don't execute)
pnpm test:run --story innsmouth --prompt baseline --dry-run
```

---

## Definition of Done

The harness is complete when:

1. ✅ Can run a full session with random group, outputs clean report
2. ✅ Checkpoints save every turn, can replay from any turn
3. ✅ Replay allows changing prompt/model while keeping history
4. ✅ Reports are readable, timeline clear, issues flagged
5. ✅ Works with all specified narrator models (Opus, Grok, DeepSeek)
6. ✅ Works with all specified player models (Grok, Qwen, DeepSeek, Kimi)
7. ✅ Cost tracking accurate
8. ✅ 5 test sessions run successfully end-to-end

Then: paste transcripts to Claude for analysis, iterate on prompts, use checkpoint replay to test fixes quickly.

---

## Types

```typescript
// Player archetypes
type ArchetypeId = 
  | 'joker'
  | 'engaged'
  | 'questioner'
  | 'wildcard'
  | 'follower'
  | 'curious'
  | 'optimizer'
  | 'invested'
  | 'drifter'
  | 'experienced';

// Model assignments
type PlayerModel = 'grok' | 'qwen' | 'deepseek' | 'kimi-k2';
type NarratorModel = 'opus-4.5' | 'grok-4' | 'deepseek-r2';

interface Archetype {
  id: ArchetypeId;
  name: string;
  style: string;
  context: string;
  patterns: string[];
  quirkFrequency: number;
  testsFor: string[];
  model: PlayerModel; // assigned model for this archetype
}

// Generated player instance
interface PlayerAgent {
  archetype: ArchetypeId;
  name: string;
  model: PlayerModel;
  generatedBackstory: string;
  characterForStory: string;
  systemPrompt: string; // dynamically generated
}

// Group configuration (generated per session)
interface GroupConfig {
  players: PlayerAgent[];
  spokesperson: PlayerAgent;
  size: number;
}

// Session configuration
interface SessionConfig {
  story: string;
  storyGuide: string;
  systemPrompt: string;
  narratorModel: NarratorModel;
  group: GroupConfig;
  maxTurns: number;
  seed?: number;
}

// Detected narrative elements
type OutputType = 
  | 'pulse'
  | 'tangent-response'
  | 'private-moment'
  | 'clarification'
  | 'recap';

interface NarratorOutput {
  content: string;
  type: OutputType;
  pulseNumber?: number;
  privateTarget?: string;
  turn: number;
  timestamp: number;
}

interface Tangent {
  startTurn: number;
  endTurn: number;
  length: number;
  initiator: string;
  type: string;
  recoveryMethod: string;
  segueQuality: number;
}

interface PrivateMoment {
  turn: number;
  target: string;
  content: string;
  response: string;
  backstoryAlignment: number;
  narrativeAppropriateness: number;
  payoffDetected: boolean;
  payoffTurn?: number;
}

// Metrics
interface PulseMetrics {
  detected: number;
  expected: number;
  completionRate: number;
  turnsPerPulse: number;
  distribution: number[];
}

interface TangentMetrics {
  count: number;
  avgLength: number;
  maxLength: number;
  recoveryRate: number;
  avgSegueQuality: number;
  forcedSegueCount: number;
}

interface QualityMetrics {
  coherence: number;
  atmosphere: number;
  playerAgency: number;
  pacing: number;
  storyGuideAdherence: number;
  characterIntegration: number;
  funFactor: number; // would you want to play this?
}

interface FailureMetrics {
  breakdowns: number;
  loops: number;
  contradictions: number;
  characterBreaks: number;
  guideDeviations: number;
  confusionEvents: number;
  stuckMoments: number; // narrative lost momentum
}

interface SessionMetrics {
  pulses: PulseMetrics;
  tangents: TangentMetrics;
  quality: QualityMetrics;
  failures: FailureMetrics;
  overall: number;
}

// Results
type SessionOutcome = 'completed' | 'timeout' | 'failed';

interface SessionResult {
  config: SessionConfig;
  transcript: NarratorOutput[];
  tangents: Tangent[];
  privateMoments: PrivateMoment[];
  metrics: SessionMetrics;
  outcome: SessionOutcome;
  duration: number;
  tokenUsage: number;
  cost: number;
}

interface MatrixConfig {
  stories: string[];
  systemPrompts: Record<string, string>;
  narratorModels: NarratorModel[];
  sessionsPerCombination: number;
  maxTurnsPerSession: number;
}

interface MatrixResult {
  config: MatrixConfig;
  sessions: SessionResult[];
  aggregates: {
    byStory: Record<string, SessionMetrics>;
    byPrompt: Record<string, SessionMetrics>;
    byModel: Record<string, SessionMetrics>;
  };
  rankings: {
    best: SessionConfig[];
    worst: SessionConfig[];
  };
  failures: SessionResult[];
  totalCost: number;
  totalDuration: number;
}

// Checkpoint System

interface Checkpoint {
  turn: number;
  timestamp: number;
  conversationHistory: Message[];
  playerAgents: PlayerAgent[];
  spokespersonId: string;
  sessionConfig: SessionConfig;
  detectedPulses: number[];
  detectedTangents: Tangent[];
  privateMoments: PrivateMoment[];
}

interface Message {
  role: 'narrator' | 'spokesperson' | 'player';
  player?: string;
  content: string;
  turn: number;
  timestamp: number;
  classification?: OutputType;
}

// Session Report (Markdown generation)

interface SessionReport {
  config: {
    story: string;
    narrator: NarratorModel;
    prompt: string;
    duration: number;
    cost: number;
  };
  group: PlayerAgent[];
  summary: {
    turns: number;
    pulsesDetected: number;
    pulsesExpected: number;
    tangentCount: number;
    avgTangentLength: number;
    privateMoments: number;
  };
  timeline: TimelineEntry[];
  issues: Issue[];
  transcript: Message[];
}

interface TimelineEntry {
  turn: number;
  type: 'pulse' | 'tangent' | 'recovery' | 'private-moment' | 'issue' | 'character-creation';
  title: string;
  content: string;
  notes?: string;
}

interface Issue {
  turn: number;
  type: 'contradiction' | 'loop' | 'forced-segue' | 'stuck' | 'confusion';
  description: string;
  severity: 'warning' | 'error';
}
```

---

## Success Criteria

### MVP

The harness is ready for use when:

1. **Runs reliably**: Complete sessions without crashes
2. **Generates realistic play**: Transcripts feel like real groups
3. **Clean session reports**: Formatted markdown with timeline, group info, issues flagged
4. **Checkpoint system**: Saves state at each turn, can replay from any point
5. **Tracks metadata**: Group composition, turns, duration, cost

This gives you a fast iteration loop: run session → find problem at turn 23 → tweak prompt → replay from turn 22 → see if it's fixed.

### Later (Scale & Polish)

Once the core loop is working:

6. **Matrix runs**: Batch multiple sessions, aggregate results
7. **Automated scoring**: LLM-as-judge metrics calibrated against your judgment
8. **Visual UI**: React Flow session viewer, dashboard (nice to have, not blocking)

### The Real Test

Run a session, paste the transcript, analyze together, iterate on prompt, replay from checkpoint—does it get better?

---

## Not In Scope (Now)

This spec covers the test harness MVP. Explicitly excluded for now:

- AI behavior / prompt improvements (Phase 2)
- Story admin / creation tools (Phase 3)
- UI polish (Phase 4)
- Content creation and launch (Phase 5)

These will be specced separately once the test harness is operational.

---

## Future Capabilities

Features to build once the MVP is working and you're running many sessions:

### Visual UI (React Flow)

When markdown reports aren't enough:

- Session viewer with flow visualization
- Matrix comparison dashboard  
- Failure browser with filtering
- Click-through from overview to details

Nice to have, not blocking iteration.

### Automated Scoring

Once manual evaluation with Claude has calibrated what "good" looks like:

- LLM-as-judge scoring on transcripts
- Automatic pass/fail thresholds
- Regression detection across prompt versions
- Statistical comparison of variants

### A/B Prompt Testing

When you need statistical confidence:

- Same checkpoint replayed with different prompts
- Significance testing on outcomes
- Automatic winner detection
