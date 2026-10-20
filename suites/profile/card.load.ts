import { check, sleep } from 'k6';
import { loadEvidenceLine, loadOptions, openSession, origin, requestJson, type LoadSummary } from '../shared/relay.ts';

const base = origin();

export const options = loadOptions;

interface SetupData {
  token: string;
}

export function setup(): SetupData {
  const session = openSession(base, 'ada');
  if (!session) {
    throw new Error('The profile load could not open a session.');
  }
  return { token: session.token };
}

export default function cardLoad(data: SetupData): void {
  const response = requestJson('GET', `${base}/relay/v1/cards/me`, data.token);
  check(response, { 'PRF-LOAD card': (item) => item.status === 200 });
  sleep(0.1);
}

export function handleSummary(data: LoadSummary): Record<string, string> {
  return { stdout: loadEvidenceLine('profile', 'PRF-LOAD', data) };
}
