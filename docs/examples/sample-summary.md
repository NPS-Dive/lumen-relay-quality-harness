# Run summary

Run `20261020T180000Z-example` against `http://127.0.0.1:8787`.

- Passed: 3
- Failed: 0

## Cases

- identity `ID-OPEN-SESSION`: pass, HTTP 201, 4 ms. Session opened.
- directory `DIR-ADD`: pass, HTTP 201, 3 ms. Peer connected.
- profile `PRF-READ-PEER-FORBIDDEN`: pass, HTTP 403, 2 ms. Card hidden from a non-peer.
