import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderSummary } from './report.mjs';

const samplePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/examples/sample-summary.md');

export const SAMPLE_RUN = {
  runId: '20261020T180000Z-example',
  baseUrl: 'http://127.0.0.1:8787',
  rows: [
    { runId: '20261020T180000Z-example', suite: 'identity', caseId: 'ID-OPEN-SESSION', outcome: 'pass', status: 201, latencyMs: 4, detail: 'Session opened.' },
    { runId: '20261020T180000Z-example', suite: 'directory', caseId: 'DIR-ADD', outcome: 'pass', status: 201, latencyMs: 3, detail: 'Peer connected.' },
    { runId: '20261020T180000Z-example', suite: 'profile', caseId: 'PRF-READ-PEER-FORBIDDEN', outcome: 'pass', status: 403, latencyMs: 2, detail: 'Card hidden from a non-peer.' },
  ],
};

test('the checked-in sample matches the summary renderer', () => {
  const rendered = renderSummary(SAMPLE_RUN);
  const sample = readFileSync(samplePath, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(sample, rendered);
});
