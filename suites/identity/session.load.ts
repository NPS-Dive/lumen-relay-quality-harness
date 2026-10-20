import { check, sleep } from 'k6';
import { loadEvidenceLine, loadOptions, openSession, origin, type LoadSummary } from '../shared/relay.ts';

const base = origin();

export const options = loadOptions;

export default function identityLoad(): void {
  const session = openSession(base, 'ada');
  check(session, {
    'ID-LOAD session': (value) => value !== null && value.memberId === 'mem_ada',
  });
  sleep(0.1);
}

export function handleSummary(data: LoadSummary): Record<string, string> {
  return { stdout: loadEvidenceLine('identity', 'ID-LOAD', data) };
}
