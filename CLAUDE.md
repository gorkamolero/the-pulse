# The Pulse - Claude Code Project Notes

## Project Overview

This project is based on [Vercel's AI Chatbot](https://github.com/vercel/ai-chatbot) template, customized for "The Pulse" interactive stories application.

## Next.js 16 - Important Changes

### Linting in Next.js 16

**CRITICAL**: Next.js 16 **removed** the `next lint` command entirely.

#### What Changed

- ❌ `next lint` command **NO LONGER EXISTS**
- ❌ `next build` **NO LONGER RUNS** linting automatically
- ✅ Use ESLint, Biome, or any linter **directly** via npm scripts

#### This Project's Setup

This project uses **Biome** exclusively for linting and formatting (following the Vercel AI Chatbot template):

```bash
# Lint and auto-fix
pnpm lint

# Format code
pnpm format
```

**Configuration**: See `biome.jsonc` for linting rules and settings.

**Why Biome?**
- Faster than ESLint (written in Rust)
- Unified tool for both linting and formatting
- Official Vercel template standard
- No ESLint configuration needed

#### If You Need ESLint

If you must add ESLint for specific plugins:

1. Install: `pnpm add -D eslint @eslint/js @eslint/eslintrc`
2. Create `eslint.config.mjs` (flat config format - ESLint v9+ requirement)
3. Update `package.json` scripts to include eslint
4. **DO NOT** use `.eslintrc.json` (legacy format, deprecated in ESLint v9)

**References:**
- [Next.js 16 Upgrading Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [ESLint Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)

### Middleware in Next.js 16

**CHANGED**: The `middleware.ts` file convention is deprecated.

- Old: `middleware.ts`
- New: `proxy.ts` (Next.js 16+ convention)

This project uses `proxy.ts` for authentication and route protection.

## Development

### Port Configuration

This project runs on **PORT 7272** (72 bpm, like a pulse).

```bash
PORT=7272 pnpm dev
```

### Key Technologies

- **Next.js 16** (App Router with Turbopack)
- **AI SDK** by Vercel
- **Biome** (linting & formatting)
- **Tailwind CSS v4**
- **shadcn/ui** components
- **Drizzle ORM** + Vercel Postgres
- **NextAuth.js v5 beta**

## Linting Standards

This project enforces **ZERO-WARNING, ZERO-ERROR** policy. All code must pass Biome checks before committing.

```bash
# Always run before committing
pnpm lint
```

Common Biome rules enforced:
- Button elements must have `type` attribute
- No unused imports
- No non-null assertions (`!`) without safety checks
- Accessibility (a11y) rules enabled

## Project Structure

```
app/
  (auth)/          # Authentication routes
  (chat)/          # Main chat interface and API routes
components/        # React components
lib/
  ai/              # AI-related utilities and prompts
  db/              # Database queries and schema
proxy.ts           # Next.js 16 middleware (auth)
biome.jsonc        # Biome configuration
```

## Notes for AI Assistants

When working on this codebase:

1. **Always use Biome for linting**, not ESLint
2. Run `pnpm lint` before committing
3. Respect the zero-warning policy
4. Follow existing patterns from Vercel AI Chatbot template
5. Port 7272 is project standard
6. Use `proxy.ts` not `middleware.ts`
