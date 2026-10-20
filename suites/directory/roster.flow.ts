import { expectStatus, jsonObject, mark, openSession, origin, requestJson } from '../shared/relay.ts';

const SUITE = 'directory';
const base = origin();

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1'],
  },
};

function peerIds(response: ReturnType<typeof requestJson>): string[] {
  const body = jsonObject(response);
  const peers = body.peers;
  if (!Array.isArray(peers)) {
    return [];
  }
  return peers
    .map((peer) => (peer && typeof peer === 'object' && 'memberId' in peer ? String(peer.memberId) : ''))
    .filter((id) => id !== '');
}

export default function rosterFlow(): void {
  expectStatus(SUITE, 'DIR-LIST-UNAUTHENTICATED', requestJson('GET', `${base}/relay/v1/peers`), 401, 'The roster requires a session.');

  const ada = openSession(base, 'ada');
  if (!ada) {
    mark(SUITE, 'DIR-SETUP', requestJson('GET', `${base}/relay/v1/ready`), false, 'Ada could not open a session.');
    return;
  }

  expectStatus(SUITE, 'DIR-ADD-SELF', requestJson('POST', `${base}/relay/v1/peers`, ada.token, { memberId: ada.memberId }), 400, 'A member cannot connect to itself.');
  expectStatus(SUITE, 'DIR-ADD-UNKNOWN', requestJson('POST', `${base}/relay/v1/peers`, ada.token, { memberId: 'mem_nobody' }), 404, 'An unknown member is rejected.');
  const empty = requestJson('GET', `${base}/relay/v1/peers`, ada.token);
  expectStatus(SUITE, 'DIR-LIST-EMPTY', empty, 200, 'The roster starts empty.');
  mark(SUITE, 'DIR-LIST-EMPTY-SHAPE', empty, peerIds(empty).length === 0, 'The empty roster has no peers.');
  expectStatus(SUITE, 'DIR-ADD', requestJson('POST', `${base}/relay/v1/peers`, ada.token, { memberId: 'mem_bao' }), 201, 'Peer connected.');
  const listed = requestJson('GET', `${base}/relay/v1/peers`, ada.token);
  expectStatus(SUITE, 'DIR-LIST-CONNECTED', listed, 200, 'The roster lists the new peer.');
  mark(SUITE, 'DIR-LIST-CONNECTED-MEMBER', listed, peerIds(listed).join(',') === 'mem_bao', 'Bao is the connected peer.');
  expectStatus(SUITE, 'DIR-ADD-AGAIN', requestJson('POST', `${base}/relay/v1/peers`, ada.token, { memberId: 'mem_bao' }), 409, 'A second connection is rejected.');
  expectStatus(SUITE, 'DIR-BLOCK', requestJson('POST', `${base}/relay/v1/peers/mem_bao/block`, ada.token), 200, 'The peer was blocked.');
  const after = requestJson('GET', `${base}/relay/v1/peers`, ada.token);
  expectStatus(SUITE, 'DIR-LIST-AFTER-BLOCK', after, 200, 'The roster no longer lists the blocked peer.');
  mark(SUITE, 'DIR-LIST-AFTER-BLOCK-SHAPE', after, peerIds(after).length === 0, 'The blocked peer is absent.');

  const bao = openSession(base, 'bao');
  if (!bao) {
    mark(SUITE, 'DIR-BAO-SETUP', requestJson('GET', `${base}/relay/v1/ready`), false, 'Bao could not open a session.');
    return;
  }
  expectStatus(SUITE, 'DIR-ADD-BLOCKED', requestJson('POST', `${base}/relay/v1/peers`, bao.token, { memberId: 'mem_ada' }), 409, 'A block prevents a new connection.');
}
