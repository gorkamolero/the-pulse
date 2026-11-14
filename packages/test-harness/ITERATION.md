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

## Step 5 — remove the false “setup complete” opening request

**Diagnosis, all six gateway transcripts:** every step-4 first narrator message starts a scene. Minimal's system prompt is 8,761 characters; minimal-character is 9,221 characters, with the identical checkpoint appended at character offset 8,762 in all three character runs (zero-based). It reaches the narrator near the end of the system prompt, in the same position on both model stacks; there is no evidence of truncation. The minimal-character checkpoint text and position do not change in this step.

The concrete conflict is the harness's *opening user message*, not merely system-prompt length. `session/runner.ts:227-242` previously wrapped the pre-game chat in “The group has already completed pre-game setup. Use this context as the established player and character material” and ended “Begin the story now at Pulse 1. Do not ask for player count, player names, character backstories, or gear unless a detail is genuinely absent.” Its empty-context branch even said “Do not ask setup questions.” The pre-game step actually generates table banter, not guaranteed identity/belongings/motivation or personal answers.

Quoted evidence: in gateway character session `Byu4CNy79RjGsV0R8yl-E`, the entire pre-game exchange is Celia asking whether Marcelo hopes she will “spot the inconsistencies before the narrator does” and Marcelo joking about bus schedules. Nonetheless, the first generated reasoning says “I need to start the story now, at Pulse 1, without any more setup questions,” and the output starts “The bus wheezes to a halt”. In `M_aahwcuZI4xtBAqrMtwH`, the narrator explicitly explains “The setup is complete per the user's instruction.” That is direct evidence of following the false completion assertion over the system checkpoint. In the Furman/Johanna item it also confuses real-player writing interests with established characters. Full six-opening evidence, prompt lengths/offsets, and pre-game excerpts: `/tmp/pulse/step5-opening-diagnosis.json`.

**One change:** replace the harness's contradictory first-turn request with “Let's start the group session. Follow your setup instructions before beginning the story.” Preserve pre-game content verbatim but label it “Pre-game conversation (not confirmation that character setup is complete)”. This is an opening-request correction, not a new scene gate or a stronger narrator checkpoint. It matches the real multiplayer flow: `apps/web/components/chat.tsx:566-580` asks to start a **group session** and requests player setup before the story; the production multiplayer system (`packages/core/ai/prompts/system.ts:86-99`) also includes setup. The harness already knows player count/names, so this does not add redundant count questions. There is no verified real-game hard setup gate to imitate, so no harness-only gate is invented.

Exact edit: `session/runner.ts:227-241`, `buildFirstTurnPrompt`, removes the two “begin now”/“setup complete” branches and uses the neutral group-session opener with or without banter. The helper is exported solely for regression coverage in `tests/narrator-routing.test.ts:40-53`, checking empty/bare-banter openings, retained context, and exclusion of later turns. No system prompt, checkpoint position, model selection, story, evaluator, scoring, or response routing changed.

Step-5 paid budget: at most 12 authorized; **3 used for this step, 9 / 40 cumulative** (31 remain). Exactly one three-item production rerun completed, no extra paid generation/preflight session. Because setup improved, one three-item **free** Codex compatibility experiment follows; it does not consume the paid allowance.

### Production result

Command: `nohup sh /tmp/pulse-step5-gateway.sh` wraps `pnpm exec tsx cli/langfuse-experiment.ts --story shadow-over-innsmouth --variants minimal-character --items 3 --max-turns 6 --players 2 --narrator deepseek-v4-flash --run-label honest-group-session-opening-gateway`, with default players/classifier and Gemini judge. Exit 0; **809.67s (13m30s)** measured wall time (`time -p`: 809.55s). Implementation commit `baed487`; no further behavior change. Sessions in stored-item order: `wuI3U41D-bp6QK58DyTBK`, `yfhnFIJPKDF810qASOjW3`, `uO3Zx7_gdUPxwb53gc3we`.

| Criterion | Gateway step 4 | Gateway step 5 | Delta |
|---|---:|---:|---:|
| agency_respect | 6.000 | 9.000 | +3.000 |
| declaration_vs_acknowledgment | 7.000 | 8.667 | +1.667 |
| invitation_architecture | 9.667 | 9.667 | 0.000 |
| branching_persistence | 8.333 | 9.333 | +1.000 |
| equipment_engagement | 4.333 | 9.000 | +4.667 |
| npc_dialogue | 7.333 | 8.667 | +1.333 |
| spatial_consistency | 9.000 | 10.000 | +1.000 |
| character_creation | 1.333 | 10.000 | +8.667 |
| atmosphere | 9.667 | 10.000 | +0.333 |
| curiosity_following | 9.000 | 9.333 | +0.333 |
| pacing_breath | 9.000 | 9.667 | +0.667 |
| actionable_vs_atmospheric | 9.667 | 10.000 | +0.333 |
| weighted_overall | 7.506 | 9.391 | +1.885 |
| judge_reported_overall | 7.413 | 9.367 | +1.953 |

No mean criterion got worse on production. Gemini's character scores are 10,10,10, and all three actual sessions ask setup at turn 1, personal follow-ups at turn 2, and begin their first scene at turn 3. The system prompts remain exactly 9,221 characters with checkpoint offset 8,762, ruling out checkpoint relocation as the explanation. This supports the opening-conflict hypothesis without attributing the result to a longer or higher-positioned system instruction.

Side by side, Celia/Marcelo: step-4 `Byu4CNy79RjGsV0R8yl-E` starts the bus scene at turn 1 after table banter. Step-5 `yfhnFIJPKDF810qASOjW3` instead says, “before any fog rolls in or any floorboard creaks beneath a stranger's step, I need to know the hands that will be turning those old brass doorknobs,” asks identity/belongings/motivation, and receives both player replies; turn 2 asks about Althea's mentor and Leo's coded letters. The bus scene waits until turn 3.

**Scores are not proof of flawless setup.** The first new item incorrectly says “Three characters” for two players, having extracted Velma as a separate character instead of Eleanor Voss. In the third item, Johanna is mapped to **Dr. Eleanor Vance**; the directed target **Eleanor** fails the existing unique-first-token match (its first token is “Dr.”), so her turn-2 follow-up has no reply, yet the scene starts at turn 3. Gemini still awarded each item 10 for character creation and called the setup “textbook”/“perfect”. This one change fixes the blanket scene-first behavior, not every character mapping or setup-completion error; the unchanged judge is overgenerous on these observed counterexamples. No extra routing fix or evaluator change is bundled into this step.

Open the production runs side by side:
- Before `pulse-minimal-character-directed-answer-delivery-gateway-grok-namespace-2026-11-14T12:42:25.865Z`: https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=1f67c75a923434ab
- After `pulse-minimal-character-honest-group-session-opening-gateway-2026-11-14T13:10:29.886Z`: https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=dd599855a1c46532

### Step-5 recorded paid costs (USD)

Same coverage limitation as step 4: the run/tracker estimates exclude judge/state calls; Langfuse subtotals include judging but omit null-priced streamed narrator/player generations. These measures overlap; do not sum them or call either a complete invoice.

| Session | Run/tracker | Langfuse recorded subtotal incl. judge | Judge alone | Unpriced streams |
|---|---:|---:|---:|---:|
| wuI3U41D-bp6QK58DyTBK | $0.050654 | $0.115469 | $0.101482 | 24 |
| yfhnFIJPKDF810qASOjW3 | $0.052286 | $0.112190 | $0.102366 | 24 |
| uO3Zx7_gdUPxwb53gc3we | $0.031070 | $0.123544 | $0.109798 | 23 |
| Step-5 total | $0.134010 | **$0.351203 incomplete** | $0.313646 | 71 |

Cumulative recorded Langfuse subtotal over nine paid sessions is **$1.043299 incomplete**; cumulative tracker estimate is $0.396024, not additive. Observations were exhaustively retrieved via the supported v2 endpoint, bounded from `2026-11-14T13:09:00Z`; no continuation cursors. Evidence retained: `/tmp/pulse/step5-gateway-results.json` (exact score aggregates, full observations, cost coverage), `/tmp/pulse/step5-opening-after.json` (same prompt size/position, turn progression, replies), `/tmp/pulse/step5-opening-diagnosis.json` (six baseline openings), and normal checkpoints/judgments in the three new session folders.

### Free Codex compatibility result

Production setup improved, so the conditional free check ran once as a three-item experiment: `nohup sh /tmp/pulse-step5-codex.sh` wraps `pnpm exec tsx cli/langfuse-experiment.ts --story shadow-over-innsmouth --variants minimal-character --items 3 --max-turns 6 --players 2 --narrator codex-local --run-label honest-group-session-opening-codex`, with player/classifier/judge all explicitly `codex-local`. Exit 0; **1,026.43s (17m06s)** measured wall time (`time -p`: 1,026.34s). The same setup-request behavior and dataset groups were used; run metadata points to implementation `baed487`. Sessions: `hdOxvUUpICLKtTqXD5xl1`, `Le5_LF08N56fJo1aGS4wI`, `-6TRhe9i-Xvg2bMJCcaKP`. Audit `/tmp/pulse/step5-codex.jsonl`; exact score aggregate `/tmp/pulse/step5-codex-results.json`; checkpoints/judgments in each session directory.

| Criterion | Codex step 3 | Codex step 5 | Delta |
|---|---:|---:|---:|
| agency_respect | 10.000 | 9.333 | -0.667 |
| declaration_vs_acknowledgment | 10.000 | 10.000 | 0.000 |
| invitation_architecture | 9.000 | 9.000 | 0.000 |
| branching_persistence | 7.333 | 7.333 | 0.000 |
| equipment_engagement | 8.667 | 8.000 | -0.667 |
| npc_dialogue | 9.000 | 8.667 | -0.333 |
| spatial_consistency | 9.000 | 8.000 | -1.000 |
| character_creation | 9.667 | 10.000 | +0.333 |
| atmosphere | 8.667 | 8.667 | 0.000 |
| curiosity_following | 9.000 | 9.000 | 0.000 |
| pacing_breath | 8.000 | 7.667 | -0.333 |
| actionable_vs_atmospheric | 9.000 | 9.000 | 0.000 |
| weighted_overall | 9.000 | 8.770 | -0.230 |
| judge_reported_overall | 9.003 | 9.030 | +0.027 |

Setup behavior remains intact on Codex: all three character scores are 10, all ask identity/belongings/motivation at turn 1 and personal questions at turn 2, with player replies before the first scene at turn 3. Example `hdOxvUUpICLKtTqXD5xl1`: “let’s establish your characters before we begin” at turn 1, then asks about Arthur's brother and Miriam's father at turn 2. This is a compatibility check of the target behavior, **not evidence of no regression overall**.

What got worse: Codex agency and equipment each -0.667, NPC dialogue -0.333, spatial consistency -1.000, pacing -0.333, weighted overall -0.230. In `Le5_LF08N56fJo1aGS4wI`, the NPC's turn-6 account of the brother going upstairs and then refusing to fetch paper upstairs is unclear; both players ask to repair the timeline. The judge flags `experientiallyWrong` and caps that item at 8.5. These declines are recorded, not dismissed as noise or silently omitted. The unchanged judge also reports an overall mean that moves opposite the code-computed weighted mean; use `weighted_overall` for consistent arithmetic.

Open the Codex runs beside each other and the production result:
- Codex before: https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=532b08bc929ef2ed
- Codex after `pulse-minimal-character-honest-group-session-opening-codex-2026-11-14T13:24:11.651Z`: https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=97afa9d2dbc1e582
- Production after: https://us.cloud.langfuse.com/project/cmw3rq7z302clad0kw2n81fln/experiments/results?baseline=dd599855a1c46532

**Next iteration from scores plus transcripts:** keep the truthful group-session opening; do not claim the checkpoint alone fixed production setup. Before celebrating the production 10/10 setup mean, repair the demonstrated title/character-owner routing gap (e.g. “Eleanor” → “Dr. Eleanor Vance”) as its own change, and calibrate the evaluator against the observed unanswered-follow-up/phantom-third-character counterexamples separately. Codex's weakest mean remains branching (7.333), but six-turn sessions do not give a fair persistence test. Longer/more varied sessions are needed before optimizing those dimensions or claiming an overall winner.

Three items establish that the blanket scene-first behavior disappears in these production sessions while setup still works in the Codex check. They do not establish statistical significance, universal setup completion, a production win rate, robust name mapping, sustained branching, or full-story pacing. Matched friend groups are not identical play: pre-game replies, character choices, spokesperson selection, and judgments vary. The explicit observed counterexamples prevent treating Gemini's perfect setup score as ground truth.

Step-5 measured experiment wall time: **809.67 + 1,026.43 = 1,836.10s (30m36s)**. These two runs are sequential (the free check was conditional on the production result), plus approximately twelve seconds between their run-creation windows; diagnosis/edits and final analysis add elapsed time. Paid sessions remain **9 / 40 total**, **3 / 12** of this step's allowance, with no second production attempt. Both requested experiment commands exited 0. No build/lint/formatter/unit-test command was run by this builder; Main should exercise `tests/narrator-routing.test.ts` and the harness typecheck. Nothing was pushed; all commits remain on `codex-local`.
