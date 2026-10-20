# Architecture

C4 diagrams for the harness, plus one sequence flow for each suite. The system under test is the loopback mock. There is no external messenger.

## Layout

```text
docs/architecture/
├── README.md
├── c4-context.md
├── c4-container.md
├── c4-component.md
└── flows.md
```

## Workflow

```mermaid
flowchart LR
  context[C4Context] --> container[C4Container]
  container --> component[C4Component]
  component --> flows[SuiteSequences]
```

Read the context first. It is intentionally small: one person and one system. The container diagram is where the runner, the mock, k6, and the evidence files appear.
