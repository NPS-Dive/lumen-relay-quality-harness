/**
 * In-memory HTTP API for the fictional Lumen Relay messenger.
 * The process entrypoint binds 127.0.0.1. This module does not listen by itself
 * and does not call any other host.
 */
import http from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';

export const BIND_HOST = '127.0.0.1';

const CODE_TTL_MS = 120_000;
const SESSION_TTL_MS = 3_600_000;
const MAX_BODY_BYTES = 16 * 1024;
const MATERIAL_PATTERN = /^[A-Za-z0-9_-]{16,512}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MENTIONS = new Set(['immediate', 'daily', 'off']);

const SEED_MEMBERS = [
  { memberId: 'mem_ada', handle: 'ada', displayName: 'Ada Quinn', statusLine: 'At the desk' },
  { memberId: 'mem_bao', handle: 'bao', displayName: 'Bao Singh', statusLine: 'In another room' },
];

export class HttpError extends Error {
  constructor(status, error, detail) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
    this.error = error;
    this.detail = detail;
  }
}

function createState() {
  const members = new Map();
  const handles = new Map();
  const preferences = new Map();
  const peers = new Map();
  const blocks = new Map();
  for (const member of SEED_MEMBERS) {
    members.set(member.memberId, { ...member });
    handles.set(member.handle, member.memberId);
    preferences.set(member.memberId, { mentions: member.memberId === 'mem_bao' ? 'daily' : 'immediate', quietHours: member.memberId === 'mem_bao' });
    peers.set(member.memberId, new Set());
    blocks.set(member.memberId, new Set());
  }
  return {
    members,
    handles,
    preferences,
    peers,
    blocks,
    codes: new Map(),
    sessions: new Map(),
    material: new Map(),
  };
}

function deskCode() {
  let value = '';
  for (let index = 0; index < 8; index += 1) {
    value += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return value;
}

function newToken() {
  return randomBytes(32).toString('hex');
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) {
        return;
      }
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        reject(new HttpError(413, 'payload_too_large', 'The body exceeds 16 KiB.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    req.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

function isJsonContent(req) {
  const value = String(req.headers['content-type'] || '');
  return /^application\/json(?:\s*;|$)/i.test(value);
}

async function readJson(req) {
  if (!isJsonContent(req)) {
    throw new HttpError(415, 'unsupported_media_type', 'Send application/json.');
  }
  const raw = await readBody(req);
  if (raw.length === 0) {
    throw new HttpError(400, 'malformed_json', 'The JSON body is empty.');
  }
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpError(400, 'malformed_body', 'The JSON body must be an object.');
    }
    return parsed;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(400, 'malformed_json', 'The body is not valid JSON.');
  }
}

function bearer(req, state) {
  const header = String(req.headers.authorization || '');
  const match = /^Bearer\s+(\S+)$/.exec(header);
  if (!match) {
    return null;
  }
  const session = state.sessions.get(match[1]);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    state.sessions.delete(match[1]);
    return null;
  }
  return { token: match[1], memberId: session.memberId };
}

function requireMember(req, state) {
  const session = bearer(req, state);
  if (!session) {
    throw new HttpError(401, 'unauthenticated', 'A current session token is required.');
  }
  return session;
}

function memberOrThrow(state, memberId) {
  const member = state.members.get(memberId);
  if (!member) {
    throw new HttpError(404, 'unknown_member', 'That member does not exist.');
  }
  return member;
}

function blockedEitherWay(state, leftId, rightId) {
  return state.blocks.get(leftId).has(rightId) || state.blocks.get(rightId).has(leftId);
}

function cardOf(member) {
  return {
    memberId: member.memberId,
    handle: member.handle,
    displayName: member.displayName,
    statusLine: member.statusLine,
  };
}

function assertText(value, minimum, maximum, error, detail) {
  if (typeof value !== 'string') {
    throw new HttpError(400, error, detail);
  }
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum) {
    throw new HttpError(400, error, detail);
  }
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    throw new HttpError(400, error, detail);
  }
  return trimmed;
}

const ROUTES = [
  { method: 'GET', path: '/relay/v1/ready', handler: getReady },
  { method: 'POST', path: '/relay/v1/access/codes', handler: postCode },
  { method: 'POST', path: '/relay/v1/access/sessions', handler: postSession },
  { method: 'POST', path: '/relay/v1/access/sessions/refresh', handler: postRefresh },
  { method: 'DELETE', path: '/relay/v1/access/sessions/current', handler: deleteSession },
  { method: 'GET', path: '/relay/v1/peers', handler: getPeers },
  { method: 'POST', path: '/relay/v1/peers', handler: postPeer },
  { method: 'POST', path: /^\/relay\/v1\/peers\/(mem_[a-z0-9_]+)\/block$/, handler: postBlock },
  { method: 'PUT', path: '/relay/v1/devices/current/material', handler: putMaterial },
  { method: 'POST', path: '/relay/v1/devices/current/material/rotate', handler: postRotate },
  { method: 'GET', path: /^\/relay\/v1\/devices\/(mem_[a-z0-9_]+)\/material$/, handler: getMaterial },
  { method: 'GET', path: '/relay/v1/cards/me', handler: getMyCard },
  { method: 'PATCH', path: '/relay/v1/cards/me', handler: patchMyCard },
  { method: 'GET', path: /^\/relay\/v1\/cards\/(mem_[a-z0-9_]+)$/, handler: getCard },
  { method: 'GET', path: '/relay/v1/preferences', handler: getPreferences },
  { method: 'PUT', path: '/relay/v1/preferences', handler: putPreferences },
];

function pathMatches(route, pathname) {
  if (typeof route.path === 'string') {
    return route.path === pathname ? {} : null;
  }
  const match = route.path.exec(pathname);
  return match ? { id: match[1] } : null;
}

async function route(req, state) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const matches = [];
  for (const candidate of ROUTES) {
    const params = pathMatches(candidate, url.pathname);
    if (params) {
      matches.push({ candidate, params });
    }
  }
  if (matches.length === 0) {
    throw new HttpError(404, 'unknown_route', 'That route is not part of Lumen Relay.');
  }
  const selected = matches.find((item) => item.candidate.method === req.method);
  if (!selected) {
    throw new HttpError(405, 'method_not_allowed', 'That method is not allowed on this route.');
  }
  return selected.candidate.handler(req, state, selected.params);
}

function getReady() {
  return { status: 200, body: { status: 'ready', service: 'lumen-relay-mock' } };
}

async function postCode(req, state) {
  const body = await readJson(req);
  if (typeof body.memberHandle !== 'string' || body.memberHandle.trim() === '') {
    throw new HttpError(400, 'malformed_body', 'memberHandle is required.');
  }
  const memberId = state.handles.get(body.memberHandle.trim());
  if (!memberId) {
    throw new HttpError(404, 'unknown_member', 'That member handle does not exist.');
  }
  let code = deskCode();
  while (state.codes.has(code)) {
    code = deskCode();
  }
  state.codes.set(code, { memberId, expiresAt: Date.now() + CODE_TTL_MS });
  return { status: 201, body: { deskCode: code, expiresInSeconds: CODE_TTL_MS / 1000 } };
}

async function postSession(req, state) {
  const body = await readJson(req);
  if (typeof body.deskCode !== 'string' || body.deskCode.trim() === '') {
    throw new HttpError(400, 'malformed_body', 'deskCode is required.');
  }
  const issued = state.codes.get(body.deskCode);
  if (!issued || issued.expiresAt <= Date.now()) {
    state.codes.delete(body.deskCode);
    throw new HttpError(401, 'rejected_code', 'The desk code is unknown or expired.');
  }
  state.codes.delete(body.deskCode);
  const accessToken = newToken();
  state.sessions.set(accessToken, { memberId: issued.memberId, expiresAt: Date.now() + SESSION_TTL_MS });
  return {
    status: 201,
    body: { accessToken, memberId: issued.memberId, expiresInSeconds: SESSION_TTL_MS / 1000 },
  };
}

function postRefresh(req, state) {
  const session = requireMember(req, state);
  state.sessions.delete(session.token);
  const accessToken = newToken();
  state.sessions.set(accessToken, { memberId: session.memberId, expiresAt: Date.now() + SESSION_TTL_MS });
  return {
    status: 200,
    body: { accessToken, memberId: session.memberId, expiresInSeconds: SESSION_TTL_MS / 1000 },
  };
}

function deleteSession(req, state) {
  const session = requireMember(req, state);
  state.sessions.delete(session.token);
  return { status: 204 };
}

function getPeers(req, state) {
  const session = requireMember(req, state);
  const peers = [...state.peers.get(session.memberId)]
    .map((memberId) => state.members.get(memberId))
    .filter(Boolean)
    .sort((left, right) => left.memberId.localeCompare(right.memberId))
    .map((member) => ({ memberId: member.memberId, displayName: member.displayName, state: 'connected' }));
  return { status: 200, body: { peers } };
}

async function postPeer(req, state) {
  const session = requireMember(req, state);
  const body = await readJson(req);
  if (typeof body.memberId !== 'string') {
    throw new HttpError(400, 'malformed_body', 'memberId is required.');
  }
  if (body.memberId === session.memberId) {
    throw new HttpError(400, 'malformed_body', 'A member cannot connect to itself.');
  }
  memberOrThrow(state, body.memberId);
  if (blockedEitherWay(state, session.memberId, body.memberId)) {
    throw new HttpError(409, 'blocked_member', 'A block prevents a new connection.');
  }
  if (state.peers.get(session.memberId).has(body.memberId)) {
    throw new HttpError(409, 'already_connected', 'Those members are already connected.');
  }
  state.peers.get(session.memberId).add(body.memberId);
  state.peers.get(body.memberId).add(session.memberId);
  return { status: 201, body: { memberId: body.memberId, state: 'connected' } };
}

function postBlock(req, state, params) {
  const session = requireMember(req, state);
  if (params.id === session.memberId) {
    throw new HttpError(400, 'malformed_body', 'A member cannot block itself.');
  }
  memberOrThrow(state, params.id);
  state.peers.get(session.memberId).delete(params.id);
  state.peers.get(params.id).delete(session.memberId);
  state.blocks.get(session.memberId).add(params.id);
  return { status: 200, body: { memberId: params.id, state: 'blocked' } };
}

function readMaterialValue(body) {
  if (typeof body.publicMaterial !== 'string' || !MATERIAL_PATTERN.test(body.publicMaterial)) {
    throw new HttpError(400, 'invalid_material', 'publicMaterial must be 16 to 512 URL-safe characters.');
  }
  return body.publicMaterial;
}

async function putMaterial(req, state) {
  const session = requireMember(req, state);
  const body = await readJson(req);
  const publicMaterial = readMaterialValue(body);
  const current = state.material.get(session.memberId);
  if (current && current.publicMaterial !== publicMaterial) {
    throw new HttpError(409, 'material_exists', 'Rotate the device to replace published material.');
  }
  if (!current) {
    state.material.set(session.memberId, { publicMaterial, generation: 1 });
  }
  const stored = state.material.get(session.memberId);
  return { status: 200, body: { memberId: session.memberId, generation: stored.generation, publicMaterial: stored.publicMaterial } };
}

async function postRotate(req, state) {
  const session = requireMember(req, state);
  const body = await readJson(req);
  const publicMaterial = readMaterialValue(body);
  const current = state.material.get(session.memberId);
  if (!current) {
    throw new HttpError(409, 'material_missing', 'Publish material before rotating it.');
  }
  if (current.publicMaterial === publicMaterial) {
    throw new HttpError(400, 'invalid_material', 'Rotated material must differ from the current value.');
  }
  const next = { publicMaterial, generation: current.generation + 1 };
  state.material.set(session.memberId, next);
  return { status: 200, body: { memberId: session.memberId, generation: next.generation, publicMaterial } };
}

function assertVisiblePeer(state, actorId, otherId) {
  if (otherId === actorId) {
    return;
  }
  if (blockedEitherWay(state, actorId, otherId)) {
    throw new HttpError(403, 'blocked_member', 'A block hides that member.');
  }
  if (!state.peers.get(actorId).has(otherId)) {
    throw new HttpError(403, 'not_a_peer', 'That member is visible to connected peers.');
  }
}

function getMaterial(req, state, params) {
  const session = requireMember(req, state);
  memberOrThrow(state, params.id);
  assertVisiblePeer(state, session.memberId, params.id);
  const stored = state.material.get(params.id);
  if (!stored) {
    throw new HttpError(404, 'material_missing', 'That member has not published device material.');
  }
  return { status: 200, body: { memberId: params.id, generation: stored.generation, publicMaterial: stored.publicMaterial } };
}

function getMyCard(req, state) {
  const session = requireMember(req, state);
  return { status: 200, body: cardOf(state.members.get(session.memberId)) };
}

async function patchMyCard(req, state) {
  const session = requireMember(req, state);
  const body = await readJson(req);
  const hasName = Object.prototype.hasOwnProperty.call(body, 'displayName');
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'statusLine');
  if (!hasName && !hasStatus) {
    throw new HttpError(400, 'invalid_card', 'Provide displayName, statusLine, or both.');
  }
  const member = state.members.get(session.memberId);
  if (hasName) {
    member.displayName = assertText(body.displayName, 1, 80, 'invalid_card', 'displayName must be 1 to 80 characters.');
  }
  if (hasStatus) {
    member.statusLine = assertText(body.statusLine, 0, 140, 'invalid_card', 'statusLine must be at most 140 characters.');
  }
  return { status: 200, body: cardOf(member) };
}

function getCard(req, state, params) {
  const session = requireMember(req, state);
  const member = memberOrThrow(state, params.id);
  assertVisiblePeer(state, session.memberId, params.id);
  return { status: 200, body: cardOf(member) };
}

function getPreferences(req, state) {
  const session = requireMember(req, state);
  return { status: 200, body: { ...state.preferences.get(session.memberId) } };
}

async function putPreferences(req, state) {
  const session = requireMember(req, state);
  const body = await readJson(req);
  if (!MENTIONS.has(body.mentions) || typeof body.quietHours !== 'boolean') {
    throw new HttpError(400, 'invalid_preferences', 'mentions must be immediate, daily, or off, and quietHours must be a boolean.');
  }
  const stored = { mentions: body.mentions, quietHours: body.quietHours };
  state.preferences.set(session.memberId, stored);
  return { status: 200, body: { ...stored } };
}

async function dispatch(req, res, state) {
  try {
    const result = await route(req, state);
    send(res, result.status, result.body);
  } catch (error) {
    if (error instanceof HttpError) {
      send(res, error.status, { error: error.error, detail: error.detail });
      return;
    }
    console.error(error);
    if (!res.headersSent) {
      send(res, 500, { error: 'internal', detail: 'The mock failed before it could answer.' });
    }
  }
}

export function createHarness() {
  const state = createState();
  const server = http.createServer((req, res) => {
    dispatch(req, res, state);
  });
  return { server, state };
}

export function createServer() {
  return createHarness().server;
}
