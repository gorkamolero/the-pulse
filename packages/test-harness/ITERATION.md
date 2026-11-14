# Narrator iteration: measure, then change one thing

Steps 1–3 use local Codex for every model role, never paid model APIs. Step 4 explicitly authorizes six gateway sessions, within a hard cap of 40 paid sessions total. Nothing is pushed. Langfuse is telemetry and evaluation storage. Story: shadow-over-innsmouth; six turns; two players; three stored dataset groups per variant. Times below are measured wall time, not estimates.

## Step 1 — complete judge evidence and correct arithmetic

Observation/hypothesis: individual player replies were excluded by `formatTranscriptForEval`. That omission is confirmed in all six baseline sessions; the stronger hypothesis that it explains the universally low character scores is refuted. Five sessions actually skip character creation. The remaining mechanical session starts setup late and fails to acknowledge answers. This is a measurement repair, not evidence of improved narration.

Exact example: session `oF8xVV_Ysz2oT5KMHYHlE`, turn 3, the judge received the narrator's “Before we follow that lead, I need the character details we skipped: Johann and Velma, who are your characters, what brought each of them to investigate this invitation, and what tools or items did they bring?” It then saw the turn-4 narrator repeat “Take your time—Johann and Velma, a sentence each about your character’s background and what they carry will do.” It did NOT receive Johann's intervening reply: “I’ll play Arthur Bell, a newspaper photographer whose brother disappeared while tracing shipping routes through Innsmouth; the invitation arrived tucked inside his brother’s last letter. He’s brought a camera, spare film, a flashlight, and that letter—so yes, keep the camera in my inventory. Velma, I’ll handle the pictures and the increasingly unconvincing claims that everything’s fine.” Nor Velma's: “I’ll play Miriam Hale, a maritime archivist who worked with Arthur’s brother before he disappeared; Arthur brought me the invitation because I’d helped his brother research Innsmouth’s shipping records. I’ve brought a notebook, pencils, a magnifying glass, and copies of our correspondence—yes, keep the notebook in my inventory.” The judge DID eventually receive the turn-5 spokesperson's character summary. Its original reason for 3/10 was “The eventual questions are thoughtful, but the mandatory setup order was violated and its repair consumed most of the remaining session.” Corrected judge: “The eventual questions show useful personalization, but setup starts late and repeatedly fails to register answers.” Thus omitted replies concealed a real answer-registration problem, not a successful setup.

Six baseline sessions, in dataset-item order:

| Variant | Session | Character before → after | Original judge reason |
|---|---|---:|---|
| mechanical | oF8xVV_Ysz2oT5KMHYHlE | 3 → 3 | Setup order violated; repair consumes session |
| mechanical | rg2b2O2S_grP2QKcEyE19 | 1 → 1 | Required setup absent from supplied transcript |
| mechanical | GEv34OttzYZfJsJKUkfW9 | 1 → 1 | Mandatory setup skipped entirely |
| minimal | nw6Q35cDuZzb9kITJ8Mha | 1 → 1 | Required setup entirely skipped |
| minimal | Kgja7efKlwzNp2vma1-o9 | 1 → 1 | Required character creation skipped entirely |
| minimal | PlHoD3ZUagbhDgjYMSlMD | 1 → 1 | Required setup skipped entirely |

Change: `report/gemini-eval.ts:109-123` retains every message and explicitly labels PLAYER versus SPOKESPERSON; no invented final character state is supplied as if it existed before play. `prompts/evaluator.ts:270` changes only divisor 15.5 → 14.5; criteria and weights unchanged. `cli/langfuse-experiment.ts:60-77,229-250,259-284,315-319,368` adds `--rejudge-sessions`, loading exact saved turn checkpoints and original outcome, creating new named experiment runs, and preserving baseline report files. Existing code-computed weighted scores already used 14.5; the prompt correction alone cannot inflate those baseline scores.

Same six checkpoints rejudged; no new player/narrator calls. New experiment runs, not overwritten score sets, are the smallest way to reuse the existing per-item evaluator and comparison UI. Reports: `sessions/<id>/judge-full-replies/gemini-eval.{json,md}`. Command: `pnpm exec tsx cli/langfuse-experiment.ts --story shadow-over-innsmouth --variants mechanical,minimal --items 3 --max-turns 6 --players 2 --narrator codex-local --rejudge-sessions oF8xVV_Ysz2oT5KMHYHlE,rg2b2O2S_grP2QKcEyE19,GEv34OttzYZfJsJKUkfW9,nw6Q35cDuZzb9kITJ8Mha,Kgja7efKlwzNp2vma1-o9,PlHoD3ZUagbhDgjYMSlMD`. Exit 0; 379.02 seconds wall time. Log `/tmp/pulse/rejudge.log`; Codex audit `/tmp/pulse/rejudge-codex.jsonl`.

| Criterion | Mechanical before | after | Minimal before | after |
|---|---:|---:|---:|---:|
| agency_respect | 8.67 | 9.33 | 8.67 | 9.33 |
| declaration_vs_acknowledgment | 9.00 | 9.33 | 9.00 | 9.33 |
| invitation_architecture | 8.00 | 8.00 | 9.00 | 9.00 |
| branching_persistence | 6.67 | 6.33 | 6.67 | 6.67 |
| equipment_engagement | 5.67 | 6.00 | 5.67 | 5.33 |
| npc_dialogue | 7.67 | 7.67 | 9.00 | 8.33 |
| spatial_consistency | 8.00 | 7.67 | 8.67 | 8.67 |
| character_creation | 1.67 | 1.67 | 1.00 | 1.00 |
| atmosphere | 8.67 | 8.00 | 9.00 | 9.00 |
| curiosity_following | 8.67 | 8.00 | 9.00 | 8.33 |
| pacing_breath | 6.00 | 5.33 | 7.33 | 7.33 |
| actionable_vs_atmospheric | 8.67 | 8.00 | 9.00 | 9.00 |
| weighted_overall | 7.44 | 7.34 | 7.79 | 7.80 |
| judge_reported_overall | 7.62 | 7.49 | 7.72 | 8.05 |

Numbers are three-item means; independent judgment can move untouched dimensions. This step did not fix skipped setup, repeated questions, shallow equipment use, branch convergence, or six-turn truncation. The weakest actual criterion is **character_creation**, not equipment_engagement. Step 2 must follow that result.

Langfuse project URL prefix: `https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=`.
- Baseline mechanical: `723ed83cc2117c79`.
- Baseline minimal: `4540cdc32b01f350`.
- Corrected mechanical `pulse-mechanical-judge-full-replies-2026-11-13T00:11:52.565Z`: `83a79b3c42f14622`.
- Corrected minimal `pulse-minimal-judge-full-replies-2026-11-13T00:11:52.565Z`: `c122a785ab8ad6d0`.

## Step 2 — minimal-character setup checkpoint

Corrected minimal's weakest criterion is character_creation (1.00), below equipment_engagement (5.33). `minimal` already says to ask identity, belongings and motivation first, wait, and ask personality questions (`packages/core/ai/prompts/minimal.ts:26`). It mentions equipment in its turn checklist (44) and “Don't let equipment become invisible” (52). We follow the actual scores rather than the expected equipment hypothesis.

Hypothesis: the narrator mistakes pre-game player banter, names, and notebook mentions for sufficient character setup. Add a concrete checkpoint to distinguish those from complete character details and remember completed answers. No base minimal instructions, criteria, weights, story guide, model, or runner behavior changed.

Change: `prompts/loader.ts:13-22,40-46` registers `minimal-character` and returns exactly the existing minimal prompt plus these lines:

```text
## Setup Checkpoint
Opening table banter, player names, and passing item mentions are not completed character creation.
Until each player has supplied a character identity, belongings, and motivation, ask for the missing details instead of starting a scene; acknowledge answers already supplied rather than asking for them again.
Once those details are present, ask a personal follow-up for each character and wait for the replies before beginning the story.
```

Command (same local-model environment): `pnpm exec tsx cli/langfuse-experiment.ts --story shadow-over-innsmouth --variants minimal-character --items 3 --max-turns 6 --players 2 --narrator codex-local`. Exit 0; 913.00 seconds wall time. Background via nohup, waited once. Log `/tmp/pulse/minimal-character.log`; Codex audit `/tmp/pulse/minimal-character-codex.jsonl`. Same hosted dataset item IDs and stored friend groups as the baseline. New in-story characters and play are generated, so this is not an identical-transcript comparison. Run metadata contains the preceding measurement commit because this run was completed before committing its prompt and results together; the exact addition is quoted above.

| Criterion | Corrected minimal | minimal-character | Delta |
|---|---:|---:|---:|
| agency_respect | 9.33 | 9.67 | +0.33 |
| declaration_vs_acknowledgment | 9.33 | 10.00 | +0.67 |
| invitation_architecture | 9.00 | 7.67 | -1.33 |
| branching_persistence | 6.67 | 6.33 | -0.33 |
| equipment_engagement | 5.33 | 8.33 | +3.00 |
| npc_dialogue | 8.33 | 7.67 | -0.67 |
| spatial_consistency | 8.67 | 8.67 | 0.00 |
| character_creation | 1.00 | 8.33 | +7.33 |
| atmosphere | 9.00 | 8.33 | -0.67 |
| curiosity_following | 8.33 | 7.33 | -1.00 |
| pacing_breath | 7.33 | 6.00 | -1.33 |
| actionable_vs_atmospheric | 9.00 | 8.67 | -0.33 |
| weighted_overall | 7.805 | 8.184 | +0.379 |
| judge_reported_overall | 8.053 | 8.170 | +0.117 |

Character scores by item are 10, 5, 10; pacing 8, 2, 8. Sessions: `UAqdvaNVFe2YPohGNI13J`, `-fI1Vr5fbf_V1xjTQYjjg`, `y7spPzwavaml7NQYCXUhx`. The weakest remaining mean is pacing_breath (6.00), then branching_persistence (6.33).

Side-by-side excerpt, same Johann/Velma stored group:

| Corrected minimal baseline (nw6Q35cDuZzb9kITJ8Mha) | minimal-character (UAqdvaNVFe2YPohGNI13J) |
|---|---|
| Turn 1: “Rain blurs the last line of the letter tucked into Velma’s notebook” — scene starts immediately. | Turn 1: “Before we begin, what is each character’s occupation, what brought each of you to Innsmouth, and what has Johann brought along?” |
| Character score 1; no identity/motivation or personal follow-ups. | Players establish Arthur/Clara and belongings, receive personal follow-ups at turn 2; their answers reach the narrator through a turn-3 spokesperson relay; scene begins turn 4. Character score 10. |

What differs/what this did not fix: one new session repeats answered questions through turn 5, leaving only one story turn. In `-fI1Vr5fbf_V1xjTQYjjg`, Ruth explicitly answers at turn 2, “She once approved a convincing claim built around photographs of the wrong property”; the narrator asks again at turn 4, “Celia, has Ruth ever trusted a photograph and regretted it?” This is not merely weak prompt compliance: `session/runner.ts:260-290` filters narrator input to narrator and spokesperson messages, drops directed `player` replies, then injects “[The players acknowledge and wait for the narrator to continue.]” or “[The players consider their response.]”. The judge now sees answers the narrator cannot. Separately, turns 2 in the other two sessions direct questions to character names (Arthur/Clara, Thomas/Clara) and produce no player replies until a discussion turn. These are observed routing/input failures, deliberately NOT fixed in this one-prompt-change step.

Next iteration according to the numbers: repair public directed-answer delivery to the narrator while keeping genuinely private player discussion private; verify player-name/character-name routing. Pacing is now the weakest dimension, and the 2/10 outlier is explained by dropped answers, not a need for a more forceful pacing prompt. Then rerun the same three groups before expanding the sample and story length. Three items show a promising setup improvement, not a reliable overall winner: stochastic play/judging, shared narrator/judge model family, setup consuming a six-turn budget, large per-item variation, and seven declining dimensions all limit the claim. Equipment improved without an equipment instruction, so do not attribute its +3.00 causally to targeted equipment work.

Langfuse new run `pulse-minimal-character-2026-11-13T00:19:52.758Z`: `https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=ceaebbcc4f57c9f3`. Open beside corrected minimal `https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=c122a785ab8ad6d0`.

Combined measured subprocess wall time: 1,292.02 seconds (21m32s); inspection/editing/documentation adds elapsed time. No build, lint, or unit tests were run in this builder assignment; the two explicitly requested experiment executions are the exercised verification. Baseline and corrected report JSON files are retained on disk, as are the new session checkpoints and judgments. No paid model API was selected; all four role selections were codex-local, and no push was performed.

## Step 3 — deliver public directed answers (Codex)

Confirmed cause from the saved `-fI1Vr5fbf_V1xjTQYjjg/turn-006.json` transcript: at turn 2 Celia says, “She once approved a convincing claim built around photographs of the wrong property”; at turn 4 the narrator asks, “Celia, has Ruth ever trusted a photograph and regretted it?” The narrator history filter excluded every `player` message, replacing these public answers with a waiting placeholder. Its game-state injection retained names/items but not these personal answers. The judge scored pacing 2 and called turns 3–5 redundant.

The companion routing defect is also observed, not hypothetical: `UAqdvaNVFe2YPohGNI13J` turn 2 addresses “Clara” and “Arthur”; `y7spPzwavaml7NQYCXUhx` addresses “Thomas” and “Clara”. Neither turn has any player reply because routing only matched real player names. Both narrators wait again at turn 3.

Hypothesis: repair this single harness path, public directed question → owning player → narrator, instead of strengthening the pacing prompt. `session/runner.ts` adds `narratorVisibleHistory` (uses the preceding narrator's saved directed classification), labels public replies by player, and resolves directed targets against real names and unique full/first character names. Private replies and deliberation remain excluded. `cli/langfuse-experiment.ts` adds only `--run-label` for descriptive run names. `tests/narrator-routing.test.ts` covers visibility, privacy, character aliases, and ambiguous aliases. No narrator prompt, judge, criteria, weights, story, or turn budget changed.

Step-3 experiment and measurements are pending execution below; this checkpoint records the implementation before its long run. Step-4 paid-session ledger: 0 used / 40; exactly 6 authorized for this assignment.
