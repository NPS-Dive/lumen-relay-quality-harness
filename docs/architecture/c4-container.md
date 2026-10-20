# C4 containers

The harness is four containers inside one repository. The evidence files are a data store with the lifetime of one run. They are not source.

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
C4Container
title Containers in the Lumen Relay quality harness
Person(reviewer, "Hiring reviewer", "Evaluates the author by reading and running the harness.")
System_Boundary(repo, "lumen-relay-quality-harness") {
  Container(runner, "Platform runner", "Node.js", "Refuses non-loopback URLs, starts the mock, invokes k6, writes the summary.")
  Container(mock, "Loopback mock", "Node.js HTTP", "In-memory /relay/v1 API bound to 127.0.0.1.")
  Container(suites, "k6 suites", "TypeScript", "Identity, directory, device material, and profile.")
  ContainerDb(evidence, "Evidence pack", "CSV and Markdown", "results/run-id for a single invocation.")
}
Rel(reviewer, runner, "npm run check")
Rel(runner, mock, "Starts and polls /relay/v1/ready")
Rel(runner, suites, "k6 run, one file at a time")
Rel(suites, mock, "HTTP on loopback")
Rel(runner, evidence, "Writes evidence.csv and summary.md")
```

Components inside the mock and the runner are in [c4-component.md](c4-component.md).
