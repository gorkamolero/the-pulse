# End-to-End Test Guide

This document outlines the E2E testing procedure for validating the complete test harness system.

## Test Objectives

Verify that the test harness can:
1. Run complete sessions from start to finish
2. Generate reports with correct metrics
3. Save checkpoints at each turn
4. Support multiple narrator and player agent models
5. Handle errors gracefully

## Prerequisites

### Environment Setup

Create `.env` file with API keys:

```bash
# Required
OPENROUTER_API_KEY=your_key_here    # For Grok, DeepSeek, Qwen, Kimi player agents
OPENAI_API_KEY=your_key_here        # For GPT-4o-mini classification

# Optional (for testing Opus narrator)
ANTHROPIC_API_KEY=your_key_here     # For Claude Opus 4.5 narrator
```

### Install Dependencies

```bash
pnpm install
```

## Test Plan

### Test 1: Basic Session Run (Smoke Test)

**Objective**: Verify basic session execution with cheapest models

```bash
pnpm test:run \
  --story innsmouth \
  --prompt baseline \
  --narrator deepseek-r2 \
  --players 3 \
  --max-turns 10
```

**Expected Results**:
- ✅ Session starts and runs without crashes
- ✅ 3 player agents created with different archetypes
- ✅ Character creation phase completes
- ✅ At least 5 turns execute
- ✅ Checkpoints saved for each turn
- ✅ Report generated at `sessions/[session-id]/report.md`

**Validation Steps**:
1. Check console output for errors
2. Verify `sessions/[session-id]/` directory exists
3. Count checkpoint files (should have turn-000.json through turn-00X.json)
4. Read report.md and verify structure

---

### Test 2: Full Story Completion

**Objective**: Run a complete story to conclusion

```bash
pnpm test:run \
  --story innsmouth \
  --prompt pulse-aware \
  --narrator grok-4 \
  --max-turns 50
```

**Expected Results**:
- ✅ Session reaches narrative conclusion or max turns
- ✅ Pulses detected (~10-20 depending on turns)
- ✅ Timeline shows story progression
- ✅ Issues detected (if any) are logged
- ✅ Report includes full transcript

**Validation Steps**:
1. Check final turn count in report
2. Verify pulse count in summary
3. Look for completion indicators in timeline
4. Review detected issues section

---

### Test 3: Multiple Narrator Models

**Objective**: Verify all three narrator models work

Run three sessions in sequence:

```bash
# DeepSeek R2 (cheapest)
pnpm test:run --story innsmouth --prompt baseline --narrator deepseek-r2 --max-turns 5

# Grok 4
pnpm test:run --story innsmouth --prompt baseline --narrator grok-4 --max-turns 5

# Opus 4.5 (requires ANTHROPIC_API_KEY)
pnpm test:run --story innsmouth --prompt baseline --narrator opus-4.5 --max-turns 5
```

**Expected Results**:
- ✅ All three sessions complete successfully
- ✅ Each uses the correct model in session config
- ✅ Narrative style differences visible in transcripts

---

### Test 4: Different Stories

**Objective**: Verify multiple story configurations

```bash
pnpm test:run --story innsmouth --prompt baseline --narrator deepseek-r2 --max-turns 5
pnpm test:run --story hollow-choir --prompt baseline --narrator deepseek-r2 --max-turns 5
pnpm test:run --story whispering-pines --prompt baseline --narrator deepseek-r2 --max-turns 5
pnpm test:run --story red-dust --prompt baseline --narrator deepseek-r2 --max-turns 5
```

**Expected Results**:
- ✅ All stories run successfully
- ✅ Story context correct in each session
- ✅ Setting and genre reflected in narrative

---

### Test 5: Checkpoint System

**Objective**: Verify checkpoint save/load

1. Run a session:
```bash
pnpm test:run --story innsmouth --prompt baseline --narrator deepseek-r2 --max-turns 10
```

2. Note the session ID from output

3. Test checkpoint loading:
```bash
pnpm test:replay --checkpoint sessions/[session-id]/turn-005.json --prompt pulse-aware
```

**Expected Results**:
- ✅ Checkpoint loads successfully
- ✅ Config changes are applied
- ✅ New session ID created for branch
- ✅ Branch reason logged

---

### Test 6: Issue Detection

**Objective**: Verify issue detection systems work

Run a longer session to increase chance of detecting issues:

```bash
pnpm test:run --story innsmouth --prompt baseline --narrator deepseek-r2 --max-turns 30
```

**Expected Results**:
- ✅ Report includes "Issues Detected" section (or "No Issues Detected")
- ✅ If issues found, they have:
  - Turn number
  - Issue type (loop, forced-segue, stuck, contradiction)
  - Description
  - Severity level

**Manual Validation**:
1. Read the timeline section
2. Check for forced segue patterns ("anyway", "back to")
3. Verify stuck moments (long gaps between pulses)
4. Look for narrative loops

---

### Test 7: Player Agent Diversity

**Objective**: Verify all 10 archetypes function correctly

Run 5 sessions with random group composition:

```bash
for i in {1..5}; do
  pnpm test:run --story innsmouth --prompt baseline --narrator deepseek-r2 --max-turns 5
done
```

**Expected Results**:
- ✅ Different archetype combinations across sessions
- ✅ All 4 model tiers represented (Grok, Qwen, DeepSeek, Kimi)
- ✅ Player responses show personality differences
- ✅ Spokesperson synthesis reflects their archetype

**Manual Validation**:
1. Check "Group" table in each report
2. Read player responses in transcripts
3. Note behavioral pattern differences:
   - Joker: humor and jokes
   - Questioner: clarifying questions
   - Wildcard: unexpected actions
   - Follower: brief, deferring responses
   - etc.

---

### Test 8: Private Moments

**Objective**: Verify private moment detection and routing

Run session and watch for private moments:

```bash
pnpm test:run --story innsmouth --prompt baseline --narrator deepseek-r2 --max-turns 20
```

**Expected Results**:
- ✅ Private moments detected (console shows "🔒 Private moment for [name]")
- ✅ Individual player response (not group)
- ✅ Timeline includes private moment entries
- ✅ Transcript shows private exchanges

**Manual Validation**:
1. Search transcript for private moment patterns
2. Verify only target player responded
3. Check if private information revealed later

---

### Test 9: Error Handling

**Objective**: Verify graceful error handling

Test with invalid configuration:

```bash
# Invalid story
pnpm test:run --story nonexistent --prompt baseline --narrator deepseek-r2

# Invalid narrator
pnpm test:run --story innsmouth --prompt baseline --narrator invalid-model

# Invalid prompt
pnpm test:run --story innsmouth --prompt nonexistent --narrator deepseek-r2
```

**Expected Results**:
- ✅ Clear error messages displayed
- ✅ Available options shown
- ✅ Process exits cleanly (no crashes)

---

### Test 10: Report Quality

**Objective**: Verify generated reports are readable and complete

Run one full session, then manually review the report:

```bash
pnpm test:run --story innsmouth --prompt baseline --narrator grok-4 --max-turns 20
```

**Manual Review Checklist**:
- ✅ Report has all sections: Config, Group, Summary, Timeline, Issues, Transcript
- ✅ Markdown formatting is correct
- ✅ Timeline is chronological
- ✅ Transcript is complete and properly formatted
- ✅ Speaker names are consistent
- ✅ Turn numbers are sequential
- ✅ Statistics are accurate

---

## Success Criteria

The test harness passes E2E testing when:

1. ✅ **All 10 tests complete successfully** (or fail gracefully where expected)
2. ✅ **No crashes or unhandled exceptions** during normal operation
3. ✅ **Checkpoints save correctly** at every turn
4. ✅ **Reports are generated** and readable
5. ✅ **All narrator models work** (DeepSeek, Grok, Opus if API key provided)
6. ✅ **All player agent models work** (4 tiers represented)
7. ✅ **Issue detection functions** (finds at least some issues across multiple sessions)
8. ✅ **Cost estimates are reasonable** (within expected ranges per model)

## Known Limitations

1. **Replay continuation not implemented**: `test:replay` loads checkpoints and applies config changes but doesn't continue the session yet
2. **Cost tracking is estimated**: Actual token usage tracking not yet implemented
3. **Private moment payoff detection is basic**: Uses simple keyword matching
4. **LLM-based validation placeholders**: Some validation functions return placeholder scores

## Next Steps

After passing E2E tests:
1. Run multiple sessions to build dataset
2. Analyze reports with Claude for prompt improvements
3. Test checkpoint replay with prompt variations
4. Calibrate issue detection thresholds
5. Implement remaining TODOs in code
