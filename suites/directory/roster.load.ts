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
    throw new Error('The directory load could not open a session.');
  }
  return { token: session.token };
}

export default function rosterLoad(data: SetupData): void {
  const response = requestJson('GET', `${base}/relay/v1/peers`, data.token);
  check(response, { 'DIR-LOAD roster': (item) => item.status === 200 });
  sleep(0.1);
}

export function handleSummary(data: LoadSummary): Record<string, string> {
  return { stdout: loadEvidenceLine('directory', 'DIR-LOAD', data) };
}
