import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
test('PWA asset list is complete and scoped to a GitHub Pages subdirectory',async()=>{
 const source=readFileSync('dist/sw.js','utf8'),events={},stores=new Map();let waiting,skipped=false,claimed=false;
 const cache=(key)=>{if(!stores.has(key))stores.set(key,new Map());return {addAll:async paths=>{for(const p of paths){assert.ok(existsSync('dist/'+p.slice(2)));stores.get(key).set(new URL(p,'https://example.github.io/nightshift/').href,new Response(p));}},match:async url=>stores.get(key).get(url),put:async(url,r)=>stores.get(key).set(url,r)};};
 stores.set('nightshift:/other/:old',new Map());stores.set('nightshift:/nightshift/:old',new Map());
 const context={URL,Set,Response,caches:{open:async key=>cache(key),keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key)},fetch:async()=>{throw Error('offline');},self:{registration:{scope:'https://example.github.io/nightshift/'},addEventListener:(key,fn)=>events[key]=fn,clients:{claim:async()=>{claimed=true;}},skipWaiting:()=>{skipped=true;}}};vm.runInNewContext(source,context);
 events.install({waitUntil:p=>waiting=p});await waiting;events.activate({waitUntil:p=>waiting=p});await waiting;assert.ok(claimed);assert.ok(stores.has('nightshift:/other/:old'));assert.equal(stores.has('nightshift:/nightshift/:old'),false);assert.equal(skipped,false);
 let response;events.fetch({request:{method:'GET',url:'https://example.github.io/nightshift/campaign.html?mode=puzzle'},respondWith:p=>response=p});assert.equal((await response).status,200);
 response=null;events.fetch({request:{method:'GET',url:'https://api.example.com/leaderboard'},respondWith:p=>response=p});assert.equal(response,null);
 events.message({data:{type:'SKIP_WAITING'}});assert.ok(skipped);
});
