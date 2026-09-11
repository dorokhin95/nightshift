import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  Game, Rng, DEFAULT_CONFIG, makeTile, tileKind, tileColor, matchColor, isValidTile,
  findMatches, findPossibleMoves, isLegalMove, planSpecials, specialTargets,
  expandSpecials, resolveCombination, resolveBoard, shuffleBoard, applyGravity, replay,
} from '../../dist/game/core/index.js';
const config = DEFAULT_CONFIG;
const fixtures = JSON.parse(readFileSync(new URL('../fixtures/specials.json', import.meta.url)));
const full = (w = 9, h = 9) => ({width:w,height:h,cells:Array.from({length:w*h},(_,i)=>(i%w+Math.floor(i/w))%6)});
const sorted = xs => [...new Set(xs)].sort((a,b)=>a-b);
const cross = (b,index,r=0) => b.cells.flatMap((_,i)=>Math.abs(i%b.width-index%b.width)<=r || Math.abs(Math.floor(i/b.width)-Math.floor(index/b.width))<=r ? [i]:[]);
const square = (b,index,r) => b.cells.flatMap((_,i)=>Math.abs(i%b.width-index%b.width)<=r && Math.abs(Math.floor(i/b.width)-Math.floor(index/b.width))<=r ? [i]:[]);

test('tile encoding preserves color and validates kind/color bounds',()=>{
  for(const kind of ['normal','rocket-h','rocket-v','bomb','lightning']) for(let color=0;color<6;color++){
    const t=makeTile(color,kind); assert.equal(tileKind(t),kind); assert.equal(tileColor(t),color); assert.ok(isValidTile(t,6));
  }
  for(const tile of [-1,80,16.5,NaN,Infinity,15]) assert.equal(isValidTile(tile,6),false);
  assert.throws(()=>makeTile(16)); assert.throws(()=>makeTile(0,'unknown'));
});
test('rockets and bombs match by color, lightning is never a wildcard',()=>{
  const b={width:3,height:1,cells:[makeTile(2,'rocket-h'),2,makeTile(2,'bomb')]};
  assert.equal(findMatches(b).length,1);
  b.cells[1]=makeTile(2,'lightning'); assert.equal(findMatches(b).length,0);
  assert.equal(matchColor(b.cells[1]),null);
});
for(const fixture of fixtures.filter(f=>f.id.startsWith('create-'))){
  test(`${fixture.id}: real legal move creates special, survives first clear, restores identically`,()=>{
    const game=Game.restore(fixture.save); const copy=Game.restore(fixture.save);
    assert.equal(findMatches(game.board).length,0);
    const result=game.swap(fixture.move); assert.equal(result.accepted,true);
    const event=result.events.find(e=>e.type==='special-created'&&e.kind===fixture.kind);
    assert.ok(event); assert.equal(tileKind(event.board.cells[event.index]),fixture.kind);
    const firstClear=result.events.find(e=>e.type==='clear'); assert.ok(!firstClear.indices.includes(event.index));
    assert.deepEqual(result,copy.swap(fixture.move)); assert.ok(game.stats.specialsCreated>=1);
    assert.deepEqual(Game.restore(game.snapshot()).snapshot(),game.snapshot());
  });
}
test('T and L create bombs and deduplicate intersection',()=>{
  for(const cells of [[1,1,1,2,1,3,3,1,2],[1,2,3,1,3,2,1,1,1]]){
    const b={width:3,height:3,cells}; const plans=planSpecials(b,findMatches(b));
    assert.equal(plans.length,1);assert.equal(plans[0].kind,'bomb');
  }
});
test('five-in-line takes priority over crossing bomb pattern',()=>{
  const b=full(5,5); for(const i of [10,11,12,13,14,2,7]) b.cells[i]=0;
  const plans=planSpecials(b,findMatches(b)); assert.equal(plans.length,1); assert.equal(plans[0].kind,'lightning');
});
test('separate four-runs create independently; destination wins anchor preference',()=>{
  const b={width:4,height:3,cells:[0,0,0,0,1,2,3,4,2,2,2,2]};
  const plans=planSpecials(b,findMatches(b),[3,9]); assert.equal(plans.length,2);
  assert.deepEqual(plans.map(p=>p.index),[3,9]);
});
for(const kind of ['rocket-h','rocket-v']){
  test(`${kind} destroys exactly its line`,()=>{
    const b=full();b.cells[40]=makeTile(2,kind);
    const expected=b.cells.flatMap((_,i)=>(kind==='rocket-h'?Math.floor(i/9)===4:i%9===4)?[i]:[]);
    assert.deepEqual(specialTargets(b,40,config),expected);
  });
}
test('bomb has radius two, clipped at corners',()=>{
  const b=full();b.cells[40]=makeTile(0,'bomb');assert.deepEqual(specialTargets(b,40,config),square(b,40,2));
  b.cells[0]=makeTile(0,'bomb');assert.equal(specialTargets(b,0,config).length,9);
});
test('blast-triggered lightning clears its retained color',()=>{
  const b=full();b.cells[40]=makeTile(2,'lightning');
  assert.deepEqual(specialTargets(b,40,config),b.cells.flatMap((t,i)=>tileColor(t)===2?[i]:[]));
});
test('chain reacts to specials outside the original match, activates each only once',()=>{
  const b=full();b.cells[40]=makeTile(0,'rocket-h');b.cells[42]=makeTile(1,'rocket-v');b.cells[24]=makeTile(2,'bomb');
  const result=expandSpecials(b,[40,40],config);
  assert.equal(result.activated,3); assert.equal(new Set(result.indices).size,result.indices.length);
  assert.equal(result.events.filter(e=>e.index===40).length,1);
  assert.ok(result.indices.includes(6));
});
test('newly created special is protected from same-wave blast',()=>{
  const b=full();b.cells[40]=makeTile(0,'rocket-h');b.cells[42]=makeTile(1,'bomb');
  const result=expandSpecials(b,[40],config,new Set([42]));
  assert.equal(result.activated,1); assert.ok(!result.indices.includes(42));
});
for(const [a,b] of [['rocket-h','rocket-h'],['rocket-v','rocket-v'],['rocket-h','rocket-v']]){
  test(`${a}+${b}: exact cross even with identical encoded tiles`,()=>{
    const field=full();field.cells[40]=makeTile(0,a);field.cells[41]=makeTile(0,b);
    assert.ok(isLegalMove(field,{from:[4,4],to:[5,4]}));
    const r=resolveCombination(field,40,41,config);
    assert.deepEqual(r.indices,cross(field,40));assert.equal(r.activated,2);
  });
}
for(const kinds of [['rocket-h','bomb'],['bomb','rocket-v']]){
  test(`${kinds.join('+')}: exactly three rows and three columns`,()=>{
    const b=full();b.cells[40]=makeTile(0,kinds[0]);b.cells[41]=makeTile(1,kinds[1]);
    assert.deepEqual(resolveCombination(b,40,41,config).indices,cross(b,40,1));
  });
}
test('bomb+bomb: increased square radius four',()=>{
  const b=full(11,11);b.cells[60]=makeTile(0,'bomb');b.cells[61]=makeTile(1,'bomb');
  assert.deepEqual(resolveCombination(b,60,61,config).indices,square(b,60,4));
});
for(const reversed of [false,true]){
  test(`lightning+ordinary targets partner color, reversed=${reversed}`,()=>{
    const b=full();b.cells[40]=makeTile(0,reversed?'normal':'lightning');b.cells[41]=makeTile(1,reversed?'lightning':'normal');
    const color=reversed?0:1;
    const expected=sorted([40,41,...b.cells.flatMap((t,i)=>tileColor(t)===color?[i]:[])]);
    const r=resolveCombination(b,40,41,config);assert.deepEqual(r.indices,expected);assert.equal(r.activated,1);
  });
}
for(const kind of ['rocket-h','rocket-v','bomb']){
  test(`lightning+${kind}: every partner-color tile transforms and fires`,()=>{
    const b=full();b.cells[40]=makeTile(0,'lightning');b.cells[41]=makeTile(1,kind);
    const originals=b.cells.flatMap((t,i)=>tileColor(t)===1 && i!==41?[i]:[]);
    const r=resolveCombination(b,40,41,config);
    const transform=r.events.find(e=>e.type==='transform');assert.deepEqual(transform.indices,originals);
    const activations=r.events.filter(e=>e.type==='special-activated');
    assert.deepEqual(sorted(activations.map(e=>e.index)),originals);
    for(const e of activations) assert.equal(kind==='bomb'?e.kind==='bomb':e.kind.startsWith('rocket'),true);
    assert.equal(r.activated,originals.length+2);
  });
}
test('lightning+lightning clears all board and triggers other specials once',()=>{
  const b=full();b.cells[40]=makeTile(0,'lightning');b.cells[41]=makeTile(0,'lightning');b.cells[0]=makeTile(2,'bomb');
  const r=resolveCombination(b,40,41,config);assert.equal(r.indices.length,81);assert.equal(r.activated,3);
});
for(const fixture of fixtures.filter(f=>f.kind==='combo')){
  test(`${fixture.id}: end-to-end transactional Game.swap + combo score + stable refill`,()=>{
    const game=Game.restore(fixture.save); const result=game.swap(fixture.move);
    assert.equal(result.accepted,true);assert.ok(result.events.some(e=>e.type==='combo'));
    assert.equal(game.stats.specialCombos,1);assert.ok(game.stats.specialsActivated>=1);
    assert.equal(result.scoreDelta,result.events.filter(e=>e.type==='clear').reduce((n,e)=>n+e.points,0));
    assert.equal(findMatches(game.board).length,0);assert.ok(findPossibleMoves(game.board,1).length);
    assert.deepEqual(Game.restore(game.snapshot()).snapshot(),game.snapshot());
  });
}
test('special creation bonus is added once and anchor is not counted as cleared',()=>{
  const fixture=fixtures.find(f=>f.id==='create-rocket-h');const game=Game.restore(fixture.save);
  const result=game.swap(fixture.move);const clear=result.events.find(e=>e.type==='clear');
  const before=result.events.slice(0,result.events.indexOf(clear));
  const creations=before.filter(e=>e.type==='special-created').length;
  assert.equal(clear.points,clear.indices.length*config.balance.tileScore+creations*config.balance.specialCreateBonus);
});
test('shuffle preserves special type and position plus ordinary multiset',()=>{
  const b=new Game(33).board;b.cells[5]=makeTile(b.cells[5],'bomb');b.cells[12]=makeTile(b.cells[12],'lightning');
  const out=shuffleBoard(b,new Rng(91),4096);
  assert.equal(out.cells[5],b.cells[5]);assert.equal(out.cells[12],b.cells[12]);
  assert.deepEqual([...out.cells].sort((a,b)=>a-b),[...b.cells].sort((a,b)=>a-b));
});
test('gravity transports full special encoding with the tile',()=>{
  const tile=makeTile(4,'lightning');const b={width:3,height:3,cells:[tile,null,null,null,null,null,null,null,null]};
  assert.equal(applyGravity(b).cells[6],tile);
});
test('v1 local saves migrate without losing board, RNG, score or original stats',()=>{
  const original=new Game(2).snapshot();const legacy={...original,saveVersion:1,rulesVersion:'mvp1-v1',score:12345};
  for(const k of ['specialsCreated','specialsActivated','specialCombos']) delete legacy.stats[k];
  for(const k of ['bombRadius','doubleBombRadius','comboLineRadius','specialCreateBonus','specialActivateBonus','specialComboBonus']) delete legacy.config.balance[k];
  const before=structuredClone(legacy);const save=Game.restore(legacy).snapshot();
  assert.deepEqual(legacy,before);assert.equal(save.saveVersion,2);assert.equal(save.score,12345);
  assert.deepEqual(save.board,legacy.board);assert.equal(save.rngState,legacy.rngState);assert.equal(save.stats.specialsCreated,0);
});
test('unknown rule versions and invalid special encodings are rejected',()=>{
  const save=new Game(4).snapshot();save.rulesVersion='mvp2-future';assert.throws(()=>Game.restore(save));
  save.rulesVersion='mvp2-v1';save.board.cells[0]=999;assert.throws(()=>Game.restore(save));
});
test('300-move deterministic replay exercises special creation and activation',()=>{
  const a=new Game(20260910);const moves=[];
  for(let i=0;i<300;i++){ const move=a.hint();moves.push(move);assert.ok(a.swap(move).accepted); }
  assert.ok(a.stats.specialsCreated>0);assert.ok(a.stats.specialsActivated>0);
  assert.deepEqual(replay(20260910,moves,a.config,300),a.snapshot());
});
test('all-special matched runs activate without overwriting an existing special',()=>{
  const b={width:3,height:3,cells:[makeTile(1,'rocket-h'),makeTile(1,'bomb'),makeTile(1,'rocket-v'),2,3,4,4,2,3]};
  assert.equal(planSpecials(b,findMatches(b)).length,0);
  const c={...config,width:3,height:3};const r=resolveBoard(b,c,new Rng(8));assert.ok(r.specialsActivated>=3);
});

test('statistics overflow rolls back the special transaction',()=>{
  const fixture=fixtures.find(f=>f.id==='rocket-bomb');const save=structuredClone(fixture.save);
  save.stats.specialCombos=Number.MAX_SAFE_INTEGER;const game=Game.restore(save);const before=game.snapshot();
  assert.throws(()=>game.swap(fixture.move),/Statistics/);assert.deepEqual(game.snapshot(),before);
});
