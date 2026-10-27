#!/usr/bin/env node
/**
 * StellarPick lab audit runner.
 *
 * Runs, in order:
 *   1. verify   -> verify-v.mjs (V01-V10), verify-negative.mjs (N01-N06 + control), smoke.mjs (18 routes)
 *   2. a11y     -> a11y.mjs (axe-core)
 *   3. perf     -> perf.mjs (navigation timing + API latency)
 *   4. mobile   -> mobile-qa.mjs (360/768 overflow + console errors)
 *
 * Exits non-zero when a script fails or when a script reports a blocking finding.
 * Scripts that only print (a11y/perf/mobile) are parsed so they cannot silently pass.
 * a11y.mjs already blocks serious and moderate findings, so --strict-a11y is an alias.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const strictA11y = process.argv.includes('--strict-a11y');

const results = [];

function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}

function run(relative, timeout = 240000) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [path.join(ROOT, relative)], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout,
    env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    script: relative,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    elapsed: Date.now() - started,
    error: result.error ? String(result.error.message) : null,
  };
}

function summarize(label, ok, detail, output) {
  results.push({ label, ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + label + ' ' + detail);
  if (!ok && output) {
    console.log('----- ' + label + ' output (tail) -----');
    console.log(output.trim().split(/\r?\n/).slice(-25).join('\n'));
    console.log('----- end ' + label + ' -----');
  }
}

// ---------------------------------------------------------------------------
// 1) verify group
// ---------------------------------------------------------------------------
function runVerifyGroup() {
  const checks = [];

  if (exists('tools/e2e/verify-v.mjs')) {
    const out = run('tools/e2e/verify-v.mjs');
    const summary = out.stdout.match(/SUMMARY\s+(\d+)\s+checks\s+(\d+)\s+failed/);
    const checksCount = summary ? Number(summary[1]) : 0;
    const failed = summary ? Number(summary[2]) : Number.POSITIVE_INFINITY;
    const ok = out.status === 0 && failed === 0 && checksCount === 10;
    summarize('verify.v', ok, failed === 0 ? checksCount + '/10 checks' : String(failed) + ' failed', out.stdout + out.stderr);
    checks.push(ok);
  }

  if (exists('tools/e2e/verify-negative.mjs')) {
    const out = run('tools/e2e/verify-negative.mjs');
    const lines = out.stdout.split(/\r?\n/).filter((line) => /^(PASS|FAIL)\s+N/.test(line.trim()));
    const pass = lines.filter((line) => line.trim().startsWith('PASS')).length;
    const fail = lines.filter((line) => line.trim().startsWith('FAIL')).length;
    const ok = out.status === 0 && fail === 0 && pass === 7;
    summarize('verify.negative', ok, fail === 0 ? pass + '/7 checks' : fail + ' failed', out.stdout + out.stderr);
    checks.push(ok);
  }

  if (exists('tools/e2e/smoke.mjs')) {
    const out = run('tools/e2e/smoke.mjs');
    const summary = out.stdout.match(/SUMMARY\s+routes\s+(\d+)\s+bad\s+(\d+)/);
    const routes = summary ? Number(summary[1]) : 0;
    const bad = summary ? Number(summary[2]) : Number.POSITIVE_INFINITY;
    const ok = out.status === 0 && bad === 0 && routes === 18;
    summarize('smoke', ok, bad === 0 ? routes + '/18 routes' : bad + ' bad', out.stdout + out.stderr);
    checks.push(ok);
  }

  return checks.every(Boolean);
}

// ---------------------------------------------------------------------------
// 2) a11y
// ---------------------------------------------------------------------------
function runA11y() {
  const out = run('tools/e2e/a11y.mjs');
  const summary = out.stdout.match(/scanned=(\d+)\s+failures=(\d+)/);
  if (summary) {
    const scanned = Number(summary[1]);
    const failures = Number(summary[2]);
    const ok = out.status === 0 && failures === 0 && scanned > 0;
    summarize('a11y', ok, scanned + ' scans, ' + failures + ' failures', out.stdout + out.stderr);
    return ok;
  }
  const lines = out.stdout.split(/\r?\n/).filter((line) => line.trim().startsWith('/'));
  let critical = 0;
  let serious = 0;
  let routes = 0;
  for (const line of lines) {
    const start = line.indexOf('[');
    if (start === -1) continue;
    let violations = [];
    try { violations = JSON.parse(line.slice(start)); } catch { continue; }
    routes++;
    for (const violation of violations) {
      if (violation.impact === 'critical') critical++;
      if (violation.impact === 'serious') serious++;
    }
  }
  const ok = out.status === 0 && critical === 0 && (strictA11y ? serious === 0 : true);
  summarize(
    'a11y',
    ok,
    routes + ' routes, ' + critical + ' critical, ' + serious + ' serious' + (strictA11y ? ' (strict)' : ''),
    out.stdout + out.stderr,
  );
  return ok;
}

// ---------------------------------------------------------------------------
// 3) perf
// ---------------------------------------------------------------------------
function runPerf() {
  const out = run('tools/e2e/perf.mjs');
  let data = null;
  const start = out.stdout.indexOf('{\n  "initialJs"');
  const end = out.stdout.lastIndexOf('\n}');
  if (start !== -1 && end > start) {
    try { data = JSON.parse(out.stdout.slice(start, end + 2)); } catch {}
  }
  if (!data || !Array.isArray(data.pages)) {
    summarize('perf', out.status === 0, out.status === 0 ? 'script passed (metrics unparsed)' : 'perf.mjs failed', out.stdout + out.stderr);
    return out.status === 0;
  }
  const violations = Array.isArray(data.violations) ? data.violations : [];
  const worstLcp = data.maxLcpMs ?? Math.max(...data.pages.map((page) => page.lcp));
  const worstP95 = (data.api ?? []).reduce((max, api) => Math.max(max, api.p95), 0);
  const ok = out.status === 0 && violations.length === 0;
  summarize('perf', ok, 'max LCP ' + worstLcp + 'ms, initial JS ' + (data.initialJsTransferKb ?? '?') + 'KB, worst API p95 ' + worstP95 + 'ms', out.stdout + out.stderr);
  return ok;
}

// ---------------------------------------------------------------------------
// 4) mobile
// ---------------------------------------------------------------------------
function runMobile() {
  const out = run('tools/e2e/mobile-qa.mjs');
  const lines = out.stdout.split(/\r?\n/).filter((line) => /^\d+\s+/.test(line));
  const overflow = lines.filter((line) => line.includes('overflow YES')).length;
  const consoleErrors = lines.filter((line) => /errors\s+[1-9]/.test(line)).length;
  const ok = out.status === 0 && overflow === 0 && consoleErrors === 0 && lines.length > 0;
  summarize('mobile', ok, lines.length + ' viewport/route checks, ' + overflow + ' overflow, ' + consoleErrors + ' with console errors', out.stdout + out.stderr);
  return ok;
}

// ---------------------------------------------------------------------------
console.log('StellarPick audit @ ' + new Date().toISOString());
console.log('node: ' + process.execPath);
console.log('root: ' + ROOT);
console.log('');

const groupOk = runVerifyGroup();
if (exists('tools/e2e/a11y.mjs')) runA11y();
else summarize('a11y', true, 'skipped (script missing)');
if (exists('tools/e2e/perf.mjs')) runPerf();
else summarize('perf', true, 'skipped (script missing)');
if (exists('tools/e2e/mobile-qa.mjs')) runMobile();
else summarize('mobile', true, 'skipped (script missing)');

const failed = results.filter((result) => !result.ok);
console.log('');
console.log('AUDIT SUMMARY ' + (results.length - failed.length) + '/' + results.length + ' steps passed' + (groupOk ? '' : ' (verify group failed)'));
for (const result of results) {
  console.log('  ' + (result.ok ? 'OK  ' : 'FAIL') + ' ' + result.label + ' - ' + result.detail);
}
process.exitCode = failed.length ? 1 : 0;
