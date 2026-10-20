const COLUMNS = ['runId', 'suite', 'caseId', 'outcome', 'status', 'latencyMs', 'detail'];

function normalize(value) {
  return {
    runId: String(value.runId ?? ''),
    suite: String(value.suite ?? ''),
    caseId: String(value.caseId ?? ''),
    outcome: value.outcome === 'pass' ? 'pass' : 'fail',
    status: Number.isFinite(Number(value.status)) ? Number(value.status) : 0,
    latencyMs: Number.isFinite(Number(value.latencyMs)) ? Math.round(Number(value.latencyMs)) : 0,
    detail: String(value.detail ?? ''),
  };
}

function payloadFrom(line) {
  const marker = 'LUMEN_EVIDENCE ';
  const index = line.indexOf(marker);
  if (index === -1) {
    return null;
  }
  let raw = line.slice(index + marker.length).trim();
  if (line.includes('level=') && raw.includes('\\"')) {
    raw = raw.replace(/\\"/g, '"');
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }
  return raw.slice(start, end + 1);
}

export function parseEvidence(streamText) {
  const rows = [];
  for (const line of String(streamText).split(/\r?\n/)) {
    const payload = payloadFrom(line);
    if (!payload) {
      continue;
    }
    try {
      const parsed = JSON.parse(payload);
      if (!parsed || typeof parsed !== 'object' || !parsed.caseId || !parsed.suite) {
        continue;
      }
      rows.push(normalize(parsed));
    } catch {
      // Progress lines and summaries are not evidence.
    }
  }
  return rows;
}

function csvField(value) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows) {
  const lines = [COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(COLUMNS.map((column) => csvField(row[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}
