import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const assets=[];
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+entry.name;if(entry.isDirectory())walk(p);else if(/\.(html|css|js|json|png|svg|webmanifest)$/.test(p)&&!p.endsWith('/sw.js'))assets.push('./'+p.slice(5));}}
walk('dist');assets.sort();const hash=createHash('sha256');for(const p of assets)hash.update(readFileSync('dist/'+p.slice(2)));const version=hash.digest('hex').slice(0,14);
const source=`const ASSETS=${JSON.stringify(assets)};
const PREFIX='nightshift:'+new URL(self.registration.scope).pathname+':';
const CACHE=PREFIX+'${version}';
const URLS=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;const url=new URL(event.request.url);url.search='';url.hash='';if(url.href===self.registration.scope)url.pathname+='index.html';if(!URLS.has(url.href))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const existing=await cache.match(url.href);if(existing&&!url.pathname.endsWith('/runtime-config.json'))return existing;try{const response=await fetch(event.request);if(response.ok)await cache.put(url.href,response.clone());return response;}catch{const saved=await cache.match(url.href);return saved??new Response('Offline asset unavailable',{status:503});}})());
});
`;
writeFileSync('dist/sw.js',source);console.log('PWA precache:',assets.length,'assets, version',version);
