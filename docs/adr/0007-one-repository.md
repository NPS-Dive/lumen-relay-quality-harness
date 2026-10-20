# ADR 0007: One repository

- Status: accepted
- Date: 2026-10-20

## Context

Identity, directory, device material, and profile are different areas of the fictional messenger. They could be four repositories. They also share the runner, the evidence line, the loopback rule, and the mock's member seed. A hiring review lasts about a minute and a half on the first pass: one README, then one source file. Four repositories split that story.

## Decision

This repository contains the mock, the platform, and the four suites. Each area has its own directory and README. The runner treats them as one pack and restarts the mock between scripts so they stay isolated at runtime.

## Alternatives

- Four repositories plus a fifth for the runner. Rejected. The evidence contract would be copied, and a reviewer would have to assemble the story.
- One flat directory of scripts. Rejected. The area READMEs and the C4 component split would collapse into a single list.

## Consequences

A change to the evidence line or the member seed touches every suite, which is visible in one diff. The root README is the page a reviewer should see first. The area READMEs are there when they open a single suite.
