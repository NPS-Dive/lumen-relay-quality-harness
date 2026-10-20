# ADR 0004: One evidence contract

- Status: accepted
- Date: 2026-10-20

## Context

Four suites that each invent a report format force a reviewer to learn four layouts. They also make a cross-suite failure list a manual merge.

## Decision

Every case emits one `LUMEN_EVIDENCE` JSON line with seven fields: `runId`, `suite`, `caseId`, `outcome`, `status`, `latencyMs`, and `detail`. The runner writes one CSV and one English summary for the whole invocation. Load scripts emit a single row from `handleSummary` rather than one row per iteration. Tokens and desk codes are not placed in `detail`.

## Alternatives

- A wide, tool-specific column layout copied from another harness. Rejected. The columns should match the questions this repository asks, and they should stay stable.
- k6's end summary only, with no case ids. Rejected. A threshold failure does not name the contract case that broke.
- Commit every live result. Rejected. Results are local and gitignored. A fixture sample shows the shape.

## Consequences

A new suite joins the pack by emitting the same line. The summary stays readable only while case ids stay specific. A load row reports threshold health, not every request.
