import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../../dist/game/core/index.js';

// API harness: real client handlers, renderer and core, without a real browser.
// Does not verify visual layout, native dialog behavior, accessibility or audio.
test('client flow: new, swap, frozen pause, resume, settings, results and replacement',async()=>{
  const original=new Map();
  const put=(key,value)=>{original.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});};
  let draws=0;let frameTime=0;const frames=[];
  const ctx=new Proxy({}, {get:(_target,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{if(key==='clearRect')draws++;},set:()=>true});
  class Element extends EventTarget {
    constructor(){super();this.hidden=false;this.disabled=false;this.open=false;this.dataset={};this.attrs={};this.textContent='';this.innerHTML='';this.value='';this.checked=false;}
    setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}
    getContext(){return ctx;}focus(){}showModal(){this.open=true;}close(){this.open=false;}
    getBoundingClientRect(){return {left:0,top:0,width:512,height:512};}setPointerCapture(){}append(){}replaceChildren(){}
    click(){if(!this.disabled)this.onclick?.();}
  }
  const html=readFileSync(new URL('../../public/index.html',import.meta.url),'utf8');const elements=new Map();
  for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))elements.set(id,new Element());
  const translated=[];
  for(const [,key,body] of html.matchAll(/data-t="([^"]+)"[^>]*>([\s\S]*?)<\//g)){const e=new Element();e.dataset.t=key;e.innerHTML=body;translated.push(e);}
  const document=new EventTarget();document.hidden=false;document.documentElement={};document.getElementById=id=>elements.get(id);document.querySelectorAll=()=>translated;document.createElement=()=>new Element();
  const values=new Map();const window=new EventTarget();window.devicePixelRatio=1;
  put('document',document);put('window',window);put('localStorage',{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)});
  put('matchMedia',()=>({matches:false}));put('requestAnimationFrame',callback=>frames.push(callback));put('setInterval',()=>0);
  const el=id=>elements.get(id);const click=id=>el(id).click();const saved=()=>JSON.parse(values.get('nightshift.basic.v1'));
  const pointer=(type,x,y)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{isPrimary:true,button:0,pointerId:1,clientX:x,clientY:y});el('board').dispatchEvent(e);};
  const drain=async()=>{for(let i=0;i<3000&&el('board').getAttribute('aria-busy')==='true';i++){const callbacks=frames.splice(0);frameTime+=100;callbacks.forEach(fn=>fn(frameTime));await new Promise(resolve=>setImmediate(resolve));}assert.equal(el('board').getAttribute('aria-busy'),'false');};
  try{
    await import('../../dist/app/main.js');assert.equal(el('continue').hidden,true);
    click('new');assert.equal(el('game').hidden,false);assert.equal(saved().session.game.stats.moves,0);
    const move=Game.restore(saved().session.game).hint();
    for(const [x,y] of [move.from,move.to]){pointer('pointerdown',(x+.5)*64,(y+.5)*64);pointer('pointerup',(x+.5)*64,(y+.5)*64);}
    assert.equal(saved().session.game.stats.moves,1);assert.equal(el('board').getAttribute('aria-busy'),'true');
    await new Promise(resolve=>setImmediate(resolve));click('pause');assert.equal(el('pause-dialog').open,true);
    const frozen=draws;frames.splice(0).forEach(fn=>fn(frameTime+=100));assert.equal(draws,frozen);assert.equal(el('restart').disabled,true);
    click('resume');await drain();assert.equal(el('moves').textContent,'1');
    click('pause');click('restart');assert.equal(el('confirm-dialog').open,true);click('cancel-new');assert.equal(saved().session.game.stats.moves,1);
    click('pause-settings');el('language').value='en';el('language').dispatchEvent(new Event('change'));el('symbols').checked=true;el('symbols').dispatchEvent(new Event('change'));assert.equal(saved().settings.language,'en');assert.equal(saved().settings.symbols,true);
    click('settings-close');assert.equal(el('pause-dialog').open,true);click('resume');click('results');assert.equal(el('result').hidden,false);click('result-continue');assert.equal(el('moves').textContent,'1');
    const best=saved().best;assert.ok(best>0);click('pause');click('to-menu');click('new');click('confirm-new');assert.equal(saved().session.game.stats.moves,0);assert.equal(saved().best,best);
  }finally{for(const [key,descriptor] of original){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
