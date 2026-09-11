import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ProgressStore} from '../../dist/campaign/Progress.js';
// Real campaign handlers on a minimal DOM. Native layout/audio remain device QA.
test('campaign UI: catalog, mission completion, persisted rewards, next unlock and puzzle entry',async()=>{
 const originals=new Map(),put=(k,v)=>{originals.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});};const frames=[];let now=0;
 const ctx=new Proxy({}, {get:(_t,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true});
 class Element extends EventTarget{constructor(){super();this.children=[];this.hidden=false;this.open=false;this.disabled=false;this.style={};this.attrs={};this.classList={toggle(){}};this.textContent='';}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}getContext(){return ctx;}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}focus(){}getBoundingClientRect(){return {left:0,top:0,width:512,height:512};}setPointerCapture(){}showModal(){this.open=true;}close(){this.open=false;}click(){if(!this.disabled)this.onclick?.();}}
 const elements=new Map();for(const [,id] of readFileSync('public/campaign.html','utf8').matchAll(/\bid="([^"]+)"/g))elements.set(id,new Element());const el=id=>elements.get(id);
 const doc=new EventTarget();doc.hidden=false;doc.documentElement={};doc.getElementById=el;doc.createElement=()=>new Element();doc.querySelector=()=>null;
 const window=new EventTarget();window.devicePixelRatio=1;const values=new Map();const p=new ProgressStore().data;p.tutorial=true;values.set('nightshift.progress.v1',JSON.stringify(p));
 put('document',doc);put('window',window);put('location',{search:'?mode=mission'});put('localStorage',{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)});put('fetch',async url=>new Response(readFileSync('public/'+url.slice(2))));put('requestAnimationFrame',f=>frames.push(f));put('setInterval',()=>0);
 const settle=async()=>{for(let i=0;i<3000;i++){const batch=frames.splice(0);now+=100;batch.forEach(fn=>fn(now));await new Promise(r=>setImmediate(r));if(!frames.length&&i>10)return;}throw Error('Animation did not settle');};
 try{await import('../../dist/campaign/main.js');assert.equal(el('levels').children.filter(e=>e.className!=='chapter').length,30);el('levels').children.find(e=>e.className!=='chapter').click();el('story-close').click();assert.equal(el('play').hidden,false);
 const mission=JSON.parse(readFileSync('public/data/missions.json','utf8'))[0];for(const move of mission.solution){for(const [x,y] of [move.from,move.to]){el('board').onpointerdown({button:0,clientX:(x+.5)*64,clientY:(y+.5)*64,pointerId:1});el('board').onpointerup({clientX:(x+.5)*64,clientY:(y+.5)*64});}await settle();}
 assert.ok(el('result-dialog').open);const saved=JSON.parse(values.get('nightshift.progress.v1'));assert.ok(saved.records['mission:1'].stars>0);assert.ok(saved.xp>0);el('back').click();assert.equal(el('levels').children.filter(e=>e.className!=='chapter')[1].disabled,false);el('puzzles').click();assert.equal(el('levels').children.length,20);el('levels').children[0].click();assert.equal(el('boosters').children.length,0);
 }finally{for(const[k,d]of originals)if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
});
