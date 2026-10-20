# C4 components

The mock is a route table over four in-memory areas. The runner is a guard, a line parser, and a summary writer. k6 scripts are the clients of the mock; they are a separate container and are not drawn again here.

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
C4Component
title Components of the mock and the runner
Container_Boundary(mock, "Loopback mock") {
  Component(router, "Router", "Node.js", "Matches method and path, reads JSON, returns the error catalog.")
  Component(desk, "Session desk", "Node.js", "Issues a single-use desk code and rotates bearer tokens.")
  Component(book, "Directory", "Node.js", "Mutual peers and blocks.")
  Component(shelf, "Device material", "Node.js", "Publish once, then rotate.")
  Component(cards, "Profile", "Node.js", "Cards and notification preferences.")
}
Container_Boundary(platform, "Platform runner") {
  Component(guard, "Loopback guard", "Node.js", "Allowlists 127.0.0.1 and localhost.")
  Component(writer, "Evidence writer", "Node.js", "Parses LUMEN_EVIDENCE lines into CSV.")
  Component(report, "Summary writer", "Node.js", "Renders the English run summary.")
}
Rel(router, desk, "Access routes")
Rel(router, book, "Peer routes")
Rel(router, shelf, "Material routes")
Rel(router, cards, "Card and preference routes")
Rel(guard, writer, "Only after the origin is accepted")
Rel(writer, report, "Rows in, summary out")
```

Suite sequences are in [flows.md](flows.md).
