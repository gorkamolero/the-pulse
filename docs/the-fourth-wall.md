# The Fourth Wall of Interactive Fiction: Preserving Player Agency in AI Narration

**The core principle is deceptively simple: narrators describe what happens TO characters; players decide what characters DO.** When an AI writes "You burst into the lobby," it has crossed the sacred boundary between world-building and character control—a violation that tabletop RPG communities call "godmoding" and that breaks the fundamental contract of interactive fiction. This research synthesizes decades of GM wisdom, AI system implementations, and linguistic analysis to provide a complete framework for constraining AI narrators to respect player autonomy.

The problem runs deep because large language models are trained on completed narratives where authors control all characters. An AI's natural tendency is story completion—to continue the momentum toward resolution. Fixing this requires explicit constraints, structural prompts, and a clear understanding of the grammar of agency.

---

## The fundamental division: what belongs to whom

Traditional tabletop RPGs established the definitive framework. The Angry GM articulates it precisely: "There is something sacred and sovereign about control of a character. Part of the promise of an RPG is that your character is your sovereign domain. Only you can choose their actions." The GM controls **everything else**—environment, NPCs, consequences, the weather, the whims of gods—but never the player character's decisions.

This creates a conversation loop that AI narrators must replicate:

1. **Narrator describes** the situation with sensory detail
2. **Narrator presents** what the character perceives and knows
3. **Narrator stops** at a decision point
4. **Player declares** their character's action
5. **Narrator resolves** consequences of that action
6. Repeat

The critical insight from Fate Core's design: "It's important that the players retain their sense of autonomy over what their PCs say and do, so you don't want to dictate that to them." When this loop breaks—when the narrator writes steps 4 and 5 without waiting—agency vanishes.

---

## The grammar of agency: what narrators can and cannot say

Linguistic analysis reveals clear categories. The fundamental test: **does this require the character to have made a choice?** If yes, it's a violation.

**Narrators CAN describe (involuntary/perceptual):**

| Category | Examples |
|----------|----------|
| Physiological responses | "Your heart pounds," "A chill runs down your spine," "Your hands tremble" |
| Sensory input | "You hear footsteps," "You see a shadow move," "The air tastes metallic" |
| Environmental state | "The room is dark and cold," "The door creaks open, revealing..." |
| Information delivery | "You notice scratches near the handle," "A strange smell fills the air" |

**Narrators CANNOT describe (volitional/decisional):**

| Category | Examples (violations) |
|----------|----------------------|
| Deliberate movement | "You run to the door," "You step into the corridor" |
| Physical actions | "You draw your sword," "You grab the key" |
| Speech acts | "You say...," "You tell them...," "You demand answers" |
| Mental decisions | "You decide to investigate," "You choose to ignore the warning" |
| Cognitive conclusions | "You realize...," "You figure out that..." |

**The gray zone—reflexive actions—depends on automaticity.** "You flinch" from a sudden explosion is acceptable; it's involuntary. "You reach for your weapon" is borderline—acceptable as trained reflex, problematic as deliberate choice. The faster and more automatic the response, the more permissible it is to narrate.

Roleplay communities formalized this as the "tentative mode" rule. Forum RPG conventions demand: use "attempts," "swings toward," "aims at" rather than "hits," "strikes," "connects." The result of any action affecting another agent must be left open. Applied to AI narrators: **describe the world's offer, not the character's response.**

---

## Why AI systems fail and how they're fixing it

Every major AI storytelling platform struggles with this problem. AI Dungeon's GitHub issues document the failure clearly: "The AI seems to take away control from the player too often. You'll give it a command, and it does things for your character." Character.AI users report bots that "don't just respond anymore—they take over," rewriting scenes and making decisions unbidden.

**Root causes identified across platforms:**

- **Story completion bias**: LLMs are trained on complete narratives and naturally continue toward resolution
- **Context window drift**: Instructions at the start of prompts lose influence as conversation lengthens
- **Training data contamination**: Examples rarely include "pause for input" moments
- **Output length pressure**: Longer outputs mean more AI-generated content, including actions

**What platforms have learned:**

AI Dungeon provides modal input (Do/Say/Story/See) to separate action types and offers extensive undo/retry tools—essentially admitting the AI will violate agency and requiring users to correct it. NovelAI frames itself as a "writing assistant" rather than a game, positioning the user as primary author who actively steers and edits. KoboldAI's adventure mode explicitly "gives full control over all characters" by not adapting sentences behind the scenes.

SillyTavern's documentation provides the most sophisticated guidance: "Defining the role of the user not only helps the AI understand how to respond to your messages, but also to what extent it is allowed to control your persona." Their key insight: **positive framing works better than prohibition.** "Write responses that respect user autonomy" outperforms "Don't control the user."

---

## Interactive fiction conventions worth adopting

Parser-based interactive fiction (Zork, Inform games) established the cleanest model. The famous opening—"You are standing in an open field west of a white house"—describes **state**, not **action**. The game then waits. Actions occur only after player commands. Results are consequences of player choices, never prescriptions for new choices.

Choice-based IF (Twine, ChoiceScript) preserves agency through explicit option presentation. Choice of Games' design rules emphasize that if one option is significantly better than others, "the player selecting that option loses a sense of agency—the feeling of making a decision." Options must be balanced and meaningful.

The linguistic convention matters: **second-person present tense** ("You are standing...") creates immediacy while respecting that the player IS the character. This differs crucially from second-person active ("You walk to..."—a violation) or second-person completed ("You walked to..."—narrating a decision the player didn't make).

---

## Prompt engineering that actually works

Community experimentation has converged on several effective patterns:

**1. Explicit role and boundary definition:**
```
You are the narrator. You control NPCs, environment, and consequences.
The player controls [CHARACTER] exclusively.
Never write dialogue or actions for [CHARACTER].
Never advance time without player permission.
```

**2. Collaborative framing over service framing:**
Rather than "You are a narrator serving the player," use "We are collaborating on a story. You write the world and NPCs; I write my character." Ian Bicking's research found this framing significantly reduces agency violations because it positions both parties as authors with clear domains.

**3. Input syntax conventions:**
```
Player speech: "in quotes"
Player actions: {in braces}
OOC commands: <in angle brackets>
```
This helps the AI parse intent and distinguishes declared actions from discussion.

**4. Turn-ending structure:**
The single most important constraint. Prompts should specify:
```
End each response by describing the situation awaiting player decision.
STOP before any resolution. Never complete a scene without player input.
```

Some prompts enforce this by requiring numbered options at the end. Others simply instruct the narrator to describe what the player character perceives and then wait.

**5. Handling NPC urgency without forcing player action:**

The original problem—"The NPC says 'You must go NOW,' and the narrator writes 'You burst into the lobby'"—results from the AI conflating narrative urgency with narrative authority.

Correct pattern: NPCs can plead, warn, threaten, or demand—through their dialogue and behavior—but **the clock doesn't advance without player input.** Example:
> The guard shouts "They're escaping! Someone stop them!" His eyes land on you expectantly. The sounds of running footsteps grow distant down the eastern corridor.

The urgency is communicated. The expectation is clear. But the narrator stops at the decision point.

**6. Instruction repetition and positioning:**
Critical rules should appear at the beginning AND near the end of system prompts. Author's Note fields (inserted close to AI output in context) have the strongest influence on immediate behavior. For long sessions, periodic summarization that re-injects core rules prevents drift.

---

## A complete framework for agency-preserving narrator prompts

### The Narrator's Authority (what AI controls)

- Physical environment and its changes
- Weather, lighting, ambient sounds
- NPC actions, dialogue, emotions, and motivations
- Creature and monster behavior
- Consequences of player-declared actions
- Time passage **only after player indicates readiness**
- Information the character would perceive
- Game mechanics and rule adjudication

### The Player's Authority (what AI must never touch)

- Character's deliberate physical actions
- Character's speech and dialogue
- Character's thoughts and internal monologue
- Character's emotional reactions and interpretations
- Character's decisions and choices
- Character's movement and positioning
- Anything requiring the character to have made a choice

### The Permitted Vocabulary

**Allowed verbs** (perceptual/involuntary): notice, see, hear, feel, sense, perceive; is, stands, sits (state); seems, appears; could, might (possibilities)

**Forbidden verbs** (volitional): decide, choose, determine; do, perform, execute; say, tell, announce; go, move, travel, proceed; take, grab, reach for (volitionally)

**Allowed endings**: "What do you do?"; description of awaiting situation; NPC looking expectantly; environmental tension unresolved

**Forbidden endings**: Resolution of undeclared action; time skip; scene completion; character having moved or acted

### System Prompt Template

```
[ROLE]
You are the narrator of an interactive story. You describe the world,
control all NPCs, and narrate consequences of player actions.

[BOUNDARY]  
The player controls [CHARACTER NAME]. You NEVER write what [CHARACTER]
does, says, thinks, or decides. You may only describe [CHARACTER]'s
involuntary physical responses (heartbeat, chills, flinching from loud
noises) and what they perceive.

[HARD RULES]
- NEVER write [CHARACTER]'s dialogue, actions, or decisions
- NEVER advance time without player consent
- NEVER resolve situations before player input
- ALWAYS end with the situation awaiting player response

[TURN STRUCTURE]
1. Acknowledge/resolve player's declared action
2. Describe consequences and resulting situation
3. Present what [CHARACTER] perceives
4. STOP at decision point—await next input

[URGENCY HANDLING]
NPCs may express urgency through dialogue and behavior. Describe time
pressure but do not advance the clock without player input.

[FORMAT]
Player actions: {in braces}
Player speech: "in quotes"  
Describe in second person: "You see..." "You hear..."
End responses with the situation open, never resolved.
```

### Failure Mode Checklist

Before each output, an AI narrator should verify:
- Did I write any action the player didn't declare? **Remove it.**
- Did I write any dialogue for the player character? **Remove it.**
- Did I advance time or change scenes without permission? **Revert.**
- Did I resolve a situation without player input? **Reopen it.**
- Does my response end at a decision point? **If not, cut earlier.**

---

## The deeper principle

The Angry GM captures it perfectly: "The GM already controls everything but the player characters—taking even that measure of control away begins to beg the question why the players are even involved."

For AI narrators, the answer is the same. The entire value of interactive fiction is that the player matters—that their choices shape the story. When the narrator writes "You burst into the lobby," it has answered the question "what do you do?" on the player's behalf. The interaction becomes a novel with occasional input prompts, not a game.

The fix is not complicated, but it is strict: **describe the world in all its urgency and detail, then stop.** Let the silence after "The guard shouts 'GO NOW!' and stares at you" do the work. The player will fill it. That's the point.