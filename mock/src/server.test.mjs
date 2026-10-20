import assert from 'node:assert/strict';
import test from 'node:test';
import { BIND_HOST } from './app.mjs';

test('the published bind host is loopback', () => {
  assert.equal(BIND_HOST, '127.0.0.1');
});
