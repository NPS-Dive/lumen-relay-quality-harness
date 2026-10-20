import http, { type RefinedResponse, type ResponseType } from 'k6/http';
import { check, fail } from 'k6';

// 4xx is a contract result in these suites, not a transport failure.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

export interface EvidenceRow {
  runId: string;
  suite: string;
  caseId: string;
  outcome: 'pass' | 'fail';
  status: number;
  latencyMs: number;
  detail: string;
}

export interface Session {
  token: string;
  memberId: string;
}

export interface LoadSummary {
  metrics: Record<string, { values: { rate?: number; 'p(95)'?: number } } | undefined>;
}

function abort(message: string): never {
  fail(message);
  throw new Error(message);
}

// k6 does not provide the URL global. Keep this pattern identical to platform/guard.mjs.
const LOOPBACK_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(?::([1-9]\d{0,4}))?\/?$/i;

export function assertLoopbackBaseUrl(value: string): string {
  const match = LOOPBACK_ORIGIN.exec(value.trim());
  const port = match?.[2];
  if (!match || (port && Number(port) > 65535)) {
    abort('Refusing a base URL that is not loopback http');
  }
  const host = match[1].toLowerCase();
  return port ? `http://${host}:${port}` : `http://${host}`;
}

export function origin(): string {
  const configured = __ENV.BASE_URL;
  if (!configured) {
    abort('BASE_URL is required');
  }
  return assertLoopbackBaseUrl(configured);
}

export function currentRunId(): string {
  const value = __ENV.RUN_ID;
  if (!value) {
    abort('RUN_ID is required');
  }
  return value;
}

export function record(row: EvidenceRow): void {
  const safe: EvidenceRow = {
    ...row,
    detail: row.detail.replace(/\s+/g, ' ').trim(),
  };
  console.log(`LUMEN_EVIDENCE ${JSON.stringify(safe)}`);
}

export function mark(
  suite: string,
  caseId: string,
  response: RefinedResponse<ResponseType>,
  passed: boolean,
  detail: string,
): boolean {
  check(response, { [caseId]: () => passed });
  record({
    runId: currentRunId(),
    suite,
    caseId,
    outcome: passed ? 'pass' : 'fail',
    status: response.status,
    latencyMs: Math.round(response.timings.duration || 0),
    detail: passed ? detail : `Case ${caseId} did not meet its contract.`,
  });
  return passed;
}

export function expectStatus(
  suite: string,
  caseId: string,
  response: RefinedResponse<ResponseType>,
  status: number,
  detail: string,
): boolean {
  return mark(suite, caseId, response, response.status === status, detail);
}

export function requestJson(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  token?: string,
  body?: unknown,
): RefinedResponse<ResponseType> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return http.request(method, url, body === undefined ? null : JSON.stringify(body), { headers });
}

export function jsonObject(response: RefinedResponse<ResponseType>): Record<string, unknown> {
  try {
    const value: unknown = response.json();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

export function openSession(base: string, handle: string): Session | null {
  const codeResponse = requestJson('POST', `${base}/relay/v1/access/codes`, undefined, { memberHandle: handle });
  const issued = jsonObject(codeResponse);
  if (codeResponse.status !== 201 || typeof issued.deskCode !== 'string') {
    return null;
  }
  const sessionResponse = requestJson('POST', `${base}/relay/v1/access/sessions`, undefined, { deskCode: issued.deskCode });
  const opened = jsonObject(sessionResponse);
  if (sessionResponse.status !== 201 || typeof opened.accessToken !== 'string' || typeof opened.memberId !== 'string') {
    return null;
  }
  return { token: opened.accessToken, memberId: opened.memberId };
}

export function loadEvidenceLine(suite: string, caseId: string, data: LoadSummary): string {
  const httpFailed = data.metrics.http_req_failed?.values.rate ?? 1;
  const checksRate = data.metrics.checks?.values.rate ?? 0;
  const p95 = data.metrics.http_req_duration?.values['p(95)'] ?? 0;
  const passed = httpFailed < 0.01 && checksRate > 0.99;
  const row: EvidenceRow = {
    runId: currentRunId(),
    suite,
    caseId,
    outcome: passed ? 'pass' : 'fail',
    status: passed ? 200 : 0,
    latencyMs: Math.round(p95),
    detail: passed ? 'Loopback load stayed inside its thresholds.' : 'Loopback load missed a threshold.',
  };
  return `LUMEN_EVIDENCE ${JSON.stringify(row)}\n`;
}

export const loadOptions = {
  vus: 2,
  duration: '3s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};
