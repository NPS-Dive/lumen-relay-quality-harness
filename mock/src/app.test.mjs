import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { BIND_HOST, createHarness } from './app.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function withServer(fn) {
  const { server, state } = createHarness();
  await new Promise((resolve) => server.listen(0, BIND_HOST, resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await fn(base, state);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function send(base, method, pathname, { token, body, contentType } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = contentType || 'application/json';
  }
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function login(base, handle) {
  const code = await send(base, 'POST', '/relay/v1/access/codes', { body: { memberHandle: handle } });
  assert.equal(code.status, 201);
  const session = await send(base, 'POST', '/relay/v1/access/sessions', { body: { deskCode: code.body.deskCode } });
  assert.equal(session.status, 201);
  return { token: session.body.accessToken, memberId: session.body.memberId };
}

test('ready answers on the loopback mock', async () => {
  await withServer(async (base) => {
    const ready = await send(base, 'GET', '/relay/v1/ready');
    assert.equal(ready.status, 200);
    assert.equal(ready.body.service, 'lumen-relay-mock');
  });
});

test('desk codes are single use and refresh retires the previous token', async () => {
  await withServer(async (base) => {
    const unknown = await send(base, 'POST', '/relay/v1/access/codes', { body: { memberHandle: 'no-such-member' } });
    assert.equal(unknown.status, 404);
    const malformed = await send(base, 'POST', '/relay/v1/access/codes', { body: {} });
    assert.equal(malformed.status, 400);
    const rejected = await send(base, 'POST', '/relay/v1/access/sessions', { body: { deskCode: 'not-a-code' } });
    assert.equal(rejected.status, 401);

    const firstCode = await send(base, 'POST', '/relay/v1/access/codes', { body: { memberHandle: 'ada' } });
    const opened = await send(base, 'POST', '/relay/v1/access/sessions', { body: { deskCode: firstCode.body.deskCode } });
    const reused = await send(base, 'POST', '/relay/v1/access/sessions', { body: { deskCode: firstCode.body.deskCode } });
    assert.equal(reused.status, 401);

    const refreshed = await send(base, 'POST', '/relay/v1/access/sessions/refresh', { token: opened.body.accessToken });
    assert.equal(refreshed.status, 200);
    assert.notEqual(refreshed.body.accessToken, opened.body.accessToken);
    const stale = await send(base, 'POST', '/relay/v1/access/sessions/refresh', { token: opened.body.accessToken });
    assert.equal(stale.status, 401);
    const closed = await send(base, 'DELETE', '/relay/v1/access/sessions/current', { token: refreshed.body.accessToken });
    assert.equal(closed.status, 204);
  });
});

test('an expired desk code is rejected', async () => {
  await withServer(async (base, state) => {
    const issued = await send(base, 'POST', '/relay/v1/access/codes', { body: { memberHandle: 'ada' } });
    state.codes.get(issued.body.deskCode).expiresAt = Date.now() - 1;
    const session = await send(base, 'POST', '/relay/v1/access/sessions', { body: { deskCode: issued.body.deskCode } });
    assert.equal(session.status, 401);
    assert.equal(session.body.error, 'rejected_code');
  });
});

test('directory connections are mutual until a block', async () => {
  await withServer(async (base) => {
    const ada = await login(base, 'ada');
    const empty = await send(base, 'GET', '/relay/v1/peers', { token: ada.token });
    assert.deepEqual(empty.body.peers, []);
    const self = await send(base, 'POST', '/relay/v1/peers', { token: ada.token, body: { memberId: 'mem_ada' } });
    assert.equal(self.status, 400);
    const missing = await send(base, 'POST', '/relay/v1/peers', { token: ada.token, body: { memberId: 'mem_nobody' } });
    assert.equal(missing.status, 404);
    const added = await send(base, 'POST', '/relay/v1/peers', { token: ada.token, body: { memberId: 'mem_bao' } });
    assert.equal(added.status, 201);
    const again = await send(base, 'POST', '/relay/v1/peers', { token: ada.token, body: { memberId: 'mem_bao' } });
    assert.equal(again.status, 409);
    const bao = await login(base, 'bao');
    const baoList = await send(base, 'GET', '/relay/v1/peers', { token: bao.token });
    assert.equal(baoList.body.peers[0].memberId, 'mem_ada');
    const blocked = await send(base, 'POST', '/relay/v1/peers/mem_bao/block', { token: ada.token });
    assert.equal(blocked.status, 200);
    const after = await send(base, 'GET', '/relay/v1/peers', { token: ada.token });
    assert.deepEqual(after.body.peers, []);
    const reconnect = await send(base, 'POST', '/relay/v1/peers', { token: bao.token, body: { memberId: 'mem_ada' } });
    assert.equal(reconnect.status, 409);
    assert.equal(reconnect.body.error, 'blocked_member');
  });
});

test('device material stays private until a connection exists', async () => {
  await withServer(async (base) => {
    const ada = await login(base, 'ada');
    const early = await send(base, 'POST', '/relay/v1/devices/current/material/rotate', {
      token: ada.token,
      body: { publicMaterial: 'desk-material-ada-0002' },
    });
    assert.equal(early.status, 409);
    const malformed = await send(base, 'PUT', '/relay/v1/devices/current/material', {
      token: ada.token,
      body: { publicMaterial: 'too-short' },
    });
    assert.equal(malformed.status, 400);
    const published = await send(base, 'PUT', '/relay/v1/devices/current/material', {
      token: ada.token,
      body: { publicMaterial: 'desk-material-ada-0001' },
    });
    assert.equal(published.body.generation, 1);
    const hidden = await send(base, 'GET', '/relay/v1/devices/mem_ada/material', { token: (await login(base, 'bao')).token });
    assert.equal(hidden.status, 403);
    await send(base, 'POST', '/relay/v1/peers', { token: ada.token, body: { memberId: 'mem_bao' } });
    const bao = await login(base, 'bao');
    const visible = await send(base, 'GET', '/relay/v1/devices/mem_ada/material', { token: bao.token });
    assert.equal(visible.status, 200);
    const rotated = await send(base, 'POST', '/relay/v1/devices/current/material/rotate', {
      token: ada.token,
      body: { publicMaterial: 'desk-material-ada-0002' },
    });
    assert.equal(rotated.body.generation, 2);
  });
});

test('cards and preferences follow the directory', async () => {
  await withServer(async (base) => {
    const ada = await login(base, 'ada');
    const forbidden = await send(base, 'GET', '/relay/v1/cards/mem_bao', { token: ada.token });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.error, 'not_a_peer');
    const patched = await send(base, 'PATCH', '/relay/v1/cards/me', {
      token: ada.token,
      body: { displayName: 'Ada Q.', statusLine: '' },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.displayName, 'Ada Q.');
    const badName = await send(base, 'PATCH', '/relay/v1/cards/me', { token: ada.token, body: { displayName: '  ' } });
    assert.equal(badName.status, 400);
    await send(base, 'POST', '/relay/v1/peers', { token: ada.token, body: { memberId: 'mem_bao' } });
    const bao = await login(base, 'bao');
    const card = await send(base, 'GET', '/relay/v1/cards/mem_ada', { token: bao.token });
    assert.equal(card.body.displayName, 'Ada Q.');
    const badPrefs = await send(base, 'PUT', '/relay/v1/preferences', {
      token: ada.token,
      body: { mentions: 'always', quietHours: 'yes' },
    });
    assert.equal(badPrefs.status, 400);
    const prefs = await send(base, 'PUT', '/relay/v1/preferences', {
      token: ada.token,
      body: { mentions: 'off', quietHours: true },
    });
    assert.deepEqual(prefs.body, { mentions: 'off', quietHours: true });
    const text = await send(base, 'POST', '/relay/v1/access/codes', { body: 'ada', contentType: 'text/plain' });
    assert.equal(text.status, 415);
    const missing = await send(base, 'GET', '/relay/v1/not-a-route');
    assert.equal(missing.status, 404);
  });
});

test('the entrypoint binds loopback even when HOST asks for every interface', async () => {
  const child = spawn(process.execPath, ['mock/src/server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: '0', HOST: '0.0.0.0' },
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    output += String(chunk);
  });
  const line = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`mock did not announce a bind: ${output}`)), 5000);
    child.stdout.on('data', () => {
      const match = /listening on http:\/\/127\.0\.0\.1:(\d+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(match);
      }
    });
    child.once('exit', () => {
      clearTimeout(timer);
      reject(new Error(`mock exited early: ${output}`));
    });
  });
  try {
    const response = await fetch(`http://127.0.0.1:${line[1]}/relay/v1/ready`);
    assert.equal(response.status, 200);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
  }
});
