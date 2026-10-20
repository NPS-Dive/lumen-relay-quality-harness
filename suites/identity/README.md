# Identity suite

Proves the session desk: malformed and unknown handles, an unknown desk code, a missing token, a single-use code, refresh that retires the previous token, and close.

The load script opens sessions as Ada for three seconds with two virtual users. It records one evidence row, `ID-LOAD`, from the end-of-test summary.

## Layout

```text
suites/identity/
├── README.md
├── session.flow.ts
└── session.load.ts
```

## Workflow

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
  Suite->>Mock: POST refresh with the old token
  Mock-->>Suite: 401
  Suite->>Mock: DELETE /relay/v1/access/sessions/current
  Mock-->>Suite: 204
```

## Cases

- `ID-CODE-MALFORMED`, `ID-CODE-UNKNOWN`, `ID-SESSION-REJECTED`, `ID-CLOSE-UNAUTHENTICATED`
- `ID-OPEN-CODE`, `ID-OPEN-SESSION`, `ID-OPEN-MEMBER`
- `ID-REFRESH`, `ID-REFRESH-STALE`, `ID-CLOSE`
- `ID-LOAD`

Negative cases run before a session exists, so a broken happy path cannot hide them.
