# ADR 0002: Loopback-only execution

- Status: accepted
- Date: 2026-10-20

## Context

A quality harness that accepts an arbitrary base URL will eventually be pointed at a shared or production host, especially if a flag exists to override the guard. This portfolio has no production to test, and it should be incapable of calling one.

## Decision

The runner allowlists `http://127.0.0.1` and `http://localhost` with no user info, path, query, or fragment. A refused URL exits before k6 is spawned. Each k6 script repeats the same allowlist so a direct `k6 run` cannot bypass the runner. There is no override flag. The mock entrypoint binds `127.0.0.1` and ignores `HOST`.

## Alternatives

- A production denylist plus an override variable. Rejected. A denylist misses new hosts, and an override is how a load run escapes the lab.
- Trust the reviewer to pass the right URL. Rejected. The default path should be the safe path.

## Consequences

The harness cannot be aimed at a deployed environment without changing the code. That is acceptable for a portfolio. A later record would be required before any non-loopback target existed.
