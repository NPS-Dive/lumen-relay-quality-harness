# ADR 0003: Native k6 TypeScript

- Status: accepted
- Date: 2026-10-20

## Context

k6 has executed `.ts` files directly since 0.57. It transpiles them with its built-in esbuild pipeline and strips types. It does not type-check. Older templates bundled tests with Webpack or Babel before that support existed. Those templates are now archived.

## Decision

Suites are TypeScript files run by `k6 run script.ts`. `tsc --noEmit` is the type check, using `@types/k6`. There is no Webpack, Babel, or bundle step in this repository.

## Alternatives

- Webpack or Babel bundle into `dist/`, then run the bundle. Rejected. It adds a moving part that current k6 does not need, and it hides the file a reviewer opens from the file k6 runs.
- Plain JavaScript only. Rejected. The suites share typed helpers, and the type check is part of `npm run check:all`.

## Consequences

A reviewer needs k6 0.57 or newer. The type check and the k6 run can disagree if a type is wrong but erasable; `tsc` is what catches that. Native TypeScript support is partial: path aliases and a full Node module graph are not assumed. Shared code is a relative import inside `suites/`.
