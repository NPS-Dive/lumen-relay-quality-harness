import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEvidence, toCsv } from './evidence.mjs';

test('evidence lines become a quoted CSV', () => {
  const text = [
    'progress noise',
    'LUMEN_EVIDENCE {"runId":"run-1","suite":"identity","caseId":"ID-1","outcome":"pass","status":201,"latencyMs":4.2,"detail":"Opened, \\"ada\\""}',
    'LUMEN_EVIDENCE {"suite":"","caseId":""}',
  ].join('\n');
  const rows = parseEvidence(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].latencyMs, 4);
  const csv = toCsv(rows);
  assert.match(csv, /^runId,suite,caseId,outcome,status,latencyMs,detail/);
  assert.match(csv, /"Opened, ""ada"""/);
});

test('k6 console lines are evidence too', () => {
  const line = String.raw`time="2026-10-20T21:45:17+03:30" level=info msg="LUMEN_EVIDENCE {\"runId\":\"run-1\",\"suite\":\"identity\",\"caseId\":\"ID-OPEN-SESSION\",\"outcome\":\"pass\",\"status\":201,\"latencyMs\":1,\"detail\":\"Session opened.\"}" source=console`;
  const rows = parseEvidence(line);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].caseId, 'ID-OPEN-SESSION');
  assert.equal(rows[0].detail, 'Session opened.');
});
