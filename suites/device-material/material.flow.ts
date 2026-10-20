import { expectStatus, jsonObject, mark, openSession, origin, requestJson } from '../shared/relay.ts';

const SUITE = 'device-material';
const base = origin();
const FIRST = 'desk-material-ada-0001';
const SECOND = 'desk-material-ada-0002';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1'],
  },
};

export default function materialFlow(): void {
  expectStatus(SUITE, 'MAT-PUBLISH-UNAUTHENTICATED', requestJson('PUT', `${base}/relay/v1/devices/current/material`, undefined, { publicMaterial: FIRST }), 401, 'Publishing material requires a session.');

  const ada = openSession(base, 'ada');
  if (!ada) {
    mark(SUITE, 'MAT-SETUP', requestJson('GET', `${base}/relay/v1/ready`), false, 'Ada could not open a session.');
    return;
  }

  expectStatus(SUITE, 'MAT-ROTATE-EMPTY', requestJson('POST', `${base}/relay/v1/devices/current/material/rotate`, ada.token, { publicMaterial: SECOND }), 409, 'Rotation requires published material.');
  expectStatus(SUITE, 'MAT-PUBLISH-MALFORMED', requestJson('PUT', `${base}/relay/v1/devices/current/material`, ada.token, { publicMaterial: 'too-short' }), 400, 'Short material is rejected.');
  expectStatus(SUITE, 'MAT-READ-UNKNOWN', requestJson('GET', `${base}/relay/v1/devices/mem_nobody/material`, ada.token), 404, 'An unknown member is rejected.');
  const published = requestJson('PUT', `${base}/relay/v1/devices/current/material`, ada.token, { publicMaterial: FIRST });
  expectStatus(SUITE, 'MAT-PUBLISH', published, 200, 'Device material was published.');
  mark(SUITE, 'MAT-PUBLISH-GENERATION', published, jsonObject(published).generation === 1, 'The first publication is generation 1.');
  expectStatus(SUITE, 'MAT-PUBLISH-CONFLICT', requestJson('PUT', `${base}/relay/v1/devices/current/material`, ada.token, { publicMaterial: SECOND }), 409, 'A different value must be rotated, not published again.');
  expectStatus(SUITE, 'MAT-READ-SELF', requestJson('GET', `${base}/relay/v1/devices/${ada.memberId}/material`, ada.token), 200, 'The publisher can read its own material.');

  const bao = openSession(base, 'bao');
  if (!bao) {
    mark(SUITE, 'MAT-BAO-SETUP', requestJson('GET', `${base}/relay/v1/ready`), false, 'Bao could not open a session.');
    return;
  }
  expectStatus(SUITE, 'MAT-READ-HIDDEN', requestJson('GET', `${base}/relay/v1/devices/${ada.memberId}/material`, bao.token), 403, 'A non-peer cannot read device material.');
  expectStatus(SUITE, 'MAT-CONNECT', requestJson('POST', `${base}/relay/v1/peers`, ada.token, { memberId: bao.memberId }), 201, 'The peers connected before the read.');
  expectStatus(SUITE, 'MAT-READ-PEER', requestJson('GET', `${base}/relay/v1/devices/${ada.memberId}/material`, bao.token), 200, 'A connected peer can read device material.');
  expectStatus(SUITE, 'MAT-ROTATE-SAME', requestJson('POST', `${base}/relay/v1/devices/current/material/rotate`, ada.token, { publicMaterial: FIRST }), 400, 'Rotation must change the material.');
  const rotated = requestJson('POST', `${base}/relay/v1/devices/current/material/rotate`, ada.token, { publicMaterial: SECOND });
  expectStatus(SUITE, 'MAT-ROTATE', rotated, 200, 'Device material was rotated.');
  mark(SUITE, 'MAT-ROTATE-GENERATION', rotated, jsonObject(rotated).generation === 2, 'Rotation advances the generation.');
}
