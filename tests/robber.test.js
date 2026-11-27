import assert from 'node:assert/strict';
import test from 'node:test';
import { updateRobber } from '../src/robber.js';

function makeWorld() {
  const width = 40;
  const height = 40;
  const map = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => x === 15 && y !== 20 ? 1 : 0));
  let pathChecks = 0;
  return {
    width, height, map,
    blockMovement: false,
    get pathChecks() { return pathChecks; },
    isWall(x, y) { return x < 0 || y < 0 || x >= width || y >= height || map[y][x] === 1; },
    canMove(fromX, fromY, toX, toY, radius) {
      if (radius === undefined) pathChecks++;
      return !this.isWall(Math.floor(toX), Math.floor(toY)) && !(radius && this.blockMovement);
    }
  };
}

function makeRobber() {
  return { x: .5, y: .5, path: [], pathIndex: 0, replanIn: 0 };
}

test('robber reuses a progressing shortest route until the goal tile changes', () => {
  const world = makeWorld();
  const robber = makeRobber();
  const player = { x: 30.5, y: 10.5 };
  updateRobber(robber, world, player, 0, () => false);
  assert.equal(robber.path.length, 60);
  assert.ok(robber.path.some(point => point.x === 15.5 && point.y === 20.5));

  const firstSearchChecks = world.pathChecks;
  for (let i = 0; i < 30; i++) updateRobber(robber, world, player, .05, () => false);
  assert.ok(robber.pathIndex > 0);
  assert.equal(world.pathChecks, firstSearchChecks);

  player.x += 1;
  robber.replanIn = 0;
  updateRobber(robber, world, player, 0, () => false);
  assert.ok(world.pathChecks > firstSearchChecks);
  assert.deepEqual(robber.path.at(-1), { x: 31.5, y: 10.5 });
});

test('robber retries a route when it cannot make progress', () => {
  const world = makeWorld();
  world.blockMovement = true;
  const robber = makeRobber();
  const player = { x: 30.5, y: 10.5 };
  updateRobber(robber, world, player, 0, () => false);
  const firstSearchChecks = world.pathChecks;

  for (let i = 0; i < 30; i++) updateRobber(robber, world, player, .05, () => false);
  assert.equal(robber.pathIndex, 0);
  assert.ok(world.pathChecks > firstSearchChecks);
});
