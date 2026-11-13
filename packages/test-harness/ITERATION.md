# Narrator iteration: measure, then change one thing

All model roles use local Codex (`codex-local`), never paid model APIs. Nothing is pushed. Langfuse is telemetry only. Story: shadow-over-innsmouth; six turns; two players; three stored dataset groups per variant. Times below are measured wall time, not estimates. API timestamps are UTC and crossed into November 13 during this work.

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
