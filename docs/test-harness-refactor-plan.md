# Test Harness Refactor Plan

## Current State

The test harness is currently in a separate `test-harness/` directory with its own:
- `package.json` (separate dependencies)
- `tsconfig.json` (isolated build)
- `node_modules/` (duplicate dependencies)
- Awkward relative imports to main codebase (`../../../lib/ai/stories`)

## Goal

Integrate test harness into main project at `lib/test-harness/` for:
- Direct imports from `lib/ai/stories` and other lib modules
- Shared dependencies (no duplication)
- Unified build and linting
- Simpler CI/CD and development workflow

## File Inventory

**27 TypeScript source files** to move:
```
test-harness/src/
├── agents/              (4 files)
│   ├── index.ts
│   ├── narrator.ts
│   ├── player.ts
│   └── spokesperson.ts
├── archetypes/          (3 files)
│   ├── definitions.ts
│   ├── index.ts
│   └── types.ts
├── checkpoint/          (4 files)
│   ├── index.ts
│   ├── load.ts
│   ├── save.ts
│   └── schema.ts
├── cli/                 (3 files)
│   ├── index.ts
│   ├── replay.ts
│   └── run.ts
├── report/              (4 files)
│   ├── index.ts
│   ├── issues.ts
│   ├── markdown.ts
│   └── timeline.ts
├── session/             (7 files)
│   ├── classifier.ts
│   ├── cost.ts
│   ├── errors.ts
│   ├── index.ts
│   ├── private.ts
│   ├── runner.ts
│   └── turn.ts
├── stories/             (1 file)
│   └── loader.ts
└── index.ts             (1 file)
```

## Dependency Analysis

### Already in main package.json
- ✅ `@openrouter/ai-sdk-provider` (^1.4.1 → update to ^1.5.0)
- ✅ `ai` (5.0.108 → keep, close enough to ^5.0.107)
- ✅ `zod` (^4.1.13)
- ✅ `nanoid` (^5.0.8)
- ✅ `dotenv` (^16.4.5)

### Need to add to main package.json
- ❌ `chalk` (^5.3.0) - terminal colors
- ❌ `commander` (^12.1.0) - CLI framework
- ❌ `ora` (^8.0.1) - terminal spinners
- ❌ `@ai-sdk/openai` (^2.0.79) - but we're removing OpenAI usage, so skip

### Dev dependencies
- ✅ `tsx` - already in main
- ✅ `typescript` - already in main
- ✅ `@biomejs/biome` - already in main
- ✅ `@types/node` - already in main

## Migration Steps

### 1. Move Source Files
```bash
# Create new directory
mkdir -p lib/test-harness

# Move all source files
cp -r test-harness/src/* lib/test-harness/

# Move other necessary files
cp test-harness/.env.example lib/test-harness/
cp test-harness/README.md lib/test-harness/
```

### 2. Update Main package.json

Add dependencies:
```json
{
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^12.1.0",
    "ora": "^8.0.1"
  }
}
```

Update `@openrouter/ai-sdk-provider` to `^1.5.0`.

Add scripts:
```json
{
  "scripts": {
    "test:run": "tsx lib/test-harness/cli/run.ts",
    "test:replay": "tsx lib/test-harness/cli/replay.ts",
    "test:batch": "tsx lib/test-harness/cli/batch.ts",
    "test:compare": "tsx lib/test-harness/cli/compare.ts"
  }
}
```

### 3. Update All Imports

**Before (in test-harness/):**
```typescript
import { innsmouth } from '../../../lib/ai/stories/shadow-over-innsmouth';
```

**After (in lib/test-harness/):**
```typescript
import { innsmouth } from '@/lib/ai/stories/shadow-over-innsmouth';
// or
import { innsmouth } from '../ai/stories/shadow-over-innsmouth';
```

Files that need import updates:
- `lib/test-harness/stories/loader.ts` - story imports
- `lib/test-harness/cli/run.ts` - story imports
- `lib/test-harness/cli/replay.ts` - story imports
- All internal cross-references (stay the same, just verify)

### 4. Update tsconfig.json (if needed)

Main `tsconfig.json` already includes `lib/**/*` so test harness will be included automatically.

Verify `paths` mapping if using `@/` imports:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### 5. Create Output Directories

Add to `.gitignore`:
```
# Test harness outputs
/test-harness-sessions/
/test-harness-checkpoints/
```

Update test harness code to output to project root instead of relative paths:
- `sessions/` → `/test-harness-sessions/`
- Or keep `sessions/` at project root

### 6. Update CLI Entry Points

The CLI files should work with `tsx` directly:
```bash
pnpm test:run --story innsmouth --prompt baseline
# Runs: tsx lib/test-harness/cli/run.ts --story innsmouth --prompt baseline
```

### 7. Remove Old Structure

After verifying everything works:
```bash
rm -rf test-harness/
```

### 8. Update Documentation

- Update `test-harness/README.md` → `lib/test-harness/README.md`
- Update `docs/` references to test harness location
- Update `CLAUDE.md` if test harness is mentioned

## Import Path Strategy

**Recommended:** Use relative imports within lib/
```typescript
// From lib/test-harness/stories/loader.ts
import { innsmouth } from '../ai/stories/shadow-over-innsmouth';
import { hollowChoir } from '../ai/stories/the-hollow-choir';
```

**Why:**
- Works without tsconfig path mapping
- Clear what's being imported from where
- No ambiguity with Next.js `@/` alias

## Testing Checklist

After migration:
- [ ] `pnpm install` - install new dependencies
- [ ] `pnpm build` - TypeScript compilation succeeds
- [ ] `pnpm lint` - Biome linting passes
- [ ] `pnpm test:run --story shadow-over-innsmouth --prompt baseline --narrator deepseek-r1 --dry-run` - CLI works
- [ ] Verify story loader can import stories
- [ ] Run actual test session
- [ ] Verify checkpoint save/load
- [ ] Verify report generation

## Benefits

1. **Simpler imports:** `../ai/stories/` instead of `../../../lib/ai/stories/`
2. **Shared dependencies:** No duplicate node_modules, consistent versions
3. **Unified build:** One `pnpm build`, one `pnpm lint`
4. **Better CI/CD:** No separate package to manage
5. **Easier development:** One workspace, one environment
6. **Type safety:** Shared types between main app and test harness

## Risks & Mitigations

**Risk:** Breaking existing test harness functionality
**Mitigation:** Test thoroughly after each step, keep old directory until verified

**Risk:** Import path confusion
**Mitigation:** Use clear relative paths, document pattern

**Risk:** Build time increase
**Mitigation:** Test harness is small (27 files), negligible impact

## Timeline Estimate

- Move files: 5 minutes
- Update package.json: 5 minutes
- Fix imports: 15 minutes
- Testing: 15 minutes
- Cleanup: 5 minutes

**Total:** ~45 minutes

## Success Criteria

- ✅ All test harness code in `lib/test-harness/`
- ✅ No separate `test-harness/package.json`
- ✅ No duplicate dependencies
- ✅ TypeScript compiles without errors
- ✅ CLI commands work: `pnpm test:run`, `pnpm test:replay`
- ✅ Can run full test session successfully
- ✅ Story loader imports work
- ✅ Old `test-harness/` directory removed
