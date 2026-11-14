import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const manifestPath = 'docs/RELEASE_REVIEW.json';
const manifestBytes = await readFile(join(root, manifestPath));
const manifest = JSON.parse(manifestBytes);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [...manifest.files, { path: manifestPath, bytes: manifestBytes.length, sha256: digest(manifestBytes) }];
const denied = new Set(['data','node_modules','target','dist','build','.git','.near-credentials']);
for (const file of files) {
  const parts = file.path.replaceAll('\\','/').split('/');
  if (isAbsolute(file.path) || parts.some(p => p === '..' || denied.has(p)) || parts.some(p => p.startsWith('.env') && p !== '.env.example')) throw Error(`Unexpected publication path: ${file.path}`);
  if (relative(root, resolve(root, file.path)).startsWith('..')) throw Error('Publication path escaped workspace');
  const actual = await readFile(join(root, file.path));
  if (actual.length !== file.bytes || digest(actual) !== file.sha256) throw Error(`Review manifest is stale: ${file.path}. Regenerate it before packaging.`);
}
const output = join(root, 'data/releases');
await mkdir(output, { recursive: true });
const stamp = new Date().toISOString().replaceAll(':','-').replaceAll('.','-');
const archive = join(output, `aftermarket-source-${stamp}.tar.gz`);
const listPath = join(output, `files-${stamp}.txt`);
await writeFile(listPath, files.map(f => f.path).join('\n') + '\n', { flag: 'wx' });
function tar(args) {
  const result = spawnSync('tar', args, { cwd: root, windowsHide: true, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw Error(result.stderr || result.error?.message || 'Archive command failed');
  return result.stdout;
}
tar(['-czf', archive, '-C', root, '-T', listPath]);
const entries = tar(['-tzf', archive]).trim().split(/\r?\n/).sort();
const expected = files.map(f => f.path).sort();
if (JSON.stringify(entries) !== JSON.stringify(expected)) throw Error('Archive contents differ from the reviewed file list');
const extracted = await mkdtemp(join(output, 'verified-source-'));
tar(['-xzf', archive, '-C', extracted]);
for (const file of files) {
  const bytes = await readFile(join(extracted, file.path));
  if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw Error(`Extracted file differs from review: ${file.path}`);
}
const archiveBytes = await readFile(archive);
const report = { status: 'verified-local-source-package-not-published', createdAt: new Date().toISOString(), archive: relative(root,archive).replaceAll('\\','/'), extracted: relative(root,extracted).replaceAll('\\','/'), fileCount: files.length, bytes: archiveBytes.length, sha256: digest(archiveBytes), checks: ['source hashes match release manifest', 'archive entries exactly match reviewed paths', 'every extracted file matches reviewed hash', 'saves, credentials, dependencies and build outputs excluded'] };
await writeFile(join(output, 'LATEST.json'), JSON.stringify(report,null,2) + '\n');
console.log(JSON.stringify(report,null,2));
