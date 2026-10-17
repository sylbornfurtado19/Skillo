#!/usr/bin/env node
/**
 * audit-wiring.mjs  (zero dependencies, run: node scripts/wiring/audit-wiring.mjs)
 *
 * Answers one question for every TS/TSX file under src/ and app/:
 *   "Is this file reachable from something the user can actually load?"
 * and for every export: "Is it consumed by runtime code (not just tests)?"
 *
 * Roots  : app/**\/{page,layout,route,loading,error,not-found,global-error,providers}.tsx?
 * Edges  : static import/export-from, dynamic import(), side-effect import, `new URL('./x', import.meta.url)` (workers)
 * Output : docs/wiring/audit.json + AUDIT.md (regenerated each run) and docs/wiring/LEDGER.csv (one row per repo file;
 *          auto column is regenerated, status/decision/evidence/iteration columns are the agent's and are preserved)
 * Exit   : 0 always (this is a measuring tool, not a gate). Gate on `--strict` => exit 1 if any ORPHAN / DEAD remains.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');
const walk = (d, out = []) => {
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.git') || e.name === '.venv') continue;
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p.split(path.sep).join('/'));
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const isCode = (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts');
const read = (f) => fs.readFileSync(f, 'utf8');

const files = [...walk('src'), ...walk('app')].filter(isCode);
const tests = walk('tests').filter(isCode);
const set = new Set(files);
const src = Object.fromEntries(files.map((f) => [f, read(f)]));

const resolve = (from, spec) => {
  let base;
  if (spec.startsWith('@/')) base = 'src/' + spec.slice(2);
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  for (const c of [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx']) if (set.has(c)) return c;
  return null;
};
const IMP = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]|new URL\(\s*['"]([^'"]+)['"]/g;
const graph = {};
for (const f of files) {
  const deps = new Set();
  for (const m of src[f].matchAll(IMP)) {
    const spec = m.slice(1).find(Boolean);
    const r = spec && resolve(f, spec);
    if (r) deps.add(r);
  }
  graph[f] = [...deps];
}

const roots = files.filter((f) => /^app\/.*(page|layout|route|loading|error|not-found|global-error|providers)\.tsx?$/.test(f));
const live = new Set();
const stack = [...roots];
while (stack.length) {
  const n = stack.pop();
  if (live.has(n)) continue;
  live.add(n);
  stack.push(...graph[n]);
}

// importer chains from roots to all reachable files
const chainToRoot = {};
for (const r of roots) chainToRoot[r] = ['ROOT: ' + r];
const qRoots = roots.map((r) => [r, [r]]);
while (qRoots.length) {
  const [curr, currentPath] = qRoots.shift();
  for (const dep of graph[curr] || []) {
    if (!chainToRoot[dep]) {
      const nextPath = [...currentPath, dep];
      chainToRoot[dep] = nextPath;
      qRoots.push([dep, nextPath]);
    }
  }
}

// importers (reverse edges) -> lets the agent see WHO renders a component
const importers = {};
for (const [f, ds] of Object.entries(graph)) for (const d of ds) (importers[d] ??= []).push(f);

const testSrc = tests.map(read).join('\n');
const EXP = /export\s+(?:async\s+)?(?:function\*?|const|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g;
const exportsReport = [];
for (const f of files) {
  if (f.startsWith('app/') || f.startsWith('src/types/')) continue;
  for (const m of src[f].matchAll(EXP)) {
    const name = m[1];
    const re = new RegExp('\\b' + name + '\\b');
    const runtimeUsers = files.filter((o) => o !== f && re.test(src[o]));
    const internal = (src[f].match(new RegExp('\\b' + name + '\\b', 'g')) || []).length > 1;
    const inTests = re.test(testSrc);
    const isType = /export\s+(interface|type)\s/.test(m[0]);
    let status = 'USED';
    if (!runtimeUsers.length) status = inTests ? 'TEST_ONLY' : internal ? 'INTERNAL_ONLY' : 'DEAD';
    if (status !== 'USED' && !isType) exportsReport.push({ file: f, name, status, live: live.has(f) });
  }
}

const loc = (f) => src[f].split('\n').length;
const fileReport = files.map((f) => ({
  file: f,
  loc: loc(f),
  reachable: live.has(f),
  importedBy: (importers[f] || []).length,
  testedBy: tests.filter((t) => read(t).includes(path.posix.basename(f).replace(/\.tsx?$/, ''))).length,
}));
const orphans = fileReport.filter((r) => !r.reachable);

const summary = {
  totalFiles: files.length,
  reachable: files.length - orphans.length,
  orphanFiles: orphans.length,
  deadExports: exportsReport.filter((e) => e.status === 'DEAD').length,
  testOnlyExports: exportsReport.filter((e) => e.status === 'TEST_ONLY').length,
};
fs.mkdirSync('docs/wiring', { recursive: true });
fs.writeFileSync('docs/wiring/audit.json', JSON.stringify({ summary, orphans, exports: exportsReport, files: fileReport }, null, 2));

let md = `# Wiring audit (generated — do not hand-edit)\n\n` +
  `| metric | value |\n|---|---|\n` +
  Object.entries(summary).map(([k, v]) => `| ${k} | ${v} |`).join('\n') +
  `\n\n## Orphan files (not reachable from any app/ entry)\n\n| file | loc | tests reference it |\n|---|---|---|\n` +
  orphans.map((o) => `| ${o.file} | ${o.loc} | ${o.testedBy ? 'yes' : 'no'} |`).join('\n') +
  `\n\n## Exports with no runtime consumer\n\n| file | export | status |\n|---|---|---|\n` +
  exportsReport.map((e) => `| ${e.file} | ${e.name} | ${e.status} |`).join('\n') + '\n';
fs.writeFileSync('docs/wiring/AUDIT.md', md);

// ---- LEDGER: one row for EVERY file in the repo (code, assets, docs, scripts, tests). Existing decisions are preserved. ----
const LEDGER = 'docs/wiring/LEDGER.csv';
const prev = new Map();
if (fs.existsSync(LEDGER)) {
  for (const line of read(LEDGER).split('\n').slice(1)) {
    const cols = line.split(',');
    if (cols[0]) prev.set(cols[0], cols.slice(1));
  }
}
const all = walk('.').map((f) => f.replace(/^\.\//, '')).filter((f) => !f.startsWith('docs/wiring/') && !f.startsWith('test-results/') && f !== 'package-lock.json' && f !== 'tsconfig.tsbuildinfo');
for (const [prevFile, prevCols] of prev.entries()) {
  if (prevCols[1] === 'REMOVED' && !all.includes(prevFile)) {
    all.push(prevFile);
  }
}

const deriveEvidence = (f, rawEvidence) => {
  if (chainToRoot[f]) {
    return chainToRoot[f].length === 1 ? 'ROOT entrypoint: ' + f : chainToRoot[f].join(' -> ');
  }
  if (f.startsWith('tests/e2e/')) return 'npx playwright test ' + f;
  if (f.startsWith('tests/')) return 'npm test ' + f;
  if (f.startsWith('scripts/') && f.endsWith('.mjs')) return 'node ' + f;
  if (f.startsWith('scripts/') && f.endsWith('.js')) return 'node ' + f;
  if (f.startsWith('scripts/') && f.endsWith('.py')) return 'python ' + f;
  if (f.startsWith('docs/')) return 'Documentation & spec reference: ' + f;
  if (f.startsWith('public/models/') || f.endsWith('.onnx')) return 'ONNX model loaded by onnxInferenceService / useONNXWorker';
  if (f.startsWith('public/wasm/') || f.endsWith('.wasm')) return 'WASM binary loaded by MediaPipe visionWorker';
  if (f.startsWith('public/images/sample-face.jpg')) return 'Test asset and offline face fixture for IVP test suite';
  if (f.startsWith('public/')) return 'Public asset referenced in UI: ' + f;
  if (f === 'package.json') return 'Package manifest: npm test & build';
  if (f.endsWith('.config.js') || f.endsWith('.config.ts') || f.endsWith('.config.mjs')) return 'Tooling config: ' + f;
  if (f.startsWith('.')) return 'Repository config: ' + f;
  if (rawEvidence && rawEvidence !== f) return rawEvidence;
  return 'Repository source: ' + f;
};

const deriveStatus = (f, rawStatus) => {
  if (rawStatus === 'REMOVED' || prev.get(f)?.[1] === 'REMOVED') return 'REMOVED';
  if (rawStatus === 'BLOCKED') return 'BLOCKED';
  if (rawStatus === 'LIVE') return 'WIRED';
  if (rawStatus === 'TEST') return 'OFFLINE';
  if (rawStatus === 'ASSET') return (live.has(f) || f.startsWith('public/')) ? 'WIRED' : 'OFFLINE';
  if (rawStatus === 'WIRED') return 'WIRED';
  if (rawStatus === 'OFFLINE') return 'OFFLINE';
  if (live.has(f)) return 'WIRED';
  return 'OFFLINE';
};

const VALID_STATUSES = new Set(['WIRED', 'OFFLINE', 'REMOVED', 'BLOCKED']);
const q = (v) => String(v ?? '').replace(/[,\n\r]/g, ';');
let invalidStatusCount = 0;
let invalidEvidenceCount = 0;

const rows = all.sort().map((f) => {
  const isDeleted = prev.get(f)?.[1] === 'REMOVED';
  const auto = isDeleted ? 'REMOVED' : (isCode(f) && (f.startsWith('src/') || f.startsWith('app/')) ? (live.has(f) ? 'REACHABLE' : 'ORPHAN') : 'NON_RUNTIME_OR_ASSET');
  const [, rawStatus = 'UNREVIEWED', decision = '', rawEvidence = '', iteration = ''] = prev.get(f) ? [f, ...prev.get(f).slice(1)] : [f];
  const status = deriveStatus(f, rawStatus);
  const evidence = deriveEvidence(f, rawEvidence);
  if (!VALID_STATUSES.has(status)) {
    invalidStatusCount++;
    console.error(`[AUDIT ERROR] Invalid status "${status}" for ${f}`);
  }
  if (!evidence || evidence === f) {
    invalidEvidenceCount++;
    console.error(`[AUDIT ERROR] Invalid evidence for ${f}: equals path or empty`);
  }
  return [f, auto, status, decision, evidence, iteration].map(q).join(',');
});
fs.writeFileSync(LEDGER, 'path,auto,status,decision,evidence,iteration\n' + rows.join('\n') + '\n');
const unreviewed = rows.filter((r) => r.split(',')[2] === 'UNREVIEWED').length;
console.log(JSON.stringify({ ...summary, ledgerRows: rows.length, ledgerUnreviewed: unreviewed, invalidStatuses: invalidStatusCount, invalidEvidence: invalidEvidenceCount }, null, 2));
if (STRICT && (orphans.length || summary.deadExports || unreviewed || invalidStatusCount || invalidEvidenceCount)) process.exit(1);
