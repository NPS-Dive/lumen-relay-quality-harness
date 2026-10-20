import { expectStatus, jsonObject, mark, origin, requestJson } from '../shared/relay.ts';

const SUITE = 'identity';
const base = origin();

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1'],
  },
};

export default function identityFlow(): void {
  expectStatus(SUITE, 'ID-CODE-MALFORMED', requestJson('POST', `${base}/relay/v1/access/codes`, undefined, {}), 400, 'A missing handle is rejected.');
  expectStatus(SUITE, 'ID-CODE-UNKNOWN', requestJson('POST', `${base}/relay/v1/access/codes`, undefined, { memberHandle: 'no-such-member' }), 404, 'An unknown handle is rejected.');
  expectStatus(SUITE, 'ID-SESSION-REJECTED', requestJson('POST', `${base}/relay/v1/access/sessions`, undefined, { deskCode: 'not-a-code' }), 401, 'An unknown desk code is rejected.');
  expectStatus(SUITE, 'ID-CLOSE-UNAUTHENTICATED', requestJson('DELETE', `${base}/relay/v1/access/sessions/current`), 401, 'Closing a session requires a token.');

  const code = requestJson('POST', `${base}/relay/v1/access/codes`, undefined, { memberHandle: 'ada' });
  const codeOk = expectStatus(SUITE, 'ID-OPEN-CODE', code, 201, 'A desk code was issued.');
  const issued = jsonObject(code);
  if (!codeOk || typeof issued.deskCode !== 'string') {
    return;
  }

  const opened = requestJson('POST', `${base}/relay/v1/access/sessions`, undefined, { deskCode: issued.deskCode });
  const openOk = expectStatus(SUITE, 'ID-OPEN-SESSION', opened, 201, 'Session opened.');
  const session = jsonObject(opened);
  const token = typeof session.accessToken === 'string' ? session.accessToken : '';
  mark(SUITE, 'ID-OPEN-MEMBER', opened, openOk && session.memberId === 'mem_ada', 'The session belongs to Ada.');
  if (!openOk || token === '') {
    return;
  }

  const refreshed = requestJson('POST', `${base}/relay/v1/access/sessions/refresh`, token);
  const refreshOk = expectStatus(SUITE, 'ID-REFRESH', refreshed, 200, 'The session was refreshed.');
  expectStatus(SUITE, 'ID-REFRESH-STALE', requestJson('POST', `${base}/relay/v1/access/sessions/refresh`, token), 401, 'The previous token was retired.');
  const next = jsonObject(refreshed);
  const nextToken = typeof next.accessToken === 'string' ? next.accessToken : '';
  if (!refreshOk || nextToken === '') {
    return;
  }
  expectStatus(SUITE, 'ID-CLOSE', requestJson('DELETE', `${base}/relay/v1/access/sessions/current`, nextToken), 204, 'The current session was closed.');
}
