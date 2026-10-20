# C4 context

One person runs one local system. Lumen Relay has no signup, no hosted environment, and no upstream API.

## Layout

```text
docs/architecture/
├── README.md
├── c4-context.md
├── c4-container.md
├── c4-component.md
└── flows.md
```

## How this folder is read

```mermaid
flowchart LR
  context[C4Context] --> container[C4Container]
  container --> component[C4Component]
  component --> flows[SuiteSequences]
```

```mermaid
C4Context
title System context for the Lumen Relay quality harness
Person(reviewer, "Hiring reviewer", "Clones the repository and runs it on a laptop.")
System(harness, "Lumen Relay quality harness", "Contract, negative, and small load checks for a fictional messenger that exists only on loopback.")
Rel(reviewer, harness, "Runs npm run check")
```

The next level is [c4-container.md](c4-container.md).
