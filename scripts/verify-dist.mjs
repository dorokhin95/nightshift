import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
for(const page of ['index.html','lab.html','campaign.html','ranked.html']){
const html=readFileSync(resolve(root,page),'utf8');
for(const [,ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
  if(ref==='./')continue;
  assert.ok(ref.startsWith('./'),`Asset must use relative URL: ${ref}`);
  assert.ok(existsSync(resolve(root,ref.split(/[?#]/)[0])),`Missing HTML asset: ${ref}`);
}
}
let modules=0;
function visit(dir){
  for(const entry of readdirSync(dir,{withFileTypes:true})){
    const path=resolve(dir,entry.name);if(entry.isDirectory()){visit(path);continue;}
    if(!entry.name.endsWith('.js'))continue;
    const source=readFileSync(path,'utf8');modules++;
    for(const [,ref] of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)){
      assert.ok(ref.startsWith('.'),`Unexpected runtime dependency: ${ref}`);
      assert.ok(existsSync(resolve(dirname(path),ref)),`Missing module: ${ref}`);
    }
    if(path.includes('/game/core/'))assert.ok(!/\b(document|window|AudioContext|CanvasRenderingContext2D)\b/.test(source),'Core must remain DOM-free');
  }
}
visit(root);
assert.equal(JSON.parse(readFileSync(resolve(root,'fixtures.json'),'utf8')).length,11);
console.log(`Verified ${modules} JS modules, HTML assets and 11 scenarios. Browser/device QA not performed.`);
