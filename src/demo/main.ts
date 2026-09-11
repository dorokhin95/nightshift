import { Game, cloneBoard, indexOf, isPosition, swapCells, type Move, type Save, type BoardEvent } from '../game/core/index.js';
import { BoardRenderer } from './BoardRenderer.js';
import { AudioService } from './AudioService.js';
interface Fixture { id: string; kind: string; save: Save; move: Move }
const element = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id); if (!el) throw new Error(`Missing element ${id}`); return el as T;
};
const labels: Record<string, [string, string]> = {
  free: ['Обычное поле', 'Собирай одинаковые предметы. Ракеты и бомбы срабатывают в совпадении или от другого взрыва.'],
  'create-rocket-h': ['Создать ракету →', 'Собери четыре фишки в горизонтальную линию. Ракета останется на поле и очистит строку при активации.'],
  'create-rocket-v': ['Создать ракету ↑', 'Четыре фишки в столбце создают вертикальную ракету.'],
  'create-bomb': ['Создать бомбу', 'Совмести две линии в T- или L-образную комбинацию. На поле появится бомба.'],
  'create-lightning': ['Создать молнию', 'Пять в прямую линию создают молнию. Поменяй её с предметом, чтобы убрать все предметы этого типа.'],
  'rocket-rocket': ['Ракета + ракета', 'Две ракеты создают крест: строка и столбец через клетку назначения.'],
  'rocket-bomb': ['Ракета + бомба', 'Одновременно очищаются три соседние строки и три столбца.'],
  'bomb-bomb': ['Бомба + бомба', 'Большой взрыв радиусом четыре клетки вокруг места соединения.'],
  'lightning-tile': ['Молния + предмет', 'Все предметы того же типа, что и сосед молнии, исчезнут с поля.'],
  'lightning-rocket': ['Молния + ракета', 'Предметы выбранного типа превратятся в ракеты и запустятся один за другим.'],
  'lightning-bomb': ['Молния + бомба', 'Предметы выбранного типа превратятся в бомбы. Приготовься к цепной реакции.'],
  'lightning-lightning': ['Молния + молния', 'Разряд по всему полю. Остальные спецэлементы тоже сработают.'],
};
const canvas = element<HTMLCanvasElement>('board');
const renderer = new BoardRenderer(canvas); const audio = new AudioService();
const scenario = element<HTMLSelectElement>('scenario');
const status = element('status');
const actionButtons = ['hint','restart','demonstrate'].map(id => element<HTMLButtonElement>(id));
let game = new Game(20260910); let initial = game.snapshot(); let fixtures: Fixture[] = [];
let busy = true; let selected: number | null = null; let cursor = 0; let lastInput = Date.now();
let shown = game.board; let presetMove: Move | null = null;
function setBusy(value: boolean): void {
  busy = value; scenario.disabled = value;
  actionButtons.forEach(button => { button.disabled = value; });
  element<HTMLButtonElement>('demonstrate').disabled = value || presetMove === null;
  canvas.setAttribute('aria-busy', String(value));
}
function hud(): void {
  element('score').textContent = game.score.toLocaleString('ru-RU');
  element('moves').textContent = String(game.stats.moves);
  element('specials').textContent = String(game.stats.specialsCreated);
}
function showHint(move: Move | null): void {
  renderer.hints = move ? [indexOf(game.board,move.from),indexOf(game.board,move.to)] : [];
  renderer.draw(shown);
}
function load(id: string): void {
  if (busy) return;
  const fixture = fixtures.find(f => f.id === id);
  game = fixture ? Game.restore(fixture.save) : new Game(crypto.getRandomValues(new Uint32Array(1))[0]!);
  initial = game.snapshot(); shown = game.board; selected = null; renderer.selected = null; presetMove = fixture?.move ?? null;
  scenario.value = id; element('description').textContent = labels[id]?.[1] ?? '';
  hud(); showHint(presetMove); setBusy(false); lastInput = Date.now();
  status.textContent = presetMove ? 'Подсвеченные фишки готовы. Соедини их или нажми «Выполнить показанный ход».' : 'Твоя смена. Собери три одинаковых предмета.';
}
async function nextVisible(): Promise<void> {
  if (!document.hidden) return;
  await new Promise<void>(resolve => {
    const handler = (): void => { if (!document.hidden) { document.removeEventListener('visibilitychange',handler); resolve(); } };
    document.addEventListener('visibilitychange',handler);
  });
}
async function play(event: BoardEvent): Promise<void> {
  await nextVisible(); audio.play(event); await renderer.animate(shown,event); shown=cloneBoard(event.board);
}
async function perform(move: Move): Promise<boolean> {
  if (busy || document.hidden) return false;
  setBusy(true); selected=null;renderer.selected=null;renderer.hints=[];lastInput=Date.now();
  await audio.unlock();
  try {
    const result=game.swap(move);
    if (!result.accepted) {
      audio.invalid();
      if (result.reason==='no-match') {
        const attempted=cloneBoard(game.board);swapCells(attempted,indexOf(attempted,move.from),indexOf(attempted,move.to));
        await renderer.animate(game.board,{type:'swap',board:attempted,move});
        await renderer.animate(attempted,{type:'swap',board:game.board,move});
      }
      renderer.draw(game.board);status.textContent='Здесь нет комбинации. Попробуй другую соседнюю фишку.';return false;
    }
    const startScore=game.score-result.scoreDelta;let shownScore=startScore;
    for(const event of result.events){
      if(event.type==='combo')status.textContent=(labels[event.name.replaceAll('+','-')]?.[0] ?? 'Комбинация')+'!';
      await play(event);
      if(event.type==='clear'){shownScore+=event.points;element('score').textContent=shownScore.toLocaleString('ru-RU');}
    }
    shown=game.board;renderer.draw(shown);hud();presetMove=null;
    const combo=result.events.find(e=>e.type==='combo');
    status.textContent=`${combo?.type==='combo'?(labels[combo.name.replaceAll('+','-')]?.[0] ?? 'Комбинация')+' · ':''}+${result.scoreDelta.toLocaleString('ru-RU')} очков${result.cascades>1?' · Каскад '+result.cascades:''}. Следующий ход!`;
    return true;
  } catch {
    shown=game.board;renderer.draw(shown);hud();status.textContent='Не удалось завершить показ. Поле доступно — попробуй ещё раз.';return false;
  } finally { setBusy(false); }
}
function choose(index:number):void {
  if(busy)return;lastInput=Date.now();
  if(selected===null){selected=index;renderer.selected=index;renderer.draw(shown);return;}
  if(selected===index){selected=null;renderer.selected=null;renderer.draw(shown);return;}
  const from:[number,number]=[selected%game.board.width,Math.floor(selected/game.board.width)];
  const to:[number,number]=[index%game.board.width,Math.floor(index/game.board.width)];
  if(Math.abs(from[0]-to[0])+Math.abs(from[1]-to[1])!==1){selected=index;renderer.selected=index;renderer.draw(shown);return;}
  void perform({from,to});
}
function pointerCell(e:PointerEvent):number|null {
  const rect=canvas.getBoundingClientRect();const p:[number,number]=[Math.floor((e.clientX-rect.left)/rect.width*game.board.width),Math.floor((e.clientY-rect.top)/rect.height*game.board.height)];
  return isPosition(game.board,p)?indexOf(game.board,p):null;
}
let down:{id:number;index:number;x:number;y:number}|null=null;
canvas.addEventListener('pointerdown',e=>{
  if(busy || !e.isPrimary || e.button!==0)return;const index=pointerCell(e);if(index===null)return;
  down={id:e.pointerId,index,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);e.preventDefault();
});
canvas.addEventListener('pointerup',e=>{
  if(!down || down.id!==e.pointerId)return;const start=down;down=null;
  const dx=e.clientX-start.x;const dy=e.clientY-start.y;const threshold=canvas.getBoundingClientRect().width/game.board.width*0.25;
  if(Math.max(Math.abs(dx),Math.abs(dy))>threshold){
    const from:[number,number]=[start.index%game.board.width,Math.floor(start.index/game.board.width)];
    const to:[number,number]=Math.abs(dx)>Math.abs(dy)?[from[0]+Math.sign(dx),from[1]]:[from[0],from[1]+Math.sign(dy)];
    if(isPosition(game.board,to))void perform({from,to});
  }else choose(start.index);
});
canvas.addEventListener('pointercancel',()=>{down=null;});
canvas.addEventListener('keydown',e=>{
  if(busy)return;
  const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-game.board.width,ArrowDown:game.board.width};
  if(e.key in offsets){
    e.preventDefault();const x=cursor%game.board.width;
    if(e.key==='ArrowLeft'&&x===0 || e.key==='ArrowRight'&&x===game.board.width-1)return;
    cursor=Math.max(0,Math.min(game.board.cells.length-1,cursor+offsets[e.key]!));
    renderer.hints=[cursor];renderer.draw(shown);lastInput=Date.now();
  }else if(e.key===' '||e.key==='Enter'){e.preventDefault();choose(cursor);}
  else if(e.key==='Escape'){selected=null;renderer.selected=null;renderer.draw(shown);}
});
element('hint').addEventListener('click',()=>{showHint(game.hint());lastInput=Date.now();});
element('restart').addEventListener('click',()=>{
  if(busy)return;game=Game.restore(initial);shown=game.board;selected=null;renderer.selected=null;
  presetMove=fixtures.find(f=>f.id===scenario.value)?.move ?? null;hud();showHint(presetMove);setBusy(false);status.textContent='Поле восстановлено. Попробуем ещё раз.';
});
element('demonstrate').addEventListener('click',()=>{if(presetMove)void perform(presetMove);});
scenario.addEventListener('change',()=>load(scenario.value));
const sound=element<HTMLInputElement>('sound');sound.addEventListener('change',()=>{audio.enabled=sound.checked;if(sound.checked)void audio.unlock();else void audio.suspend();});
element<HTMLInputElement>('volume').addEventListener('input',e=>{audio.volume=Number((e.target as HTMLInputElement).value)/100;});
const reduced=element<HTMLInputElement>('reduced');reduced.checked=matchMedia('(prefers-reduced-motion: reduce)').matches;renderer.reduced=reduced.checked;
reduced.addEventListener('change',()=>{renderer.reduced=reduced.checked;if(!busy)renderer.draw(shown);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){game.pause();void audio.suspend();}else{game.resume();void audio.unlock();}});
setInterval(()=>{if(!busy && !document.hidden && Date.now()-lastInput>10000){showHint(game.hint());lastInput=Date.now();}},1000);
renderer.draw(shown);
try {
  const response=await fetch(new URL('../fixtures.json',import.meta.url));
  if(!response.ok)throw new Error('Scenarios unavailable');fixtures=await response.json() as Fixture[];
  for(const fixture of fixtures){const option=document.createElement('option');option.value=fixture.id;option.textContent=labels[fixture.id]?.[0] ?? fixture.id;scenario.append(option);}
  setBusy(false);load('rocket-bomb');
} catch {setBusy(false);load('free');status.textContent='Сценарии не загрузились. Обычное поле доступно.';}
// Optional page-scoped WebMCP; shares exactly the visible actions and input lock.
interface ModelContext { registerTool(tool:{name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown},options:{signal:AbortSignal}):void|Promise<void> }
const context=(document as Document & {modelContext?:ModelContext}).modelContext;
if(context?.registerTool){
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  const register=(tool:Parameters<ModelContext['registerTool']>[0]):void=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>undefined);}catch{/* Optional API: ordinary input remains available. */}};
  register({name:'read_match3_board',description:'Read visible match-3 state and available lab scenarios.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({board:game.board,score:game.score,busy,scenario:scenario.value,scenarios:['free',...fixtures.map(f=>f.id)]})});
  register({name:'load_match3_scenario',description:'Replace the current unsaved lab board with the named scenario.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{
    if(!input || typeof input!=='object' || !('id' in input) || typeof input.id!=='string' || !(input.id==='free'||fixtures.some(f=>f.id===input.id)))throw new Error('Invalid scenario');
    if(busy)throw new Error('Animation is still playing');load(input.id);return {scenario:scenario.value,score:game.score};
  }});
  register({name:'swap_match3_tiles',description:'Swap adjacent cells and wait for all animations. Coordinates are zero-based [column,row].',inputSchema:{type:'object',properties:{from:{type:'array',items:{type:'integer'},minItems:2,maxItems:2},to:{type:'array',items:{type:'integer'},minItems:2,maxItems:2}},required:['from','to'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{
    if(!input||typeof input!=='object'||!('from' in input)||!('to' in input)||!isPosition(game.board,input.from)||!isPosition(game.board,input.to))throw new Error('Invalid coordinates');
    if(busy)throw new Error('Animation is still playing');const accepted=await perform({from:input.from,to:input.to});return {accepted,score:game.score,board:game.board};
  }});
}
