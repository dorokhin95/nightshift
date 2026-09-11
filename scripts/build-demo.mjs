import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
if (!existsSync(root+'dist/demo/main.js')) throw new Error('Compile TypeScript before packaging the demo');
// Manual recursive copy instead of fs.cpSync(...,{recursive:true}): on some Windows/Node builds
// cpSync crashes (STATUS_STACK_BUFFER_OVERRUN) when the project path contains non-ASCII characters.
function copyDir(src, dst) {
  mkdirSync(dst, {recursive:true});
  for (const name of readdirSync(src)) {
    const s = src+'/'+name, d = dst+'/'+name;
    if (statSync(s).isDirectory()) copyDir(s, d); else copyFileSync(s, d);
  }
}
copyDir(root+'public', root+'dist');
copyFileSync(root+'tests/fixtures/specials.json',root+'dist/fixtures.json');
console.log('Game and workshop packaged in dist/');
