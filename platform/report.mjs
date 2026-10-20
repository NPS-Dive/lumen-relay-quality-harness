export function renderSummary({ runId, baseUrl, rows }) {
  const passed = rows.filter((row) => row.outcome === 'pass').length;
  const failed = rows.length - passed;
  const lines = [
    '# Run summary',
    '',
    `Run \`${runId}\` against \`${baseUrl}\`.`,
    '',
    `- Passed: ${passed}`,
    `- Failed: ${failed}`,
    '',
    '## Cases',
    '',
  ];
  if (rows.length === 0) {
    lines.push('No evidence rows were recorded.');
  } else {
    for (const row of rows) {
      lines.push(`- ${row.suite} \`${row.caseId}\`: ${row.outcome}, HTTP ${row.status}, ${row.latencyMs} ms. ${row.detail}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
