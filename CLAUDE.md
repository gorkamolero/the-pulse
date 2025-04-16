# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- **Development**: `pnpm dev` - Starts Next.js dev server with Turbo
- **Build**: `pnpm build` - Runs DB migrations and builds Next.js app
- **Linting**: `pnpm lint` - Runs Next.js and Biome linting
- **Format**: `pnpm format` - Formats code using Biome
- **Database**: 
  - `pnpm db:migrate` - Run database migrations
  - `pnpm db:studio` - Open Drizzle Studio

## Code Style
- **Formatting**: 2-space indent, 80 char line width, single quotes (double in JSX)
- **Imports**: Use absolute imports with `@/` path alias
- **Components**: PascalCase for components, camelCase for functions/variables
- **Types**: TypeScript with strict mode, interface-based type definitions
- **Error Handling**: Use try/catch for async operations
- **React**: Fragments with `<>` syntax, server actions with "use server" directive
- **Styling**: Tailwind with className utility wrappers
- **Logging**: Always prefix console logs with descriptive tags (e.g., `console.log('[ImageGenerator]', data)`)
- **Avoid**: Any types unless necessary, nested ternaries, unused imports