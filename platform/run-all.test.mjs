import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('a non-loopback base URL fails before k6 starts', () => {
  const result = spawnSync(process.execPath, ['platform/run-all.mjs', '--base-url', 'http://203.0.113.10:8787'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /Refusing non-loopback base URL/);
  assert.doesNotMatch(`${result.stderr}\n${result.stdout}`, /\bk6\b/i);
});
