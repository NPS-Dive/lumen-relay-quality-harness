import { check, sleep } from 'k6';
import { loadEvidenceLine, loadOptions, openSession, origin, requestJson, type LoadSummary } from '../shared/relay.ts';

const base = origin();

export const options = loadOptions;

interface SetupData {
  token: string;
  memberId: string;
}

export function setup(): SetupData {
  const session = openSession(base, 'ada');
  if (!session) {
    throw new Error('The material load could not open a session.');
  }
  const published = requestJson('PUT', `${base}/relay/v1/devices/current/material`, session.token, {
    publicMaterial: 'desk-material-load-0001',
  });
  if (published.status !== 200) {
    throw new Error('The material load could not publish material.');
  }
  return { token: session.token, memberId: session.memberId };
}

export default function materialLoad(data: SetupData): void {
  const response = requestJson('GET', `${base}/relay/v1/devices/${data.memberId}/material`, data.token);
  check(response, { 'MAT-LOAD material': (item) => item.status === 200 });
  sleep(0.1);
}

export function handleSummary(data: LoadSummary): Record<string, string> {
  return { stdout: loadEvidenceLine('device-material', 'MAT-LOAD', data) };
}
