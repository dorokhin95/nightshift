import { Game } from '../dist/game/core/index.js';
const seed = Number(process.argv[2] ?? 20260910);
const game = new Game(seed);
console.log('Последний Заказ · MVP-1 · seed', seed);
for (let i = 0; i < 10; i++) {
  const move = game.hint();
  const result = game.swap(move);
  console.log(JSON.stringify({ move, points: result.scoreDelta, cascades: result.cascades }));
}
console.log('Score:', game.score, 'Moves:', game.stats.moves);
console.log(JSON.stringify(game.snapshot(), null, 2));
