import { loadPlan, roomIdsIn } from './map-plan.js?v=20261037';
import { makeCat, makeGuitar, makeSimpleObject, makeWallPicture } from './object-geometry.js?v=20261037';
import { SIMPLE_OBJECT_TYPES } from './object-types.js?v=20261037';
import { SIZE } from './world-constants.js?v=20261037';

export { CELL_FT, SIZE } from './world-constants.js?v=20261037';
export { parsePlan } from './map-plan.js?v=20261037';

const PAD = 12;
const ROOM_LENGTHS = 10;
export async function createWorld() {
  const plan = await loadPlan();
  const definitions = Object.fromEntries(plan.buildings.map(building => [building.name, building]));
  const A = definitions.A;
  const B = definitions.B;
  const C = definitions.C;
  const D = definitions.D;
  const E = definitions.E;
  const placed = {
    A: { ...A, x: PAD + SIZE, y: PAD },
    B: { ...B, x: 0, y: PAD },
    C: { ...C, x: 0, y: 0 },
    D: { ...D, x: 0, y: 0 },
    // The centre room sits between the four existing ring paths.
    E: { ...E, x: 82, y: 73 }
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
  const buildings = [placed.A, placed.B, placed.C, placed.D, placed.E];
  const roomCountByBuilding = new Map(buildings.map(building => [building.name, roomIdsIn(building.grid).length]));
  const width = Math.max(...buildings.map(building => building.x + building.w)) + PAD;
  const height = Math.max(...buildings.map(building => building.y + building.h)) + PAD;
  const map = Array.from({ length: height }, () => Array(width).fill(0));
  const doors = new Map();
  let nextDoorId = 0;
  const key = (x, y) => `${x},${y}`;
  const openDoorCell = (x, y, doorId = nextDoorId++) => {
    map[y][x] = 0;
    doors.set(key(x, y), doorId);
  };

  for (const building of buildings) {
    for (let y = building.y; y < building.y + building.h; y++) {
      for (let x = building.x; x < building.x + building.w; x++) map[y][x] = 1;
    }
    for (let row = 0; row < building.rows; row++) {
      for (let col = 0; col < building.cols; col++) {
        const originX = building.x + col * SIZE;
        const originY = building.y + row * SIZE;
        for (let y = originY + 1; y < originY + SIZE - 1; y++) {
          for (let x = originX + 1; x < originX + SIZE - 1; x++) map[y][x] = 0;
        }
        if (col + 1 < building.cols && building.grid[row][col] === building.grid[row][col + 1]) {
          for (let y = originY + 1; y < originY + SIZE - 1; y++) map[y][originX + SIZE - 1] = 0;
          for (let y = originY + 1; y < originY + SIZE - 1; y++) map[y][originX + SIZE] = 0;
        }
        if (row + 1 < building.rows && building.grid[row][col] === building.grid[row + 1][col]) {
          for (let x = originX + 1; x < originX + SIZE - 1; x++) map[originY + SIZE - 1][x] = 0;
          for (let x = originX + 1; x < originX + SIZE - 1; x++) map[originY + SIZE][x] = 0;
        }
        if (
          col + 1 < building.cols && row + 1 < building.rows &&
          building.grid[row][col] === building.grid[row][col + 1] &&
          building.grid[row][col] === building.grid[row + 1][col] &&
          building.grid[row][col] === building.grid[row + 1][col + 1]
        ) {
          for (const x of [originX + SIZE - 1, originX + SIZE]) {
            for (const y of [originY + SIZE - 1, originY + SIZE]) map[y][x] = 0;
          }
        }
      }
    }
    for (const door of building.doors) {
      const doorId = nextDoorId++;
      if (door.orientation === 'vertical') {
        const x = building.x + door.line - 1;
        for (let part = 0; part < door.width; part++) {
          const y = building.y + door.start + door.offset + part;
          openDoorCell(x, y, doorId);
          map[y][x + 1] = 0;
        }
      } else {
        const y = building.y + door.line - 1;
        for (let part = 0; part < door.width; part++) {
          const x = building.x + door.start + door.offset + part;
          openDoorCell(x, y, doorId);
          map[y + 1][x] = 0;
        }
      }
    }
  }

  function exitCell(building, exit) {
    if (exit.side === 'north' || exit.side === 'south') {
      return {
        x: building.x + exit.bay * SIZE + exit.offset,
        y: exit.side === 'north' ? building.y : building.y + building.h - 1
      };
    }
    return {
      x: exit.side === 'west' ? building.x : building.x + building.w - 1,
      y: building.y + exit.bay * SIZE + exit.offset
    };
  }
  for (const building of buildings) {
    for (const exit of building.exits) {
      const cell = exitCell(building, exit);
      openDoorCell(cell.x, cell.y);
    }
  }

  const magicDoors = [];
  const magicDoorIds = new Set();
  for (const building of buildings) {
    for (const definition of building.magicDoors) {
      const cell = exitCell(building, definition);
      const doorId = nextDoorId++;
      openDoorCell(cell.x, cell.y, doorId);
      const portal = {
        id: doorId, pairId: definition.pairId, building: building.name, roomId: definition.roomId,
        side: definition.side, bay: definition.bay, offset: definition.offset,
        x: cell.x + .5, y: cell.y + .5
      };
      if (definition.side === 'north') { portal.landingX = portal.x; portal.landingY = building.y + 1.5; portal.arrivalAngle = Math.PI / 2; }
      if (definition.side === 'south') { portal.landingX = portal.x; portal.landingY = building.y + building.h - 1.5; portal.arrivalAngle = -Math.PI / 2; }
      if (definition.side === 'west') { portal.landingX = building.x + 1.5; portal.landingY = portal.y; portal.arrivalAngle = 0; }
      if (definition.side === 'east') { portal.landingX = building.x + building.w - 1.5; portal.landingY = portal.y; portal.arrivalAngle = Math.PI; }
      magicDoors.push(portal);
      magicDoorIds.add(doorId);
    }
  }
  const magicDoorPairs = new Map();
  for (const portal of magicDoors) {
    if (!magicDoorPairs.has(portal.pairId)) magicDoorPairs.set(portal.pairId, []);
    magicDoorPairs.get(portal.pairId).push(portal);
  }
  for (const pair of magicDoorPairs.values()) {
    pair[0].target = pair[1];
    pair[1].target = pair[0];
  }

  const paths = plan.connections.map(connection => {
    const firstBuilding = placed[connection.fromBuilding];
    const secondBuilding = placed[connection.toBuilding];
    const firstExit = firstBuilding.exits.find(exit => exit.side === connection.fromSide);
    const secondExit = secondBuilding.exits.find(exit => exit.side === connection.toSide);
    if (!firstExit || !secondExit) throw new Error(`Connection refers to a missing exit: ${JSON.stringify(connection)}`);
    const firstCell = exitCell(firstBuilding, firstExit);
    const secondCell = exitCell(secondBuilding, secondExit);
    const horizontal = connection.fromSide === 'east' || connection.fromSide === 'west';
    if (horizontal) {
      if (firstCell.y !== secondCell.y) throw new Error('East/west linked exits must line up on the same row.');
      const edgeX = building => connection.fromSide === 'east' ? building.x + building.w : building.x;
      const otherEdgeX = building => connection.toSide === 'east' ? building.x + building.w : building.x;
      return { axis: 'x', from: edgeX(firstBuilding), to: otherEdgeX(secondBuilding), fixed: firstCell.y + .5 };
    }
    if (firstCell.x !== secondCell.x) throw new Error('North/south linked exits must line up on the same column.');
    const edgeY = (building, side) => side === 'south' ? building.y + building.h : building.y;
    return { axis: 'y', from: edgeY(firstBuilding, connection.fromSide), to: edgeY(secondBuilding, connection.toSide), fixed: firstCell.x + .5 };
  });
  for (const route of plan.junctionPaths) {
    const building = placed[route.building];
    const exit = building?.exits.find(candidate => candidate.side === route.side);
    if (!building || !exit || !Number.isFinite(route.target)) throw new Error(`Junction path has an invalid building, exit, or target: ${JSON.stringify(route)}`);
    const cell = exitCell(building, exit);
    if (route.side === 'north') paths.push({ axis: 'y', from: route.target, to: building.y, fixed: cell.x + .5 });
    else if (route.side === 'south') paths.push({ axis: 'y', from: building.y + building.h, to: route.target, fixed: cell.x + .5 });
    else if (route.side === 'west') paths.push({ axis: 'x', from: route.target, to: building.x, fixed: cell.y + .5 });
    else if (route.side === 'east') paths.push({ axis: 'x', from: building.x + building.w, to: route.target, fixed: cell.y + .5 });
    else throw new Error(`Junction path has an invalid side: ${route.side}`);
  }

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
  const buildingPlans = buildings.map(building => ({
    name: building.name, x: building.x, y: building.y, cols: building.cols, rows: building.rows,
    w: building.w, h: building.h, grid: building.grid, doors: building.doors, exits: building.exits, magicDoors: building.magicDoors, objects: building.objects,
    roomCount: roomCountByBuilding.get(building.name)
  }));
  return {
    buildings, buildingPlans, map, doors, paths, boxes, tables, guitars, wireObjects, pictures, cat, pickups, magicDoors, magicDoorIds, width, height, start,
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
