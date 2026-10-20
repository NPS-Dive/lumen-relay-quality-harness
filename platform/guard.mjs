export const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';

// Keep this pattern identical to assertLoopbackBaseUrl in suites/shared/relay.ts.
const LOOPBACK_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost)(?::([1-9]\d{0,4}))?\/?$/i;

export function assertLoopback(baseUrl) {
  if (typeof baseUrl !== 'string') {
    throw new Error(`Refusing unparseable base URL: ${baseUrl}`);
  }
  const match = LOOPBACK_ORIGIN.exec(baseUrl.trim());
  const port = match?.[2];
  if (!match || (port && Number(port) > 65535)) {
    throw new Error(`Refusing non-loopback base URL: ${baseUrl}`);
  }
  const host = match[1].toLowerCase();
  return port ? `http://${host}:${port}` : `http://${host}`;
}

export function loopbackPort(origin) {
  const match = /:(\d+)$/.exec(origin);
  return match ? Number(match[1]) : 80;
}
