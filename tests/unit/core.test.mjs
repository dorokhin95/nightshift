import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, Rng, DEFAULT_CONFIG, generateBoard, findMatches, uniqueMatchedCells,
  findPossibleMoves, isLegalMove, shuffleBoard, applyGravity, spawnTiles,
  scoreClear, cascadeMultiplier, replay, resolveBoard,
} from '../../dist/game/core/index.js';
const config = (width = 8, height = 8) => ({ ...DEFAULT_CONFIG, width, height, balance: { ...DEFAULT_CONFIG.balance } });
const board = rows => ({ width: rows[0].length, height: rows.length, cells: rows.flat() });
const stable = b => {
  assert.equal(findMatches(b).length, 0);
  assert.ok(findPossibleMoves(b, 1).length);
  assert.ok(b.cells.every(Number.isInteger));
};
const histogram = b => [...b.cells].sort((a, b) => a - b);

test('generation: 600 seeds, no starting matches and at least one legal move', () => {
  for (let seed = 0; seed < 600; seed++) stable(generateBoard(config(), new Rng(seed)));
});
for (const [w, h] of [[3, 3], [7, 7], [9, 9], [7, 9], [32, 3]]) {
  test(`configurable ${w}x${h} board`, () => {
    for (let seed = 0; seed < 20; seed++) {
      const b = generateBoard(config(w, h), new Rng(seed));
      assert.equal(b.cells.length, w * h); stable(b);
    }
  });
}
test('invalid sizes, tile count, seed and balance are rejected', () => {
  for (const seed of [-1, 2 ** 32, NaN, Infinity, 1.5]) assert.throws(() => new Game(seed));
  for (const [w, h] of [[2, 8], [8, 33], [NaN, 8]]) assert.throws(() => new Game(1, config(w, h)));
  assert.throws(() => new Game(1, { ...config(), tileCount: 2 }));
  assert.throws(() => new Game(1, { ...config(), balance: { ...config().balance, cascadeStep: NaN } }));
});
test('RNG has stable golden vector, including seed zero', () => {
  const rng = new Rng(0);
  assert.deepEqual(Array.from({ length: 6 }, () => rng.integer(1000000)), [266429, 329, 223272, 146202, 467327, 545049]);
});
test('RNG resumes exactly from exported state', () => {
  const a = new Rng(42); a.next(); a.next(); const b = new Rng(a.state);
  assert.deepEqual(Array.from({ length: 100 }, () => a.next()), Array.from({ length: 100 }, () => b.next()));
});
for (const n of [3, 4, 5]) {
  test(`horizontal and vertical maximal match of ${n}`, () => {
    assert.deepEqual(findMatches(board([Array(n).fill(2)])), [{ direction: 'horizontal', tile: 2, indices: Array.from({ length: n }, (_, i) => i) }]);
    assert.equal(findMatches(board(Array.from({ length: n }, () => [2])))[0].direction, 'vertical');
  });
}
test('T and L overlaps are counted only once', () => {
  for (const rows of [ [[1,1,1],[2,1,3],[3,1,2]], [[1,2,3],[1,3,2],[1,1,1]] ]) {
    const matches = findMatches(board(rows)); assert.equal(matches.length, 2);
    assert.equal(uniqueMatchedCells(matches).length, 5);
  }
});
test('empty cells are not matches; separate runs remain separate', () => {
  assert.equal(findMatches(board([[null,null,null]])).length, 0);
  assert.equal(findMatches(board([[1,1,1,2,1,1,1]])).length, 2);
});
test('only adjacent in-bounds swaps are accepted', () => {
  const game = new Game(123); const before = game.snapshot();
  for (const move of [ {from:[0,0],to:[1,1]}, {from:[0,0],to:[0,2]}, {from:[-1,0],to:[0,0]},
    {from:[0,0],to:[8,0]}, {from:[0.5,0],to:[1,0]}, {from:[0,0],to:[0,0]}, {from:null,to:[0,0]} ]) {
    assert.equal(game.swap(move).accepted, false); assert.deepEqual(game.snapshot(), before);
  }
});
test('no-match swap rolls back board, RNG, moves and score', () => {
  const game = new Game(99); const before = game.snapshot();
  let invalid;
  for (let y = 0; y < 8 && !invalid; y++) for (let x = 0; x < 7 && !invalid; x++) {
    const move = { from: [x,y], to: [x+1,y] }; if (!isLegalMove(game.board, move)) invalid = move;
  }
  assert.ok(invalid); assert.equal(game.swap(invalid).reason, 'no-match'); assert.deepEqual(game.snapshot(), before);
});
test('move search is pure and does not consume RNG', () => {
  const game = new Game(18); const before = game.snapshot();
  const moves = findPossibleMoves(game.board); assert.ok(moves.length);
  for (const move of moves) assert.ok(isLegalMove(game.board, move));
  assert.deepEqual(game.snapshot(), before);
});
test('unrelated existing match does not make another swap legal', () => {
  const b = board([[0,0,0],[1,2,3],[2,3,1]]);
  assert.equal(isLegalMove(b, {from:[0,2],to:[1,2]}), false);
});
test('gravity is stable and never crosses columns', () => {
  const b = board([[1,null,4],[null,2,null],[3,null,5],[null,6,null]]);
  const original = structuredClone(b);
  assert.deepEqual(applyGravity(b).cells, [null,null,null,null,null,null,1,2,4,3,6,5]);
  assert.deepEqual(b, original);
});
test('spawn fills only empty cells in deterministic order', () => {
  const b = board([[null,1,null],[2,null,3],[null,4,null]]);
  const a = spawnTiles(b, 6, new Rng(4)); const c = spawnTiles(b, 6, new Rng(4));
  assert.deepEqual(a, c); assert.ok(a.cells.every(Number.isInteger));
  b.cells.forEach((tile, i) => { if (tile !== null) assert.equal(a.cells[i], tile); });
});
test('score follows configured multiplier, capped at x3', () => {
  const balance = DEFAULT_CONFIG.balance;
  assert.equal(scoreClear(3, 1, balance), 300);
  assert.equal(scoreClear(3, 2, balance), 375);
  assert.equal(scoreClear(3, 3, balance), 450);
  assert.equal(scoreClear(3, 100, balance), 900);
  assert.equal(cascadeMultiplier(100, balance), 3);
});
test('shuffle preserves the exact multiset and produces stable playable boards', () => {
  for (let seed = 0; seed < 40; seed++) {
    const game = new Game(seed); const original = game.board;
    const shuffled = shuffleBoard(original, new Rng(seed + 1), 4096);
    assert.deepEqual(histogram(shuffled), histogram(original)); stable(shuffled);
    assert.deepEqual(game.board, original);
  }
});
test('impossible shuffle fails explicitly with bounded work', () => {
  assert.throws(() => shuffleBoard(board([[0,0,0],[0,0,0],[0,0,0]]), new Rng(1), 3), /budget/);
});
test('dead board is automatically shuffled without score or tile-count changes', () => {
  const b = board([[0,1,2],[1,2,0],[2,0,1]]);
  assert.equal(findPossibleMoves(b).length, 0);
  const result = resolveBoard(b, config(3,3), new Rng(13));
  assert.equal(result.shuffled, true); assert.equal(result.score, 0);
  assert.deepEqual(histogram(result.board), histogram(b)); stable(result.board);
});
test('pause locks gameplay; resume permits the same move', () => {
  const game = new Game(77); const move = game.hint(); const before = game.snapshot();
  game.pause(); assert.equal(game.phase, 'PAUSED'); assert.equal(game.swap(move).reason, 'paused');
  assert.deepEqual(game.snapshot(), before); game.resume(); assert.equal(game.swap(move).accepted, true);
});
test('returned snapshots, config and animation events cannot mutate internal state', () => {
  const game = new Game(13); const move = game.hint();
  const result = game.swap(move); const before = game.snapshot();
  game.board.cells.fill(0); game.config.balance.tileScore = 999; game.stats.moves = 999;
  const save = game.snapshot(); save.board.cells.fill(0); save.config.width = 20;
  result.events.forEach(event => event.board.cells.fill(0)); assert.deepEqual(game.snapshot(), before);
});
test('300 accepted moves maintain stable board and score/event invariants', () => {
  const game = new Game(20260910); let total = 0;
  for (let i = 0; i < 300; i++) {
    const result = game.swap(game.hint()); assert.equal(result.accepted, true);
    assert.equal(result.events[0].type, 'swap');
    const clears = result.events.filter(event => event.type === 'clear');
    assert.equal(result.cascades, clears.length);
    assert.equal(result.scoreDelta, clears.reduce((sum, event) => sum + event.points, 0));
    total += result.scoreDelta; stable(game.board); assert.equal(game.stats.moves, i + 1);
  }
  assert.equal(game.score, total); assert.ok(game.stats.maxCascade > 1);
});
test('same seed and same moves yield identical events, score, RNG and board', () => {
  const a = new Game(1000); const b = new Game(1000);
  for (let i = 0; i < 50; i++) {
    const move = a.hint(); assert.deepEqual(a.swap(move), b.swap(move)); assert.deepEqual(a.snapshot(), b.snapshot());
  }
});
test('replay reproduces the entire session and rejects illegal or over-budget logs', () => {
  const game = new Game(551); const moves = [];
  for (let i = 0; i < 50; i++) { const move = game.hint(); moves.push(move); game.swap(move); }
  assert.deepEqual(replay(551, moves), game.snapshot());
  assert.throws(() => replay(551, moves, config(), 49), /length/);
  assert.throws(() => replay(551, [{from:[0,0],to:[7,7]}]), /Invalid replay/);
});
test('restore after JSON roundtrip continues the same random stream', () => {
  const game = new Game(888);
  for (let i = 0; i < 15; i++) game.swap(game.hint());
  const restored = Game.restore(JSON.parse(JSON.stringify(game.snapshot())));
  for (let i = 0; i < 20; i++) {
    const move = game.hint(); assert.deepEqual(restored.swap(move), game.swap(move));
  }
  assert.deepEqual(restored.snapshot(), game.snapshot());
});
test('restore rejects unknown versions, corrupted board and invalid numbers', () => {
  const save = new Game(1).snapshot();
  for (const patch of [{saveVersion:3}, {rulesVersion:'later'}, {rngState:-1}, {score:NaN},
    {board:{...save.board,cells:save.board.cells.slice(1)}}, {board:{...save.board,cells:Array(64).fill(0)}}]) {
    assert.throws(() => Game.restore({...save,...patch}));
  }
});
test('resolution failure leaves the entire transaction unchanged', () => {
  const c = config(); c.balance.maxCascades = 1;
  let exercised = false;
  for (let seed = 0; seed < 30 && !exercised; seed++) {
    const game = new Game(seed, c); const before = game.snapshot();
    try { game.swap(game.hint()); } catch (error) {
      assert.match(error.message, /Cascade budget/); assert.deepEqual(game.snapshot(), before);
      assert.equal(game.phase, 'PLAYING'); exercised = true;
    }
  }
  assert.ok(exercised, 'fixture must exercise a cascade-budget rollback');
});
