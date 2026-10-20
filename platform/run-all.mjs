import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEvidence, toCsv } from './evidence.mjs';
import { assertLoopback, DEFAULT_BASE_URL, loopbackPort } from './guard.mjs';
import { renderSummary } from './report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SUITE_FILES = [
  { suite: 'identity', file: 'suites/identity/session.flow.ts' },
  { suite: 'identity', file: 'suites/identity/session.load.ts' },
  { suite: 'directory', file: 'suites/directory/roster.flow.ts' },
  { suite: 'directory', file: 'suites/directory/roster.load.ts' },
  { suite: 'device-material', file: 'suites/device-material/material.flow.ts' },
  { suite: 'device-material', file: 'suites/device-material/material.load.ts' },
  { suite: 'profile', file: 'suites/profile/card.flow.ts' },
  { suite: 'profile', file: 'suites/profile/card.load.ts' },
];

function makeRunId() {
  const stamp = new Date().toISOString().replace(/\..*Z$/, 'Z').replace(/[-:]/g, '');
  return `${stamp}-${randomBytes(2).toString('hex')}`;
}

function readOption(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

export function resolveBaseUrl(argv, env) {
  const requested = readOption(argv, '--base-url') || env.BASE_URL || DEFAULT_BASE_URL;
  return assertLoopback(requested);
}

function startMock(port, env) {
  return spawn(process.execPath, ['mock/src/server.mjs'], {
    cwd: ROOT,
    env: { ...env, PORT: String(port), HOST: BIND_IGNORED },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

const BIND_IGNORED = '127.0.0.1';

async function waitReady(baseUrl, child) {
  const deadline = Date.now() + 5000;
  let detail = 'no response';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`The mock exited before it was ready (${detail}).`);
    }
    try {
      const response = await fetch(`${baseUrl}/relay/v1/ready`);
      if (response.ok) {
        return;
      }
      detail = `HTTP ${response.status}`;
    } catch (error) {
      detail = error instanceof Error ? error.message : 'connection failed';
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`The mock did not become ready: ${detail}`);
}

function stopMock(child) {
  if (!child || child.exitCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 2000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

function runK6(file, baseUrl, runId, env) {
  return new Promise((resolve) => {
    const child = spawn('k6', ['run', file, '-e', `BASE_URL=${baseUrl}`, '-e', `RUN_ID=${runId}`], {
      cwd: ROOT,
      env: { ...env, K6_WEB_DASHBOARD: 'false' },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      if (stderr.length < 100_000) {
        stderr += text.slice(0, 100_000 - stderr.length);
      }
      process.stderr.write(text);
    });
    child.on('error', (error) => {
      stderr += `\n${error.message}\n`;
      resolve({ code: 127, stdout, stderr });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const baseUrl = resolveBaseUrl(argv, env);
  const port = loopbackPort(baseUrl);
  const runId = makeRunId();
  const rows = [];
  const failures = [];

  for (const item of SUITE_FILES) {
    const mock = startMock(port, env);
    let mockLog = '';
    mock.stdout.on('data', (chunk) => {
      mockLog += String(chunk);
    });
    mock.stderr.on('data', (chunk) => {
      mockLog += String(chunk);
    });
    try {
      await waitReady(baseUrl, mock);
      console.log(`\n== ${item.file} ==`);
      const result = await runK6(item.file, baseUrl, runId, env);
      const found = parseEvidence(`${result.stdout}\n${result.stderr}`);
      rows.push(...found);
      if (result.code !== 0) {
        failures.push(`${item.file} exited ${result.code}`);
      }
      if (found.length === 0) {
        failures.push(`${item.file} recorded no evidence`);
      }
    } catch (error) {
      failures.push(`${item.file}: ${error instanceof Error ? error.message : 'failed'}`);
      if (mockLog.trim()) {
        console.error(mockLog.trim());
      }
    } finally {
      await stopMock(mock);
    }
  }

  const summary = renderSummary({ runId, baseUrl, rows });
  const directory = path.join(ROOT, 'results', runId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'evidence.csv'), toCsv(rows), 'utf8');
  await writeFile(path.join(directory, 'summary.md'), summary, 'utf8');
  process.stdout.write(`\n${summary}`);

  const suitesSeen = new Set(rows.map((row) => row.suite));
  for (const name of ['identity', 'directory', 'device-material', 'profile']) {
    if (!suitesSeen.has(name)) {
      failures.push(`No evidence for ${name}`);
    }
  }
  if (rows.some((row) => row.outcome !== 'pass')) {
    failures.push('One or more evidence rows failed');
  }
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    return 1;
  }
  return 0;
}

const launchedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (launchedDirectly) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    },
  );
}
