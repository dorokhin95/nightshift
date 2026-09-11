import { DEFAULT_CONFIG } from '../config/balance.js';
import { cloneBoard, indexOf, swapCells } from '../game/core/Board.js';
import { generateBoard } from '../game/core/BoardGenerator.js';
import { findPossibleMoves, isLegalMove } from '../game/core/MoveValidator.js';
import { findMatches, uniqueMatchedCells } from '../game/core/MatchFinder.js';
import { expandSpecials, resolveCombination } from '../game/core/SpecialResolver.js';
import { planSpecials } from '../game/core/SpecialFactory.js';
import { isSpecial, tileColor, tileKind, makeTile, isValidTile } from '../game/core/Tile.js';
import { Rng } from '../game/core/Rng.js';
import type { Board, BoardEvent, Move, Statistics } from '../game/core/types.js';
export type Obstacle='ice'|'box'|'sauce'|'tray'|'chain';
export interface Goal { type:'score'|'collect'|'obstacles'|'delivery'|'specials'; target:number; color?:number }
export interface LevelData { id:number; mode:'mission'|'puzzle'; title:string; titleEn:string; seed:number; moves:number; stars:[number,number]; goals:Goal[]; obstacles:{index:number;type:Obstacle;hp:number}[]; holes:number[]; deliveries:number[]; solution?:Move[] }
export interface LevelSave { version:1; data:LevelData; board:Board; rng:number; moves:number; score:number; collected:number[]; destroyed:number; delivered:number; blockers:LevelData['obstacles']; parcels:number[]; stats:Statistics }
export function validateLevel(input:unknown):LevelData{
  const d=input as LevelData;
  if(!d||!Number.isInteger(d.id)||d.id<1||!['mission','puzzle'].includes(d.mode)||!Number.isInteger(d.seed)||d.seed<0||d.seed>0xffffffff||!Number.isInteger(d.moves)||d.moves<1||d.moves>100||typeof d.title!=='string'||typeof d.titleEn!=='string')throw Error('Invalid level');
  if(!Array.isArray(d.goals)||!d.goals.length||d.goals.some(g=>!['score','collect','obstacles','delivery','specials'].includes(g.type)||!Number.isInteger(g.target)||g.target<1||g.type==='collect'&&(!Number.isInteger(g.color)||g.color!<0||g.color!>5)))throw Error('Invalid goals');
  if(!Array.isArray(d.stars)||d.stars.length!==2||d.stars.some(n=>!Number.isInteger(n)||n<0)||d.stars[1]<d.stars[0])throw Error('Invalid stars');
  const valid=(n:number):boolean=>Number.isInteger(n)&&n>=0&&n<64;
  if(!Array.isArray(d.holes)||!Array.isArray(d.deliveries)||!Array.isArray(d.obstacles)||[...d.holes,...d.deliveries].some(n=>!valid(n))||d.obstacles.some(o=>!valid(o.index)||!['ice','box','sauce','tray','chain'].includes(o.type)||!Number.isInteger(o.hp)||o.hp<1||o.hp>3))throw Error('Invalid terrain');
  if(new Set(d.obstacles.map(o=>o.index)).size!==d.obstacles.length||new Set(d.holes).size!==d.holes.length||d.obstacles.some(o=>d.holes.includes(o.index))||d.deliveries.some(i=>d.holes.includes(i)||d.obstacles.some(o=>o.index===i)))throw Error('Overlapping terrain');
  return structuredClone(d);
}
export class Level {
  readonly data:LevelData; board:Board; private rng:Rng;
  moves=0;score=0;collected=Array<number>(6).fill(0);destroyed=0;delivered=0;
  blockers:LevelData['obstacles'];parcels:number[];
  stats:Statistics={moves:0,removed:0,maxCascade:0,shuffles:0,specialsCreated:0,specialsActivated:0,specialCombos:0};
  constructor(data:LevelData){this.data=validateLevel(data);this.rng=new Rng(data.seed);this.board=generateBoard(DEFAULT_CONFIG,this.rng);this.blockers=structuredClone(data.obstacles);this.parcels=[...data.deliveries];for(const i of [...data.holes,...this.blockers.filter(o=>o.type==='box'||o.type==='tray').map(o=>o.index),...this.parcels])this.board.cells[i]=null;if(!this.hint())this.shuffle();}
  get remaining():number{return this.data.moves-this.moves;}
  value(g:Goal):number{return g.type==='score'?this.score:g.type==='collect'?this.collected[g.color!]!:g.type==='obstacles'?this.destroyed:g.type==='delivery'?this.delivered:this.stats.specialsCreated;}
  get won():boolean{return this.data.goals.every(g=>this.value(g)>=g.target);}
  get over():boolean{return this.won||this.remaining<=0;}
  get stars():number{return !this.won?0:1+Number(this.score>=this.data.stars[0])+Number(this.score>=this.data.stars[1]);}
  private solid(i:number):boolean{return this.data.holes.includes(i)||this.blockers.some(o=>o.index===i&&(o.type==='box'||o.type==='tray'));}
  private locked(i:number):boolean{return this.solid(i)||this.blockers.some(o=>o.index===i&&o.type==='chain')||this.parcels.includes(i);}
  hint():Move|null{return findPossibleMoves(this.board).find(m=>!this.locked(indexOf(this.board,m.from))&&!this.locked(indexOf(this.board,m.to)))??null;}
  private gravity():void{
    const parcels=new Set(this.parcels);const nextParcels:number[]=[];
    for(let x=0;x<8;x++){
      let bottom=7;
      while(bottom>=0){if(this.solid(bottom*8+x)||this.blockers.some(o=>o.index===bottom*8+x&&o.type==='chain')){bottom--;continue;}
        let top=bottom;while(top>=0&&!this.solid(top*8+x)&&!this.blockers.some(o=>o.index===top*8+x&&o.type==='chain'))top--;
        const items:{tile:number|null;parcel:boolean}[]=[];
        for(let y=bottom;y>top;y--){const i=y*8+x;if(this.board.cells[i]!==null||parcels.has(i))items.push({tile:this.board.cells[i]!,parcel:parcels.has(i)});this.board.cells[i]=null;}
        let target=bottom;
        for(const item of items){if(item.parcel&&target===7){this.delivered++;continue;}const i=target--*8+x;this.board.cells[i]=item.tile;if(item.parcel)nextParcels.push(i);}
        bottom=top-1;
      }
    }this.parcels=nextParcels;
  }
  private spawn():void{for(let y=7;y>=0;y--)for(let x=0;x<8;x++){const i=y*8+x;if(this.board.cells[i]===null&&!this.solid(i)&&!this.parcels.includes(i))this.board.cells[i]=this.rng.integer(6);}}
  shuffle():void{
    const indices=this.board.cells.map((t,i)=>t!==null&&!isSpecial(t)&&!this.locked(i)?i:-1).filter(i=>i>=0);
    const initial=cloneBoard(this.board);
    for(let attempt=0;attempt<1000;attempt++){for(let j=indices.length-1;j>0;j--)swapCells(this.board,indices[j]!,indices[this.rng.integer(j+1)]!);if(!findMatches(this.board).length&&this.hint()){this.stats.shuffles++;return;}}
    this.board=initial;throw Error('No playable shuffle');
  }
  private damage(indices:number[],events:BoardEvent[]):void{
    const direct=new Set(indices);for(const e of events)if(e.type==='special-activated'||e.type==='combo')for(const i of e.targets)direct.add(i);
    this.blockers=this.blockers.filter(o=>{const near=indices.some(i=>Math.abs(i%8-o.index%8)+Math.abs(Math.floor(i/8)-Math.floor(o.index/8))===1);const hit=direct.has(o.index)||['box','tray','sauce'].includes(o.type)&&near;if(hit)o.hp--;if(o.hp<=0){this.destroyed++;return false;}return true;});
  }
  private resolve(swapped?:readonly[number,number],forced?:number[]):BoardEvent[]{
    const events:BoardEvent[]=[];let cascade=0;
    let combo=swapped&&this.board.cells[swapped[0]]!==null&&this.board.cells[swapped[1]]!==null&&(tileKind(this.board.cells[swapped[0]]!)==='lightning'||tileKind(this.board.cells[swapped[1]]!)==='lightning'||swapped.every(i=>isSpecial(this.board.cells[i])));
    while(true){const matches=findMatches(this.board);if(!matches.length&&!combo&&!forced)break;if(++cascade>100)throw Error('Cascade limit');
      let indices:number[];let effect:BoardEvent[]=[];let bonus=0;
      if(combo&&swapped){const blast=resolveCombination(this.board,swapped[0],swapped[1],DEFAULT_CONFIG);indices=blast.indices;effect=blast.events;this.board=blast.board;this.stats.specialsActivated+=blast.activated;this.stats.specialCombos++;bonus=DEFAULT_CONFIG.balance.specialComboBonus;combo=false;}
      else {const creations=forced?[]:planSpecials(this.board,matches,cascade===1?swapped:[]);const blast=expandSpecials(this.board,forced??uniqueMatchedCells(matches),DEFAULT_CONFIG,new Set(creations.map(c=>c.index)));indices=blast.indices;effect=blast.events;this.stats.specialsActivated+=blast.activated;for(const c of creations){this.board.cells[c.index]=c.tile;effect.push({type:'special-created',board:cloneBoard(this.board),index:c.index,kind:c.kind});this.stats.specialsCreated++;bonus+=DEFAULT_CONFIG.balance.specialCreateBonus;}forced=undefined;}
      this.damage([...new Set([...indices,...uniqueMatchedCells(matches)])],effect);indices=indices.filter(i=>this.board.cells[i]!==null&&!this.solid(i));
      for(const i of indices){const color=tileColor(this.board.cells[i]!);this.collected[color]=(this.collected[color]??0)+1;this.board.cells[i]=null;}
      const points=Math.round(indices.length*100*Math.min(3,1+(cascade-1)*.25))+bonus;this.score+=points;this.stats.removed+=indices.length;
      events.push(...effect,{type:'clear',board:cloneBoard(this.board),indices,cascade,points,multiplier:Math.min(3,1+(cascade-1)*.25)});
      this.gravity();events.push({type:'gravity',board:cloneBoard(this.board)});this.spawn();events.push({type:'spawn',board:cloneBoard(this.board)});
    }
    this.stats.maxCascade=Math.max(this.stats.maxCascade,cascade);
    if(!this.hint()&&!this.over){this.shuffle();events.push({type:'shuffle',board:cloneBoard(this.board)});}return events;
  }
  swap(move:Move):{accepted:boolean;events:BoardEvent[]}{
    if(this.over||!isLegalMove(this.board,move)||this.locked(indexOf(this.board,move.from))||this.locked(indexOf(this.board,move.to)))return {accepted:false,events:[]};
    const backup=this.snapshot();try{const a=indexOf(this.board,move.from),b=indexOf(this.board,move.to);swapCells(this.board,a,b);this.moves++;this.stats.moves=this.moves;const event:BoardEvent={type:'swap',board:cloneBoard(this.board),move};return {accepted:true,events:[event,...this.resolve([b,a])]};}catch(error){this.load(backup);throw error;}
  }
  boost(type:'opener'|'shuffle'|'recolor'|'rocket'|'bomb'|'lightning',index=0,color=0):BoardEvent[]{
    if(this.over||this.data.mode==='puzzle')throw Error('Boosters unavailable');const backup=this.snapshot();try{
      if(type==='shuffle'){this.shuffle();return [{type:'shuffle',board:cloneBoard(this.board)}];}
      if(!Number.isInteger(index)||index<0||index>63||this.data.holes.includes(index)||this.parcels.includes(index))throw Error('Invalid target');
      if(type==='opener'){const obstacle=this.blockers.find(o=>o.index===index);if(obstacle){obstacle.hp--;if(obstacle.hp<=0){this.blockers=this.blockers.filter(o=>o!==obstacle);this.destroyed++;}this.gravity();this.spawn();return this.resolve();}return this.resolve(undefined,[index]);}
      if(this.locked(index)||this.board.cells[index]===null)throw Error('Locked target');
      if(type==='recolor'){if(!Number.isInteger(color)||color<0||color>5)throw Error('Invalid color');this.board.cells[index]=color;}else{if(this.moves!==0)throw Error('Start booster only');this.board.cells[index]=makeTile(tileColor(this.board.cells[index]!),type==='rocket'?'rocket-h':type);}
      return this.resolve();
    }catch(error){this.load(backup);throw error;}
  }
  snapshot():LevelSave{return structuredClone({version:1,data:this.data,board:this.board,rng:this.rng.state,moves:this.moves,score:this.score,collected:this.collected,destroyed:this.destroyed,delivered:this.delivered,blockers:this.blockers,parcels:this.parcels,stats:this.stats});}
  private load(s:LevelSave):void{this.board=cloneBoard(s.board);this.rng=new Rng(s.rng);this.moves=s.moves;this.score=s.score;this.collected=[...s.collected];this.destroyed=s.destroyed;this.delivered=s.delivered;this.blockers=structuredClone(s.blockers);this.parcels=[...s.parcels];this.stats={...s.stats};}
  static restore(s:LevelSave):Level{
    if(!s||s.version!==1||!s.data||!Number.isInteger(s.moves)||s.moves<0||s.moves>s.data.moves||!Number.isSafeInteger(s.score)||s.score<0||!s.board||s.board.width!==8||s.board.height!==8||!Array.isArray(s.board.cells)||s.board.cells.length!==64)throw Error('Invalid level save');
    validateLevel(s.data);
    if(!Array.isArray(s.blockers)||!Array.isArray(s.parcels)||!Array.isArray(s.collected)||s.collected.length!==6||s.collected.some(n=>!Number.isSafeInteger(n)||n<0)||!Number.isInteger(s.destroyed)||s.destroyed<0||s.destroyed>s.data.obstacles.length||!Number.isInteger(s.delivered)||s.delivered<0||s.delivered>s.data.deliveries.length)throw Error('Invalid counters');
    const validIndex=(i:number):boolean=>Number.isInteger(i)&&i>=0&&i<64;
    if(new Set(s.parcels).size!==s.parcels.length||s.parcels.some(i=>!validIndex(i)||s.data.holes.includes(i))||s.parcels.length+s.delivered!==s.data.deliveries.length||new Set(s.blockers.map(o=>o.index)).size!==s.blockers.length||s.blockers.some(o=>!Number.isInteger(o.hp)||o.hp<1||!s.data.obstacles.some(initial=>initial.index===o.index&&initial.type===o.type&&initial.hp>=o.hp)))throw Error('Invalid terrain state');
    for(let i=0;i<64;i++){const empty=s.data.holes.includes(i)||s.parcels.includes(i)||s.blockers.some(o=>o.index===i&&(o.type==='box'||o.type==='tray'));if(empty?s.board.cells[i]!==null:!isValidTile(s.board.cells[i],6))throw Error('Invalid saved tile');}
    const level=new Level(s.data);if(!s.stats||Object.keys(level.stats).some(k=>!Number.isSafeInteger(s.stats[k as keyof Statistics])||s.stats[k as keyof Statistics]<0))throw Error('Invalid statistics');
    if(findMatches(s.board).length)throw Error('Unresolved save');level.load(s);return level;
  }
}
