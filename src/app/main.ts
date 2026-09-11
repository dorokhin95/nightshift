import { restoreEndlessBackup } from './EndlessBackup.js';
import { Game, cloneBoard, indexOf, isPosition, swapCells, type Move, type BoardEvent } from '../game/core/index.js';
import { BoardRenderer } from '../demo/BoardRenderer.js';
import { AudioService } from '../demo/AudioService.js';
import { MusicService } from './MusicService.js';
import { StorageService } from './StorageService.js';
import { localize, t, language } from './i18n.js';
const el=<T extends HTMLElement=HTMLElement>(id:string):T=>document.getElementById(id) as T;
const dialog=(id:string):HTMLDialogElement=>el<HTMLDialogElement>(id+'-dialog');
await restoreEndlessBackup();
const storage=new StorageService({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
const profile=storage.load();
let allowWrite=!storage.error;
function localStorageAvailableProfile():boolean{try{return localStorage.getItem(StorageService.key)!==null;}catch{return false;}}
if(!profile.session && !storage.error && !localStorageAvailableProfile() && matchMedia('(prefers-reduced-motion: reduce)').matches)profile.settings.reduced=true;
let game=profile.session?Game.restore(profile.session.game):new Game(20260910);
let elapsed=profile.session?.elapsed??0;
let screen:'menu'|'game'|'result'='menu';
let selected:number|null=null;let cursor=0;let busy=false;let lastInput=performance.now();let lastTick=performance.now();
const canvas=el<HTMLCanvasElement>('board');const renderer=new BoardRenderer(canvas);const audio=new AudioService();const music=new MusicService();
let shown=game.board;
const fmt=(n:number):string=>n.toLocaleString(language==='ru'?'ru-RU':'en-US');
const clock=(ms:number):string=>{const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;};
const modalOpen=():boolean=>['pause','settings','confirm'].some(id=>dialog(id).open);
function interactive():boolean{return screen==='game'&&!modalOpen()&&!document.hidden;}
function warning():void{el('storage-warning').hidden=!storage.error;el('storage-warning').textContent=t('saveError');}
function persist():void{if(!allowWrite){warning();return;}if(profile.session)profile.session={game:game.snapshot(),elapsed};profile.best=Math.max(profile.best,profile.session?.game.score??0);storage.save(profile);warning();}
function hud():void{
  el('score').textContent=fmt(game.score);el('moves').textContent=fmt(game.stats.moves);el('best').textContent=fmt(profile.best);el('menu-best').textContent=fmt(profile.best);el('time').textContent=clock(elapsed);
  el<HTMLButtonElement>('continue').hidden=!profile.session;
  el('saved-info').textContent=profile.session?`${t('saved')} · ${fmt(game.score)} · ${fmt(game.stats.moves)} ${t('moves').toLowerCase()}`:t('noSave');
  el<HTMLButtonElement>('restart').disabled=busy;el<HTMLButtonElement>('to-menu').disabled=busy;
  el<HTMLButtonElement>('hint').disabled=busy;el<HTMLButtonElement>('results').disabled=busy;
  canvas.setAttribute('aria-busy',String(busy));canvas.setAttribute('aria-label',t('board'));
}
function syncActivity():void{
  const active=interactive();renderer.paused=!active;lastTick=performance.now();
  if(active){game.resume();void audio.unlock();void music.start();}else{game.pause();void audio.suspend();music.stop();}
}
function show(next:typeof screen):void{
  screen=next;for(const id of ['menu','game','result'])el(id).hidden=id!==next;
  el('header-settings').hidden=next==='game';syncActivity();hud();if(next==='game'){renderer.draw(shown);canvas.focus();}else el<HTMLButtonElement>(next==='menu'?(profile.session?'continue':'new'):'result-continue').focus();
}
function tick():void{const now=performance.now();if(interactive())elapsed+=Math.max(0,now-lastTick);lastTick=now;}
function pause():void{
  if(screen!=='game'||modalOpen())return;tick();dialog('pause').showModal();syncActivity();persist();el('pause-info').textContent=storage.error?t('saveError'):t('pauseInfo');
}
function resume():void{dialog('pause').close();syncActivity();lastInput=performance.now();canvas.focus();}
function newGame():void{
  allowWrite=true;game=new Game(crypto.getRandomValues(new Uint32Array(1))[0]!);elapsed=0;shown=game.board;selected=null;cursor=0;renderer.selected=null;renderer.hints=[];
  profile.session={game:game.snapshot(),elapsed};persist();el('status').textContent=t('ready');show('game');
}
function requestNew():void{if(busy)return;if(profile.session){dialog('confirm').showModal();syncActivity();}else newGame();}
function hint():void{if(busy||!interactive())return;const move=game.hint();renderer.hints=move?[indexOf(game.board,move.from),indexOf(game.board,move.to)]:[];renderer.draw(shown);lastInput=performance.now();}
async function waitActive():Promise<void>{while(!interactive())await new Promise<void>(resolve=>setTimeout(resolve,70));}
async function play(event:BoardEvent):Promise<void>{await waitActive();audio.play(event);await renderer.animate(shown,event);shown=cloneBoard(event.board);}
async function perform(move:Move):Promise<void>{
  if(busy||!interactive())return;
  busy=true;selected=null;renderer.selected=null;renderer.hints=[];lastInput=performance.now();hud();
  void audio.unlock();
  try{
    const result=game.swap(move);
    if(!result.accepted){
      audio.invalid();if(result.reason==='no-match'){const attempted=cloneBoard(game.board);swapCells(attempted,indexOf(attempted,move.from),indexOf(attempted,move.to));await renderer.animate(game.board,{type:'swap',board:attempted,move});await renderer.animate(attempted,{type:'swap',board:game.board,move});}
      el('status').textContent=t('invalid');
    }else{
      // Core resolution is atomic and already complete. Save its stable final board before visual playback.
      persist();if(profile.settings.vibration && navigator.vibrate)navigator.vibrate(12);
      for(const event of result.events)await play(event);
      el('status').textContent=`+${fmt(result.scoreDelta)} · ${result.cascades>1?t('cascade')+' '+result.cascades+' · ':''}${result.events.some(e=>e.type==='shuffle')?t('shuffled'):t('next')}`;
    }
  }catch{el('status').textContent=t('failed');}
  finally{shown=game.board;renderer.draw(shown);busy=false;hud();lastInput=performance.now();}
}
function choose(index:number):void{
  if(busy||!interactive())return;lastInput=performance.now();
  if(selected===index){selected=null;}else if(selected===null){selected=index;}else{
    const from:[number,number]=[selected%game.board.width,Math.floor(selected/game.board.width)];const to:[number,number]=[index%game.board.width,Math.floor(index/game.board.width)];
    if(Math.abs(from[0]-to[0])+Math.abs(from[1]-to[1])===1){void perform({from,to});return;}selected=index;
  }renderer.selected=selected;renderer.hints=[];renderer.draw(shown);
}
function cell(e:PointerEvent):number|null{const r=canvas.getBoundingClientRect();const pos:[number,number]=[Math.floor((e.clientX-r.left)/r.width*game.board.width),Math.floor((e.clientY-r.top)/r.height*game.board.height)];return isPosition(game.board,pos)?indexOf(game.board,pos):null;}
let down:{id:number;index:number;x:number;y:number}|null=null;
canvas.addEventListener('pointerdown',e=>{if(busy||!interactive()||!e.isPrimary||e.button!==0)return;const index=cell(e);if(index===null)return;down={id:e.pointerId,index,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);e.preventDefault();});
canvas.addEventListener('pointerup',e=>{if(!down||down.id!==e.pointerId)return;const start=down;down=null;if(busy||!interactive())return;
  const dx=e.clientX-start.x,dy=e.clientY-start.y;const threshold=canvas.getBoundingClientRect().width/game.board.width*.25;
  if(Math.max(Math.abs(dx),Math.abs(dy))>threshold){const from:[number,number]=[start.index%game.board.width,Math.floor(start.index/game.board.width)];const to:[number,number]=Math.abs(dx)>Math.abs(dy)?[from[0]+Math.sign(dx),from[1]]:[from[0],from[1]+Math.sign(dy)];if(isPosition(game.board,to))void perform({from,to});}else choose(start.index);
});
canvas.addEventListener('pointercancel',()=>{down=null;});
canvas.addEventListener('keydown',e=>{
  if(busy||!interactive())return;const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-game.board.width,ArrowDown:game.board.width};
  if(e.key in offsets){e.preventDefault();const x=cursor%game.board.width;if(e.key==='ArrowLeft'&&x===0||e.key==='ArrowRight'&&x===game.board.width-1)return;cursor=Math.max(0,Math.min(game.board.cells.length-1,cursor+offsets[e.key]!));renderer.hints=[cursor];renderer.draw(shown);lastInput=performance.now();}
  if(e.key===' '||e.key==='Enter'){e.preventDefault();choose(cursor);}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&screen==='game'&&!modalOpen()){e.preventDefault();pause();}});
function results():void{
  if(busy)return;tick();persist();el('result-score').textContent=fmt(game.score);
  const stats:[string,string][]=[['moves',fmt(game.stats.moves)],['maxCascade',fmt(game.stats.maxCascade)],['created',fmt(game.stats.specialsCreated)],['activated',fmt(game.stats.specialsActivated)],['combos',fmt(game.stats.specialCombos)],['removed',fmt(game.stats.removed)],['duration',clock(elapsed)]];
  el('statistics').replaceChildren(...stats.map(([key,value])=>{const row=document.createElement('div');const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=t(key);dd.textContent=value;row.append(dt,dd);return row;}));show('result');
}
function applySettings():void{
  const s=profile.settings;localize(s.language);renderer.reduced=s.reduced;renderer.symbols=s.symbols;renderer.economical=s.quality==='low'||s.quality==='auto'&&matchMedia('(max-width: 650px)').matches;
  audio.volume=s.master*s.effects/10000;audio.enabled=audio.volume>0;music.volume=s.master*s.music/10000;
  for(const key of ['master','music','effects'] as const){el<HTMLInputElement>(key).value=String(s[key]);el(key+'-value').textContent=s[key]+'%';}
  for(const key of ['vibration','hints','reduced','symbols'] as const)el<HTMLInputElement>(key).checked=s[key];
  el<HTMLSelectElement>('quality').value=s.quality;el<HTMLSelectElement>('language').value=s.language;
  renderer.draw(shown);hud();warning();el('status').textContent=t('ready');if(screen==='result')results();
}
let settingsFromPause=false;
function openSettings():void{if(screen==='game'&&!dialog('pause').open)pause();settingsFromPause=dialog('pause').open;if(settingsFromPause)dialog('pause').close();dialog('settings').showModal();syncActivity();}
function closeSettings():void{dialog('settings').close();if(settingsFromPause)dialog('pause').showModal();syncActivity();}
for(const key of ['master','music','effects'] as const)el(key).addEventListener('input',()=>{profile.settings[key]=Number(el<HTMLInputElement>(key).value);applySettings();persist();});
for(const key of ['vibration','hints','reduced','symbols'] as const)el(key).addEventListener('change',()=>{profile.settings[key]=el<HTMLInputElement>(key).checked;applySettings();persist();});
el('quality').addEventListener('change',()=>{profile.settings.quality=el<HTMLSelectElement>('quality').value as typeof profile.settings.quality;applySettings();persist();});
el('language').addEventListener('change',()=>{profile.settings.language=el<HTMLSelectElement>('language').value as typeof language;applySettings();persist();});
el('new').onclick=requestNew;el('restart').onclick=requestNew;
el('confirm-new').onclick=()=>{dialog('confirm').close();dialog('pause').close();newGame();};
el('cancel-new').onclick=()=>{dialog('confirm').close();syncActivity();};
dialog('confirm').addEventListener('cancel',e=>{e.preventDefault();dialog('confirm').close();syncActivity();});
el('continue').onclick=()=>show('game');el('result-continue').onclick=()=>show('game');el('pause').onclick=pause;el('resume').onclick=resume;
dialog('pause').addEventListener('cancel',e=>{e.preventDefault();resume();});
el('hint').onclick=hint;el('results').onclick=results;
function menu():void{if(busy)return;persist();dialog('pause').close();show('menu');}
el('to-menu').onclick=menu;el('result-menu').onclick=menu;
el('header-settings').onclick=openSettings;el('pause-settings').onclick=openSettings;el('settings-close').onclick=closeSettings;
dialog('settings').addEventListener('cancel',e=>{e.preventDefault();closeSettings();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){tick();if(screen==='game'&&!modalOpen())pause();persist();syncActivity();}});
window.addEventListener('pagehide',()=>{tick();persist();music.stop();});
setInterval(()=>{tick();el('time').textContent=clock(elapsed);if(!busy&&interactive()&&profile.settings.hints&&performance.now()-lastInput>10000)hint();},250);
applySettings();show('menu');
