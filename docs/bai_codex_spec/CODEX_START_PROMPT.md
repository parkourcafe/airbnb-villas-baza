# Prompt to start Codex

Paste this into Codex from the repository root:

```text
Read AGENTS.md and all numbered BAI specification files in full.

We are starting a new repository for Bali Accommodation Intelligence.
Implement Milestone 0 only from 05_CODEX_IMPLEMENTATION_PLAN.md.

Rules:
- Do not implement Milestone 1 or later.
- Do not build any live third-party collector.
- Use Node.js 24 LTS, pnpm, Turborepo, Next.js App Router and TypeScript strict mode.
- Check the target directory before scaffolding.
- Use non-interactive CLI flags.
- Pin dependencies through the lockfile.
- Create the monorepo structure exactly as specified unless a concrete technical conflict requires a documented deviation.
- Add meaningful smoke tests.
- Run lint, typecheck, unit tests and build.
- Fix failures before reporting.
- Create docs/IMPLEMENTATION_STATUS.md and the required ADR placeholders.

At completion, return:
1. implementation summary;
2. files changed;
3. commands run;
4. exact test results;
5. deviations from spec and reasons;
6. security observations;
7. unresolved decisions;
8. confirmation that no later milestone was started.
```
