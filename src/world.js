import { loadPlan, roomIdsIn } from './map-plan.js?v=20261107';
import { makeCat, makeGuitar, makeSimpleObject, makeWallPicture } from './object-geometry.js?v=20261106';
import { SIMPLE_OBJECT_TYPES } from './object-types.js?v=20261039';
import { SIZE } from './world-constants.js?v=20261038';
import { randomizeObjectPlacements } from './object-placement.js?v=20261101';
import { buildWorldMap } from './world-map.js?v=20261107';
import { makeRocket } from './rocket.js?v=20261092';

export { CELL_FT, SIZE } from './world-constants.js?v=20261038';
export { parsePlan } from './map-plan.js?v=20261107';

const PAD = 12;
const ROOM_LENGTHS = 10;
// Walking speed is about 3.1 cells per second, so 950 cells is roughly five minutes of walking.
const FAR_DISTANCE = 950;

export async function createWorld() {
  const plan = await loadPlan();
  const definitions = Object.fromEntries(plan.buildings.map(building => [building.name, building]));
  const A = definitions.A;
  const B = definitions.B;
  const C = definitions.C;
  const D = definitions.D;
  const E = definitions.E;
  const F = definitions.F;
  const placed = {
    A: { ...A, x: PAD + SIZE, y: PAD },
    B: { ...B, x: 0, y: PAD },
    C: { ...C, x: 0, y: 0 },
    D: { ...D, x: 0, y: 0 },
    // The centre room sits between the four existing ring paths.
    E: { ...E, x: 82, y: 73 },
    // Building F is placed very far from the ring, so the magic door is the practical way to reach it.
    F: { ...F, x: 0, y: PAD }
  };
  for (const building of Object.values(placed)) {
    building.w = building.cols * SIZE;
    building.h = building.rows * SIZE;
  }
  placed.B.x = placed.A.x + placed.A.w + ROOM_LENGTHS * SIZE;
  placed.C.x = placed.B.x;
  placed.C.y = placed.B.y + placed.B.h + ROOM_LENGTHS * SIZE;
  placed.D.x = placed.C.x - placed.C.w - ROOM_LENGTHS * SIZE;
  placed.D.y = placed.C.y;
  placed.F.x = placed.B.x + placed.B.w + FAR_DISTANCE;
  const buildings = [placed.A, placed.B, placed.C, placed.D, placed.E, placed.F];
  const roomCountByBuilding = new Map(buildings.map(building => [building.name, roomIdsIn(building.grid).length]));
  const worldMap = buildWorldMap(plan, buildings, PAD);
  const { width, height, map, doors, paths, corridors, magicDoors, magicDoorIds } = worldMap;
  randomizeObjectPlacements(buildings, (x, y) => x < 0 || y < 0 || x >= width || y >= height || map[y][x] === 1);

  const boxes = [];
  const tables = [];
  const guitars = [];
  const wireObjects = [];
  const pictures = [];
  const pickups = [];
  let cat = null;
  for (const building of buildings) {
    for (const object of building.objects) {
      if (object.type === 'picture') {
        pictures.push(makeWallPicture(building, object));
        continue;
      }
      const x = building.x + object.col * SIZE + object.x;
      const y = building.y + object.row * SIZE + object.y;
      if (object.type === 'box') {
        const box = { type: 'box', x, y, w: object.w, d: object.d, h: object.h, value: object.value, held: false };
        boxes.push(box);
        pickups.push(box);
      }
      if (object.type === 'table') {
        const topThickness = object.h * .18;
        const legWidth = Math.min(object.w, object.d) * .13;
        const legHeight = object.h - topThickness;
        const table = {
          type: 'table', x, y, w: object.w, d: object.d, h: object.h, value: object.value, held: false,
          parts: [
            { x, y, w: object.w, d: object.d, z: legHeight, h: topThickness },
            ...[-1, 1].flatMap(sx => [-1, 1].map(sy => ({
              x: x + sx * (object.w / 2 - legWidth / 2),
              y: y + sy * (object.d / 2 - legWidth / 2),
              w: legWidth, d: legWidth, z: 0, h: legHeight
            })))
          ]
        };
        tables.push(table);
        pickups.push(table);
      }
      if (object.type === 'cat') {
        cat = { ...makeCat(x, y, object.scale), type: 'cat', x, y, scale: object.scale, value: object.value, held: false };
        pickups.push(cat);
      }
      if (object.type === 'guitar') {
        const guitar = { ...makeGuitar(x, y, object.scale), type: 'guitar', x, y, scale: object.scale, value: object.value, held: false };
        guitars.push(guitar);
        pickups.push(guitar);
      }
      if (SIMPLE_OBJECT_TYPES.includes(object.type)) {
        const wireObject = { ...makeSimpleObject(object.type, x, y, object.scale), type: object.type, x, y, scale: object.scale, value: object.value, held: false };
        wireObjects.push(wireObject);
        pickups.push(wireObject);
      }
    }
  }
  const start = { x: placed.A.x + 3.5, y: placed.A.y + 3.5, a: 0 };
  const rocket = makeRocket(placed.F.x + placed.F.w / 2, placed.F.y + placed.F.h + 18);
  const buildingPlans = buildings.map(building => ({
    name: building.name, x: building.x, y: building.y, cols: building.cols, rows: building.rows,
    w: building.w, h: building.h, grid: building.grid, doors: building.doors, exits: building.exits, magicDoors: building.magicDoors, objects: building.objects,
    roomCount: roomCountByBuilding.get(building.name)
  }));
  return {
    buildings, buildingPlans, map, doors, paths, corridors, boxes, tables, guitars, wireObjects, pictures, cat, pickups, magicDoors, magicDoorIds, width, height, start, rocket,
    moveObject(object, x, y) {
      const dx = x - object.x;
      const dy = y - object.y;
      object.x = x;
      object.y = y;
      if (object.cuboids) {
        for (const part of object.cuboids) {
          part.x += dx;
          part.y += dy;
        }
      }
      if (object.lines) {
        for (const line of object.lines) {
          for (const point of line) {
            point.x += dx;
            point.y += dy;
          }
        }
      }
      if (object.type === 'table') {
        for (const part of object.parts) {
          part.x += dx;
          part.y += dy;
        }
      }
    },
    isWall(x, y) { return x < 0 || y < 0 || x >= width || y >= height ? true : map[y][x] === 1; },
    getRoomAt(x, y) {
      const building = buildings.find(candidate => x >= candidate.x && x < candidate.x + candidate.w && y >= candidate.y && y < candidate.y + candidate.h);
      if (!building) return null;
      const col = Math.floor((x - building.x) / SIZE);
      const row = Math.floor((y - building.y) / SIZE);
      return { building: building.name, room: Number(building.grid[row][col]), roomCount: roomCountByBuilding.get(building.name) };
    }
  };
}
