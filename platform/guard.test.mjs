import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLoopback, DEFAULT_BASE_URL } from './guard.mjs';

test('loopback http origins are accepted', () => {
  assert.equal(assertLoopback(DEFAULT_BASE_URL), 'http://127.0.0.1:8787');
  assert.equal(assertLoopback('http://localhost:8787/'), 'http://localhost:8787');
});

test('public, secure, and pathed URLs are refused', () => {
  for (const value of ['http://203.0.113.10:8787', 'https://127.0.0.1:8787', 'http://127.0.0.1:8787/relay', 'not a url', 'http://user:pass@127.0.0.1:8787']) {
    assert.throws(() => assertLoopback(value), /Refusing/);
  }
});
