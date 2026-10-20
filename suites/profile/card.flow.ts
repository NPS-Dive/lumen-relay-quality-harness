import { expectStatus, jsonObject, mark, openSession, origin, requestJson } from '../shared/relay.ts';

const SUITE = 'profile';
const base = origin();

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1'],
  },
};

export default function cardFlow(): void {
  expectStatus(SUITE, 'PRF-READ-UNAUTHENTICATED', requestJson('GET', `${base}/relay/v1/cards/me`), 401, 'A card requires a session.');

  const ada = openSession(base, 'ada');
  if (!ada) {
    mark(SUITE, 'PRF-SETUP', requestJson('GET', `${base}/relay/v1/ready`), false, 'Ada could not open a session.');
    return;
  }

  expectStatus(SUITE, 'PRF-PATCH-MALFORMED', requestJson('PATCH', `${base}/relay/v1/cards/me`, ada.token, { displayName: '  ' }), 400, 'An empty display name is rejected.');
  expectStatus(SUITE, 'PRF-PREF-MALFORMED', requestJson('PUT', `${base}/relay/v1/preferences`, ada.token, { mentions: 'always', quietHours: 'yes' }), 400, 'Unknown preference values are rejected.');
  const self = requestJson('GET', `${base}/relay/v1/cards/me`, ada.token);
  expectStatus(SUITE, 'PRF-READ-SELF', self, 200, 'The member can read its own card.');
  mark(SUITE, 'PRF-READ-SELF-NAME', self, jsonObject(self).displayName === 'Ada Quinn', 'The seeded display name is unchanged.');
  const patched = requestJson('PATCH', `${base}/relay/v1/cards/me`, ada.token, { displayName: 'Ada Q.', statusLine: 'Back at the desk' });
  expectStatus(SUITE, 'PRF-PATCH', patched, 200, 'The card was patched.');
  mark(SUITE, 'PRF-PATCH-NAME', patched, jsonObject(patched).displayName === 'Ada Q.', 'The display name was replaced.');
  expectStatus(SUITE, 'PRF-READ-PEER-FORBIDDEN', requestJson('GET', `${base}/relay/v1/cards/mem_bao`, ada.token), 403, 'Card hidden from a non-peer.');
  expectStatus(SUITE, 'PRF-CONNECT', requestJson('POST', `${base}/relay/v1/peers`, ada.token, { memberId: 'mem_bao' }), 201, 'The peers connected before the card read.');
  expectStatus(SUITE, 'PRF-READ-PEER', requestJson('GET', `${base}/relay/v1/cards/mem_bao`, ada.token), 200, 'A connected peer can read the card.');
  expectStatus(SUITE, 'PRF-BLOCK', requestJson('POST', `${base}/relay/v1/peers/mem_bao/block`, ada.token), 200, 'The peer was blocked.');
  expectStatus(SUITE, 'PRF-READ-BLOCKED', requestJson('GET', `${base}/relay/v1/cards/mem_bao`, ada.token), 403, 'A block hides the card.');
  const prefs = requestJson('GET', `${base}/relay/v1/preferences`, ada.token);
  expectStatus(SUITE, 'PRF-PREF-READ', prefs, 200, 'Notification preferences were read.');
  mark(SUITE, 'PRF-PREF-READ-SHAPE', prefs, jsonObject(prefs).mentions === 'immediate' && jsonObject(prefs).quietHours === false, 'Ada starts with immediate mentions.');
  const replaced = requestJson('PUT', `${base}/relay/v1/preferences`, ada.token, { mentions: 'off', quietHours: true });
  expectStatus(SUITE, 'PRF-PREF-REPLACE', replaced, 200, 'Notification preferences were replaced.');
  mark(SUITE, 'PRF-PREF-REPLACE-SHAPE', replaced, jsonObject(replaced).mentions === 'off' && jsonObject(replaced).quietHours === true, 'The replacement was stored.');
}
