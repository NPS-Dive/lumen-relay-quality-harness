# ADR 0001: Clean-room fictional product

- Status: accepted
- Date: 2026-10-20

## Context

A public portfolio has to show how the author designs a messenger test harness. Copying or renaming an existing private tree would publish someone else's routes, hosts, and defect notes. A string replace does not create a new copyright, and a license file cannot license work the author does not own.

## Decision

Lumen Relay is an original, fictional messenger. The routes, member model, error catalog, and scenarios in this repository were written for this repository. No other test tree is imported.

## Alternatives

- Publish a renamed copy of an existing suite. Rejected. Renaming endpoints does not make a derivative original, and it can leak real hosts and defect detail.
- Describe the work only in prose, with no runnable code. Rejected. Reviewers in the EU, the US, Australia, and New Zealand open a file and try to run the project.

## Consequences

The API is smaller and different from any one employer's messenger. That is the point. A reviewer can judge the design without being shown a private system.
