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

Exact code locations for the committed repair: `session/runner.ts:244-276` visibility/target helpers, `294-295` history selection, `305-306` player labels, `321` corrected comment, `781` target resolution; `cli/langfuse-experiment.ts:61,230,370` run-label support. Implementation checkpoint: `fe8d300`.

Command: `nohup sh /tmp/pulse-step3.sh` wraps `pnpm exec tsx cli/langfuse-experiment.ts --story shadow-over-innsmouth --variants minimal-character --items 3 --max-turns 6 --players 2 --narrator codex-local --run-label directed-answer-delivery-codex`, with all other roles explicitly `codex-local` and the same Langfuse keys/dataset. Exit 0; measured subprocess wall time **1,006.80s (16m47s)** (`time -p`: 1,006.72s). Audit `/tmp/pulse/step3-codex.jsonl`; aggregate `/tmp/pulse/step3-results.json`. Sessions in stored-item order: `KmdnL8NCL-Zr9G2J5lQ12`, `0zVq_2BiAJRKX0Yb9cY9E`, `Y_IxUV4seOGmHgwNerh3r`. Each retains six checkpoints, `langfuse.json`, and `gemini-eval.{json,md}`. The run used repair commit `fe8d300`; the subsequent player namespace change is irrelevant to explicit Codex overrides.

| Criterion | Step 2 | Step 3 | Delta |
|---|---:|---:|---:|
| agency_respect | 9.667 | 10.000 | +0.333 |
| declaration_vs_acknowledgment | 10.000 | 10.000 | 0.000 |
| invitation_architecture | 7.667 | 9.000 | +1.333 |
| branching_persistence | 6.333 | 7.333 | +1.000 |
| equipment_engagement | 8.333 | 8.667 | +0.333 |
| npc_dialogue | 7.667 | 9.000 | +1.333 |
| spatial_consistency | 8.667 | 9.000 | +0.333 |
| character_creation | 8.333 | 9.667 | +1.333 |
| atmosphere | 8.333 | 8.667 | +0.333 |
| curiosity_following | 7.333 | 9.000 | +1.667 |
| pacing_breath | 6.000 | 8.000 | +2.000 |
| actionable_vs_atmospheric | 8.667 | 9.000 | +0.333 |
| weighted_overall | 8.184 | 9.000 | +0.816 |
| judge_reported_overall | 8.170 | 9.003 | +0.833 |

No mean criterion got worse in this three-item rerun; individual character scores are 9,10,10 (the first item fell from 10 to 9), and pacing is 8,8,8 (previously 8,2,8). Do not confuse the absence of a mean regression with proof of no regression. Branching remains weakest at 7.333; this fix does not demonstrate sustained branches, complete-story pacing, or final-act quality.

Side by side, same stored Celia/Marcelo group: before, Ruth's turn-2 account of the wrong-property photograph is followed by the turn-4 repeated question and the first scene only at turn 6. After (`0zVq_2BiAJRKX0Yb9cY9E`), turn 2 asks “Ruth, when your brother’s letter contradicts the certainty of your maps, which do you trust”; Celia answers “Ruth trusts her brother’s letter enough to question the maps”; turn 3 starts “The afternoon bus stands outside Innsmouth’s shuttered ticket office”. In the Johann/Velma item, character-addressed “Arthur” and “Clara” both receive directed replies at turn 2 and the scene also starts at turn 3. All three scenes begin at turn 3, leaving four fiction turns rather than the outlier's one. Generated fiction differs, so these are matched stored groups, not identical play.

Open step 2 and step 3 side by side:
- Step 2 `pulse-minimal-character-2026-11-13T00:19:52.758Z`: https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=ceaebbcc4f57c9f3
- Step 3 `pulse-minimal-character-directed-answer-delivery-codex-2026-11-14T12:40:48.798Z`: https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=532b08bc929ef2ed

## Step 4 — gateway transfer check

Authorized player-only substitution: default Grok `xai/grok-4.3` → `spacexai/grok-4.3`, the closest available gateway model (same Grok version under the current namespace). The authenticated gateway model catalog returned HTTP 200 but omitted the old ID; it lists this replacement, along with newer Grok 4.5/4.6/4.7 versions. Main explicitly authorized the substitution after the original stop condition triggered. `archetypes/types.ts:36` is the only model-selection line changed; both variants use the same defaults. Narrator remains `deepseek/deepseek-v4-flash`; judge remains `google/gemini-3.1-pro-preview`. Prerequisite evidence: `/tmp/pulse/step4-prerequisites.json`. No model generation was used for the catalog check.

Paid-session ledger: **6 / 40 used; 34 remain**. Exactly three `minimal` and three `minimal-character` sessions ran, with no extra paid generation/preflight session. The catalog lookup was not a model call. Command: `nohup sh /tmp/pulse-step4.sh` wraps `pnpm exec tsx cli/langfuse-experiment.ts --story shadow-over-innsmouth --variants minimal,minimal-character --items 3 --max-turns 6 --players 2 --narrator deepseek-v4-flash --run-label directed-answer-delivery-gateway-grok-namespace`, after clearing all four role overrides and loading the gateway key from Keychain. Exit 0; **1,363.93s (22m44s)** measured subprocess wall time (`time -p`: 1,363.84s). Run metadata uses `5fb94a7`, which includes both the harness repair and the one-line player substitution.

Observation/hypothesis for this step: Codex's setup improvement might not survive a different narrator and independent Gemini judge. This step changes no prompt or evaluator; it reruns both ends on the gateway with the same three hosted player groups and repaired harness. The only additional model-default edit is `archetypes/types.ts:36` in `5fb94a7`.

| Criterion | Codex minimal¹ | Codex character² | Gateway minimal | Gateway character | Gateway Δ |
|---|---:|---:|---:|---:|---:|
| agency_respect | 9.333 | 10.000 | 6.667 | 6.000 | -0.667 |
| declaration_vs_acknowledgment | 9.333 | 10.000 | 7.000 | 7.000 | 0.000 |
| invitation_architecture | 9.000 | 9.000 | 9.000 | 9.667 | +0.667 |
| branching_persistence | 6.667 | 7.333 | 8.333 | 8.333 | 0.000 |
| equipment_engagement | 5.333 | 8.667 | 7.000 | 4.333 | -2.667 |
| npc_dialogue | 8.333 | 9.000 | 7.000 | 7.333 | +0.333 |
| spatial_consistency | 8.667 | 9.000 | 9.000 | 9.000 | 0.000 |
| character_creation | 1.000 | 9.667 | 1.333 | 1.333 | 0.000 |
| atmosphere | 9.000 | 8.667 | 9.667 | 9.667 | 0.000 |
| curiosity_following | 8.333 | 9.000 | 8.333 | 9.000 | +0.667 |
| pacing_breath | 7.333 | 8.000 | 8.333 | 9.000 | +0.667 |
| actionable_vs_atmospheric | 9.000 | 9.000 | 9.000 | 9.667 | +0.667 |
| weighted_overall | 7.805 | 9.000 | 7.552 | 7.506 | -0.046 |
| judge_reported_overall | 8.053 | 9.003 | 7.583 | 7.413 | -0.170 |

¹ Corrected step-1 minimal (before routing repair). ² Step-3 minimal-character (after repair). The Codex columns therefore describe the endpoints of the iteration, not a new prompt-only controlled comparison: prompt and harness both differ between those columns. The gateway columns share the repaired harness and player defaults, so their only intended difference is the setup checkpoint. Cross-stack score differences conflate narrator, players, classifier, and judge; they are not a causal estimate of narrator quality alone.

**The setup improvement does not transfer.** Gemini gives character_creation 1,1,2 to gateway minimal-character, mean 1.333, unchanged from minimal. All three variants' opening scenes start immediately rather than asking the mandatory setup/personal questions. The saved `Byu4CNy79RjGsV0R8yl-E/turn-006.json` confirms `promptStyle: minimal-character` and that the actual system prompt contains `## Setup Checkpoint`: this is not a missing-variant artifact.

Side-by-side observed excerpt, Furman/Johanna: Codex step-3 turn 2 asks “Thomas, what unresolved quarrel with your brother makes his disappearance harder to bear?” and receives the player's answer before scene turn 3. Gateway minimal-character `eVYHdhgk8lvS-k7LgkTP2` starts “The bus wheezes to a halt” at turn 1 with no setup; at turn 3 the narrator writes the player's speech, “Eleanor answers after a beat: ‘Just a shovel.’” Gemini scores agency 2 for this item. What got worse on the real stack with the checkpoint: equipment 7.000 → 4.333, agency 6.667 → 6.000, weighted overall 7.552 → 7.506. Better invitation/pacing do not compensate for failing setup. The repair did not make DeepSeek follow the setup instruction or prevent authored player speech/actions.

Open these runs beside the Codex endpoints:
- Codex minimal (corrected judge): https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=c122a785ab8ad6d0
- Codex minimal-character (routing repair): https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=532b08bc929ef2ed
- Gateway `pulse-minimal-directed-answer-delivery-gateway-grok-namespace-2026-11-14T12:42:25.865Z`: https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=a53fa64d8e498596
- Gateway `pulse-minimal-character-directed-answer-delivery-gateway-grok-namespace-2026-11-14T12:42:25.865Z`: https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=1f67c75a923434ab

### Recorded per-session costs (USD), not a complete invoice

The run's `cost_usd` uses the legacy session tracker: it excludes judging/state extraction and estimates player prices (the log explicitly warns that current player IDs lack pricing). Langfuse observation costs include the independent Gemini judge and state/classifier calls, but every streamed narrator/player generation has `totalCost: null`. Null is unknown, not free. Record both measures rather than silently presenting either as the full cost including judge; these columns overlap and MUST NOT be added.

| Variant | Session | Run/tracker cost | Langfuse recorded subtotal incl. judge | Judge alone | Unpriced streamed generations |
|---|---|---:|---:|---:|---:|
| minimal | IPmq1aUrK9BiG2-tB5KU0 | $0.053487 | $0.137146 | $0.120596 | 26 |
| minimal | rIsWUxN8a667WdmMHwFXi | $0.053561 | $0.119032 | $0.098312 | 26 |
| minimal | _EiITsBM5_B2JRrHrzwTL | $0.029160 | $0.103319 | $0.091584 | 24 |
| minimal-character | M_aahwcuZI4xtBAqrMtwH | $0.050061 | $0.119249 | $0.105820 | 26 |
| minimal-character | Byu4CNy79RjGsV0R8yl-E | $0.044620 | $0.098457 | $0.085222 | 25 |
| minimal-character | eVYHdhgk8lvS-k7LgkTP2 | $0.031125 | $0.114892 | $0.100286 | 26 |
| Total (six sessions) | | $0.262014 | **$0.692096 incomplete** | $0.601820 | 153 |

Costs were read from the supported `GET /api/public/v2/observations?traceId=...&fields=core,basic,usage,model` endpoint, bounded from `2026-11-14T12:40:00Z` to the retrieval time and exhaustively retrieved (no continuation cursor). The legacy trace getter returned HTTP 410 and was not used. Evidence: `/tmp/pulse/step4-results.json` (full per-trace cost observations and exact score aggregates), `/tmp/pulse/step4-cost-summary.json` (compact costs/coverage), `/tmp/pulse/step4-prerequisites.json` (model catalog), and six session folders with checkpoints, `langfuse.json`, and Gemini JSON/Markdown. Recorded total cost including streamed generations is unavailable in this telemetry; this is a cost-measurement limitation, not an authorization to spend more sessions.

### Interpretation and verification boundary

Next iteration should target **production setup compliance** (1.333, the lowest gateway criterion), not tune pacing again. Inspect the conflict between “start now” behavior and the setup checkpoint; make one small production-stack change and compare on the same groups with Gemini before expanding the sample. Also inspect the agency failures before treating atmospheric prose as overall success. No additional iteration or paid session was run here.

Three items can expose a reproducible harness defect, confirm actual public-answer delivery, and reveal that the large Codex setup gain fails to appear in this small production-stack sample. They cannot establish significance, population-level win rates, generalization across stories, sustained equipment/branch handling, complete-story pacing, or which model-role change explains a cross-stack gap. Friend groups are matched, but character choices, spokesperson selection, play, and judgments are stochastic; six-turn truncation limits every dimension. Gemini provides model-family independence, not ground truth.

Measured subprocess wall times: Codex 1,006.80s; gateway 1,363.93s; summed compute-wait wall time **2,370.73s (39m31s)**. The two requested experiment processes overlapped; their wall times must not be presented as 39m31s of elapsed clock time. From Codex run creation `12:40:48.798Z` through approximately gateway completion `13:05:07Z`, the experiment window is about **24m18s**, excluding initial diagnosis/edits and final analysis/documentation. Both commands exited 0 with complete three-item judgments; no build, lint, formatter, or unit-test command was run by this builder. The added routing tests remain for Main to exercise. Nothing was pushed; all commits stay on `codex-local`.
