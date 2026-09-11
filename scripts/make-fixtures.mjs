import { writeFileSync } from 'node:fs';
import { Game, findPossibleMoves, cloneBoard, swapCells, indexOf, findMatches, planSpecials, makeTile } from '../dist/game/core/index.js';
const required = new Set(['rocket-h', 'rocket-v', 'bomb', 'lightning']);
const fixtures = [];
for (let seed = 0; seed < 20000 && required.size; seed++) {
  const game = new Game(seed);
  for (const move of findPossibleMoves(game.board)) {
    const candidate = cloneBoard(game.board);
    swapCells(candidate, indexOf(candidate, move.from), indexOf(candidate, move.to));
    for (const creation of planSpecials(candidate, findMatches(candidate), [indexOf(candidate, move.to), indexOf(candidate, move.from)])) {
      if (required.has(creation.kind)) {
        fixtures.push({ id: `create-${creation.kind}`, kind: creation.kind, save: game.snapshot(), move });
        required.delete(creation.kind);
      }
    }
  }
}
if (required.size) throw new Error(`Missing fixtures: ${[...required]}`);
for (const [id, a, b] of [
  ['rocket-rocket','rocket-h','rocket-v'], ['rocket-bomb','rocket-v','bomb'], ['bomb-bomb','bomb','bomb'],
  ['lightning-tile','lightning','normal'], ['lightning-rocket','lightning','rocket-h'],
  ['lightning-bomb','lightning','bomb'], ['lightning-lightning','lightning','lightning'],
]) {
  const game = new Game(20260910); const save = game.snapshot();
  save.board.cells[27] = makeTile(save.board.cells[27], a);
  save.board.cells[28] = makeTile(save.board.cells[28], b);
  Game.restore(save);
  fixtures.push({ id, kind: 'combo', save, move: { from: [3,3], to: [4,3] } });
}
writeFileSync(new URL('../tests/fixtures/specials.json', import.meta.url), JSON.stringify(fixtures, null, 2) + '\n');
console.log(`Saved ${fixtures.length} deterministic lab scenarios`);
