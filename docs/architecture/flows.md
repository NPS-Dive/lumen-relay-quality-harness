# Suite flows

Each suite is one iteration against a fresh mock, except the load scripts, which run for three seconds after the contract script. The platform restarts the mock between files.

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
graph LR
  context[C4Context] --> container[C4Container]
  container --> component[C4Component]
  component --> flows[SuiteSequences]
```

## Identity

```mermaid
sequenceDiagram
  participant Suite as IdentitySuite
  participant Mock as LoopbackMock
  Suite->>Mock: POST /relay/v1/access/codes
  Mock-->>Suite: 201 desk code
  Suite->>Mock: POST /relay/v1/access/sessions
  Mock-->>Suite: 201 bearer token
  Suite->>Mock: POST /relay/v1/access/sessions/refresh
  Mock-->>Suite: 200 new token
  Suite->>Mock: POST refresh with the retired token
  Mock-->>Suite: 401
  Suite->>Mock: DELETE /relay/v1/access/sessions/current
  Mock-->>Suite: 204
```

## Directory

```mermaid
sequenceDiagram
  participant Ada as AdaSession
  participant Mock as LoopbackMock
  participant Bao as BaoSession
  Ada->>Mock: GET /relay/v1/peers
  Mock-->>Ada: 200 empty roster
  Ada->>Mock: POST /relay/v1/peers
  Mock-->>Ada: 201 connected to Bao
  Ada->>Mock: POST /relay/v1/peers/mem_bao/block
  Mock-->>Ada: 200 blocked
  Bao->>Mock: POST /relay/v1/peers
  Mock-->>Bao: 409 blocked
```

## Device material

```mermaid
sequenceDiagram
  participant Ada as AdaSession
  participant Mock as LoopbackMock
  participant Bao as BaoSession
  Ada->>Mock: PUT /relay/v1/devices/current/material
  Mock-->>Ada: 200 generation 1
  Bao->>Mock: GET /relay/v1/devices/mem_ada/material
  Mock-->>Bao: 403 not a peer
  Ada->>Mock: POST /relay/v1/peers
  Bao->>Mock: GET /relay/v1/devices/mem_ada/material
  Mock-->>Bao: 200
  Ada->>Mock: POST /relay/v1/devices/current/material/rotate
  Mock-->>Ada: 200 generation 2
```

## Profile

```mermaid
sequenceDiagram
  participant Ada as AdaSession
  participant Mock as LoopbackMock
  Ada->>Mock: GET /relay/v1/cards/me
  Mock-->>Ada: 200 seeded card
  Ada->>Mock: PATCH /relay/v1/cards/me
  Mock-->>Ada: 200 patched card
  Ada->>Mock: GET /relay/v1/cards/mem_bao
  Mock-->>Ada: 403 not a peer
  Ada->>Mock: POST /relay/v1/peers
  Ada->>Mock: GET /relay/v1/cards/mem_bao
  Mock-->>Ada: 200 Bao card
  Ada->>Mock: PUT /relay/v1/preferences
  Mock-->>Ada: 200 replaced preferences
```
