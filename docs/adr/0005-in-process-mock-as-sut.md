# ADR 0005: The mock is the system under test

- Status: accepted
- Date: 2026-10-20

## Context

The harness needs a messenger API with known rules so contract checks have an oracle. No deployed Lumen Relay exists. Pointing the suites at a third-party demo would make the portfolio depend on a service the author does not control, and it would weaken the loopback rule.

## Decision

`mock/src/app.mjs` is the system under test. It is a small Node HTTP server with seeded members, in-memory state, and a fixed error catalog. The runner starts a new process for each k6 file so suites do not share a roster or a published blob. Node tests in `mock/src/app.test.mjs` lock the same rules the k6 suites call.

## Alternatives

- Recorded HTTP fixtures with no server. Rejected. They do not exercise routing, status codes, or a restart between suites.
- A browser-level messenger clone. Rejected. The claim being demonstrated is API quality design, not a user interface.
- Docker as a required install. Rejected. Node and k6 are enough for a reviewer to run the pack.

## Consequences

The mock and the suites can drift if a rule changes in only one place. The Node tests and the k6 cases both state the interesting status codes so a drift fails `npm run check:all`. The mock is not a capacity target. Load is three seconds so the pack stays runnable.
