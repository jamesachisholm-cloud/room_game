import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parsePlan } from '../src/map-plan.js';
import { hasClearFootprint } from '../src/placement.js';

const mapUrl = new URL('../maps/world.map', import.meta.url);

test('parses the current world plan and object defaults', async () => {
  const text = await readFile(mapUrl, 'utf8');
  const plan = parsePlan(text.replace('cat 0 0 1.6 1.6 0.25 20', 'cat 0 0 1.6 1.6 0.25'));

  assert.equal(plan.buildings.length, 6);
  assert.equal(plan.junctionPaths.length, 1);
  assert.equal(plan.buildings.find(building => building.name === 'B').objects.find(object => object.type === 'cat').value, 20);
});

test('rejects a box whose corner overlaps a wall tile', () => {
  const world = { isWall: (x, y) => x === 1 && y === 1 };
  const box = { type: 'box', w: 1, d: 1 };

  assert.equal(hasClearFootprint(world, box, .75, .75), false);
});

test('allows a box that only touches a wall tile edge', () => {
  const world = { isWall: (x, y) => x === 1 && y === 1 };
  const box = { type: 'box', w: 1, d: 1 };

  assert.equal(hasClearFootprint(world, box, .5, .5), true);
});