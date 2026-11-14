import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const excluded = new Set(['node_modules', 'target', 'data', 'dist', 'build', '.git']);
const directories = ['src', 'tests', 'scripts', 'contracts', 'public', 'assets', 'docs'];
const rootFiles = ['package.json','package-lock.json','tsconfig.json','tsconfig.server.json','vite.config.ts','index.html','Dockerfile','compose.yaml','render.yaml','railway.json','.dockerignore','.gitignore','.env.example','LICENSE','README.md','MASTER_GAME_DESIGN.md','VISUAL_DIRECTION.md','IMPLEMENTATION_PLAN.md','GAME_DESIGN.md','HACKATHON.md'];
const paths = [];
async function walk(directory) {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw Error(`Review symlink manually: ${directory}/${entry.name}`);
    if (excluded.has(entry.name) || (entry.name.startsWith('.env') && entry.name !== '.env.example')) continue;
    const path = `${directory}/${entry.name}`;
    if (path === 'docs/RELEASE_REVIEW.json') continue;
    if (entry.isDirectory()) await walk(path); else if (entry.isFile()) paths.push(path);
  }
}
for (const directory of directories) await walk(directory);
paths.push(...rootFiles);
const files = [];
for (const path of paths.sort()) {
  const absolute = resolve(root, path);
  if (relative(root, absolute).startsWith('..')) throw Error('Review path escaped workspace');
  const bytes = await readFile(absolute);
  if (/\.(md|json|tsx?|mjs|css|html|rs|toml|ya?ml|lock)$/.test(path) || path === '.env.example') {
    const text = bytes.toString('utf8');
    if (/ed25519:[1-9A-HJ-NP-Za-km-z]{80,100}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) throw Error(`Potential credential literal in ${path}; review before packaging`);
  }
  files.push({ path, bytes: (await stat(absolute)).size, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(join(root, 'docs/RELEASE_REVIEW.json'), JSON.stringify({ status: 'prepared-for-human-review-not-published', generatedAt: new Date().toISOString(), excluded: [...excluded, 'private environment files', 'external testnet credentials'], credentialScan: 'no matching private-key or GitHub-token literals in reviewed text files; not a substitute for human review', files }, null, 2) + '\n');
console.log(`Prepared a hashed review manifest for ${files.length} files. No archive uploaded, repository pushed, or submission sent.`);
