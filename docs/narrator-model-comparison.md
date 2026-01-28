# Narrator Model Comparison

First pulse test for "Shadow Over Innsmouth" - comparing models for guest narrator.

**Test date:** 2025-01-28
**Prompt:** `Let's start the story "Shadow Over Innsmouth".`
**Mode:** Solo (guest)

## Results

### **kimi-k2** (2.6s, 103 words) ⭐ WINNER
```
The stench of rotting fish hits you before you see the town—an almost physical blow as your rented Ford splutters down the broken coastal road. Through cracked windows, Innsmouth materializes like something half-drowned: leaning gambrel roofs clawing at a pale sky, salt-streaked clapboard houses crouched shoulder-to-shoulder as if whispering secrets. The town sign—wood split by decades of brine—reads simply *INNSMOUTH, 1846*, with fresh scratches carved beneath: *THEY WALK AMONG YOU*.

Your arranged taxi door hangs open where the driver fled an hour ago, its meter clicking in the silence. The envelope in your pocket—postmarked with a single drifting eye—grows warm against your palm.
```

### **minimax-her** (3.0s, 61 words)
```
Your cab lurches to a stop on a rain-slicked street. The driver shoves your bag out and speeds off without waiting for payment. Ahead, sagging houses lean together like conspirators, their boarded windows staring blankly through the fog. A fishy smell fills the air, and somewhere in the distance, someone-or something-is singing in a language that sounds like wet stones grinding.
```

### **deepseek-v3.2** (5.1s, 60 words)
```
The sky over the Massachusetts coast is the color of a bruise. Your car, a rented Model T, rattles down a pitted road lined with salt-scoured pines. The map on the passenger seat is old, creased, and cryptic; a line in faded ink leads you toward a coastal blotch labeled only with a symbol—three wavy lines beneath a staring eye.
```

### **opus-4.5** (5.7s, 102 words)
```
The bus rattles to a stop at a crossroads where the pavement surrenders to cracked mud. Arkham is behind you now—twenty miles of salt marsh and silence ahead. The driver won't meet your eyes as he jerks a thumb toward a rusted sign: **INNSMOUTH - 8 MILES**.

"End of the line for you," he mutters. "Nobody goes there. Nobody *should*."

A cold wind carries the smell of brine and something fouler—decay, maybe, or fish left too long in the sun. In your coat pocket, the letter that brought you here feels heavier than paper should.

The road stretches north, swallowed by fog.
```

### **glm-4.7** (6.2s, 73 words)
```
The bus rumbles away, leaving you alone at the crossroads with a suitcase and a heavy envelope bearing no return address. A damp, briny wind carries the stench of rotting fish from the town below, where sagging gambrel roofs leer through the fog like broken teeth. Inside the envelope, a scrap of paper reads: "Seek the town where fish never sleep," while a map fragment on the back displays a strange, spiral symbol.
```

### **haiku-4.5** (3.9s, 164 words) ❌
Uses markdown headers and document formatting instead of prose narrative.

### **mistral-creative** (1.2s, 127 words) ❌
Fastest but uses markdown formatting (`---`, `**Pulse 0:**`).

### **minimax-m2.1** (18.0s, 161 words) ❌
Too slow, ends with "What do you do?"

### **kimi-k2.5** (15.5s, 140 words) ❌
Slow, has Chinese character glitch in output.

### **gemini-3-pro** (18.7s, 85 words) ❌
Too slow.

## Summary Table

| Model | Time | Words | Verdict |
|-------|------|-------|---------|
| **kimi-k2** | **2.6s** | **103** | ⭐ **Winner** - Fast, atmospheric, great prose |
| minimax-her | 3.0s | 61 | Good, punchy, concise |
| deepseek-v3.2 | 5.1s | 60 | Short, poetic |
| opus-4.5 | 5.7s | 102 | Great dialogue, slower |
| glm-4.7 | 6.2s | 73 | Decent |
| haiku-4.5 | 3.9s | 164 | ❌ Markdown formatting |
| mistral-creative | 1.2s | 127 | ❌ Markdown formatting |
| minimax-m2.1 | 18.0s | 161 | ❌ Too slow |
| kimi-k2.5 | 15.5s | 140 | ❌ Slow, encoding issues |
| gemini-3-pro | 18.7s | 85 | ❌ Too slow |

## Selection Criteria

For guest narrator, prioritize:
1. **Speed** - Under 5 seconds for good UX
2. **Prose quality** - Atmospheric, evocative, no markdown formatting
3. **Length** - 60-120 words ideal for first pulse
4. **Immersion** - No "What do you do?" prompts, no headers

## Current Choice

**Guest narrator:** `moonshotai/kimi-k2`

Configured in `apps/web/app/(chat)/api/pulse/route.ts`

## Test Script

```bash
pnpm test:first-pulse              # All models
pnpm test:first-pulse --model=kimi-k2  # Specific model
```

Script: `apps/web/scripts/test-first-pulse.ts`
