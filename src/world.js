export const SIZE = 7;
const PAD = 12;
const ROOM_LENGTHS = 10;
const ROOM_FT = 10;
export const CELL_FT = ROOM_FT / SIZE;

async function loadPlan() {
  const response = await fetch('./maps/world.map?v=20261037', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load maps/world.map (${response.status})`);
  return parsePlan(await response.text());
}

function sharedWalls(grid, roomA, roomB) {
  const segments = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const room = grid[row][col];
      if (col + 1 < grid[row].length) {
        const neighbor = grid[row][col + 1];
        if ((room === roomA && neighbor === roomB) || (room === roomB && neighbor === roomA)) {
          segments.push({ orientation: 'vertical', line: (col + 1) * SIZE, start: row * SIZE, end: (row + 1) * SIZE });
        }
      }
      if (row + 1 < grid.length) {
        const neighbor = grid[row + 1][col];
        if ((room === roomA && neighbor === roomB) || (room === roomB && neighbor === roomA)) {
          segments.push({ orientation: 'horizontal', line: (row + 1) * SIZE, start: col * SIZE, end: (col + 1) * SIZE });
        }
      }
    }
  }
  const byLine = new Map();
  for (const segment of segments) {
    const key = `${segment.orientation}:${segment.line}`;
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key).push(segment);
  }
  const walls = [];
  for (const lineSegments of byLine.values()) {
    lineSegments.sort((a, b) => a.start - b.start);
    for (const segment of lineSegments) {
      const previous = walls[walls.length - 1];
      if (previous && previous.orientation === segment.orientation && previous.line === segment.line && segment.start <= previous.end) {
        previous.end = Math.max(previous.end, segment.end);
      } else {
        walls.push({ ...segment });
      }
    }
  }
  return walls;
}

export function parsePlan(text) {
  const buildings = [];
  const connections = [];
  const junctionPaths = [];
  let current = null;
  let section = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'building') {
      current = { name: parts[1], cols: Number(parts[2]), rows: Number(parts[3]), grid: [], doors: [], exits: [], magicDoors: [], objects: [] };
      buildings.push(current);
      section = null;
    } else if (parts[0] === 'rooms' && current) {
      section = 'rooms';
    } else if (parts[0] === 'doors' && current) {
      section = 'doors';
    } else if (parts[0] === 'exits' && current) {
      section = 'exits';
    } else if (parts[0] === 'magicdoors' && current) {
      section = 'magicdoors';
    } else if (parts[0] === 'objects' && current) {
      section = 'objects';
    } else if (parts[0] === 'end') {
      current = null;
      section = null;
    } else if (parts[0] === 'connections') {
      current = null;
      section = 'connections';
    } else if (parts[0] === 'paths') {
      current = null;
      section = 'paths';
    } else if (section === 'rooms' && current) {
      current.grid.push(parts);
    } else if (section === 'doors' && current && parts[0] === 'door') {
      current.doors.push({
        roomA: parts[1].padStart(2, '0'), roomB: parts[2].padStart(2, '0'),
        offset: Number(parts[3]), width: Number(parts[4] ?? 1)
      });
    } else if (section === 'exits' && current && parts[0] === 'exit') {
      current.exits.push({ side: parts[1], roomId: parts[2].padStart(2, '0'), wallOffset: parts[3] === undefined ? null : Number(parts[3]) });
    } else if (section === 'magicdoors' && current && parts[0] === 'magicdoor') {
      current.magicDoors.push({ side: parts[1], roomId: parts[2].padStart(2, '0'), pairId: parts[3] });
    } else if (section === 'objects' && current && parts[0] === 'box') {
      current.objects.push({ type: 'box', col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), w: Number(parts[5]), d: Number(parts[6]), h: Number(parts[7]), value: Number(parts[8] ?? 5) });
    } else if (section === 'objects' && current && parts[0] === 'table') {
      current.objects.push({ type: 'table', col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), w: Number(parts[5]), d: Number(parts[6]), h: Number(parts[7]), value: Number(parts[8] ?? 15) });
    } else if (section === 'objects' && current && parts[0] === 'cat') {
      current.objects.push({ type: 'cat', col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), scale: Number(parts[5]), value: Number(parts[6] ?? 20) });
    } else if (section === 'objects' && current && parts[0] === 'guitar') {
      current.objects.push({ type: 'guitar', col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), scale: Number(parts[5]), value: Number(parts[6] ?? 25) });
    } else if (section === 'objects' && current && ['h', 'snake', 'apple', 'telephone', 'glasses', 'toycar', 'dog', 'penny', 'fish'].includes(parts[0])) {
      const defaultValues = { h: 15, snake: 20, apple: 10, telephone: 30, glasses: 25, toycar: 8, dog: 25, penny: 1, fish: 18 };
      current.objects.push({ type: parts[0], col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), scale: Number(parts[5]), value: Number(parts[6] ?? defaultValues[parts[0]]) });
    } else if (section === 'objects' && current && parts[0] === 'picture') {
      current.objects.push({ type: 'picture', subject: parts[1], col: Number(parts[2]), row: Number(parts[3]), side: parts[4], offset: Number(parts[5]), z: Number(parts[6]), w: Number(parts[7]), h: Number(parts[8]) });
    } else if (section === 'connections') {
      connections.push({ fromBuilding: parts[0], fromSide: parts[1], toBuilding: parts[2], toSide: parts[3] });
    } else if (section === 'paths' && parts[0] === 'path') {
      junctionPaths.push({ building: parts[1], side: parts[2], target: Number(parts[3]) });
    } else {
      throw new Error(`Unrecognized map line: ${rawLine}`);
    }
  }

  if (buildings.length !== 5) throw new Error('The world map must define five buildings.');
  for (const building of buildings) {
    if (building.grid.length !== building.rows || building.grid.some(row => row.length !== building.cols)) {
      throw new Error(`Building ${building.name} must have ${building.rows} rows of ${building.cols} room IDs.`);
    }
    for (const roomId of roomIdsIn(building.grid)) {
      const cells = [];
      for (let row = 0; row < building.rows; row++) {
        for (let col = 0; col < building.cols; col++) if (building.grid[row][col] === roomId) cells.push([col, row]);
      }
      const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
      const pending = [cells[0]];
      while (pending.length) {
        const [col, row] = pending.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nextCol = col + dx;
          const nextRow = row + dy;
          const cellKey = `${nextCol},${nextRow}`;
          if (building.grid[nextRow]?.[nextCol] === roomId && !seen.has(cellKey)) {
            seen.add(cellKey);
            pending.push([nextCol, nextRow]);
          }
        }
      }
      if (seen.size !== cells.length) throw new Error(`Room ${roomId} in Building ${building.name} must use connected bays.`);
    }
    for (const door of building.doors) {
      const ids = roomIdsIn(building.grid);
      if (!ids.includes(door.roomA) || !ids.includes(door.roomB) || door.roomA === door.roomB) {
        throw new Error(`Building ${building.name} has a doorway that names a missing or identical room.`);
      }
      const walls = sharedWalls(building.grid, door.roomA, door.roomB);
      if (!walls.length) {
        throw new Error(`Rooms ${door.roomA} and ${door.roomB} in Building ${building.name} must share a wall for a door.`);
      }
      // If rooms touch along multiple separate segments, use the first segment
      // found while scanning the room grid from north-west to south-east.
      const wall = walls[0];
      door.orientation = wall.orientation;
      door.line = wall.line;
      door.start = wall.start;
      door.end = wall.end;
      if (!Number.isInteger(door.width) || door.width < 1 || door.offset < 1 || door.offset + door.width > door.end - door.start - 1) {
        throw new Error(`Door between Rooms ${door.roomA} and ${door.roomB} has an offset outside their shared wall.`);
      }
    }
    for (const exit of building.exits) {
      if (!['north', 'east', 'south', 'west'].includes(exit.side) || !roomIdsIn(building.grid).includes(exit.roomId)) {
        throw new Error(`Building ${building.name} has an outside door with an invalid side or room ID.`);
      }
      const edgeRooms = exit.side === 'north' ? building.grid[0]
        : exit.side === 'south' ? building.grid[building.rows - 1]
        : exit.side === 'west' ? building.grid.map(row => row[0])
        : building.grid.map(row => row[building.cols - 1]);
      const bays = edgeRooms.flatMap((roomId, index) => roomId === exit.roomId ? [index] : []);
      if (!bays.length || bays.at(-1) - bays[0] + 1 !== bays.length) {
        throw new Error(`Room ${exit.roomId} in Building ${building.name} must touch one continuous segment of the ${exit.side} exterior wall.`);
      }
      const start = bays[0] * SIZE;
      const end = (bays.at(-1) + 1) * SIZE;
      const position = exit.wallOffset ?? start + Math.floor((end - start - 1) / 2);
      if (!Number.isInteger(position) || position < start || position >= end || edgeRooms[Math.floor(position / SIZE)] !== exit.roomId) {
        throw new Error(`Exit for Room ${exit.roomId} in Building ${building.name} has an offset outside its wall.`);
      }
      exit.bay = Math.floor(position / SIZE);
      exit.offset = position % SIZE;
      delete exit.wallOffset;
    }
    for (const gate of building.magicDoors) {
      if (!['north', 'east', 'south', 'west'].includes(gate.side) || !roomIdsIn(building.grid).includes(gate.roomId) || !gate.pairId) {
        throw new Error(`Building ${building.name} has a magic door with an invalid side, room ID, or pair ID.`);
      }
      const edgeRooms = gate.side === 'north' ? building.grid[0]
        : gate.side === 'south' ? building.grid[building.rows - 1]
        : gate.side === 'west' ? building.grid.map(row => row[0])
        : building.grid.map(row => row[building.cols - 1]);
      const bays = edgeRooms.flatMap((roomId, index) => roomId === gate.roomId ? [index] : []);
      if (!bays.length || bays.at(-1) - bays[0] + 1 !== bays.length) {
        throw new Error(`Room ${gate.roomId} in Building ${building.name} must touch one continuous segment of the ${gate.side} exterior wall.`);
      }
      const start = bays[0] * SIZE;
      const end = (bays.at(-1) + 1) * SIZE;
      const position = start + Math.floor((end - start - 1) / 2);
      gate.bay = Math.floor(position / SIZE);
      gate.offset = position % SIZE;
    }
  }
  const pairCounts = new Map();
  for (const building of buildings) for (const gate of building.magicDoors) pairCounts.set(gate.pairId, (pairCounts.get(gate.pairId) ?? 0) + 1);
  for (const [pairId, count] of pairCounts) if (count !== 2) throw new Error(`Magic door pair ${pairId} must have exactly two doors.`);
  return { buildings, connections, junctionPaths };
}

function roomIdsIn(grid) {
  return [...new Set(grid.flat())];
}

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

  function makeCat(x, y, scale) {
    const cat = {
      cuboids: [
        { x, y, w: 1.3 * scale, d: .72 * scale, z: .35 * scale, h: .5 * scale },
        { x: x + .85 * scale, y, w: .65 * scale, d: .65 * scale, z: .75 * scale, h: .65 * scale },
        ...[-1, 1].flatMap(side => [-1, 1].map(front => ({
          x: x + front * .43 * scale, y: y + side * .23 * scale,
          w: .16 * scale, d: .16 * scale, z: 0, h: .43 * scale
        })))
      ],
      lines: []
    };
    const addLine = (...points) => cat.lines.push(points.map(([px, py, z]) => ({ x: x + px * scale, y: y + py * scale, z: z * scale })));
    for (const side of [-1, 1]) {
      const a = [.62, side * .2, 1.39];
      const b = [.94, side * .2, 1.39];
      const tip = [.78, side * .2, 1.72];
      addLine(a, b); addLine(b, tip); addLine(tip, a);
    }
    addLine([-.62, 0, .65], [-.92, 0, .82], [-1.05, 0, 1.12]);
    for (const side of [-1, 1]) {
      addLine([1.19, side * .16, 1.13], [1.2, side * .16, 1.2]);
      addLine([1.13, side * .25, 1.02], [1.48, side * .39, 1.08]);
    }
    return cat;
  }
  function makeGuitar(x, y, scale) {
    const lines = [];
    const addLine = (...points) => lines.push(points.map(([px, py, z]) => ({
      x: x + px * scale, y: y + py * scale, z: z * scale
    })));
    addLine([0, 0, .12], [-.23, 0, .16], [-.4, 0, .32], [-.36, 0, .52], [-.2, 0, .61], [-.1, 0, .55], [0, 0, .51], [.1, 0, .55], [.2, 0, .61], [.36, 0, .52], [.4, 0, .32], [.23, 0, .16], [0, 0, .12]);
    addLine([-.085, 0, .53], [-.075, 0, 1.38], [.075, 0, 1.38], [.085, 0, .53]);
    addLine([-.075, 0, 1.34], [-.12, 0, 1.43], [-.1, 0, 1.57], [.1, 0, 1.57], [.12, 0, 1.43], [.075, 0, 1.34]);
    addLine([-.12, -.012, .36], [-.08, -.012, .42], [0, -.012, .45], [.08, -.012, .42], [.12, -.012, .36], [.08, -.012, .3], [0, -.012, .27], [-.08, -.012, .3], [-.12, -.012, .36]);
    addLine([-.13, -.02, .23], [.13, -.02, .23]);
    for (const offset of [-.045, -.015, .015, .045]) {
      addLine([offset, -.025, .23], [offset * .7, -.025, 1.39]);
    }
    for (const z of [.76, .88, 1, 1.1, 1.19, 1.27]) addLine([-.078, -.02, z], [.078, -.02, z]);
    return { lines };
  }
  function makeSimpleObject(type, x, y, scale) {
    const lines = [];
    const addLine = (...points) => lines.push(points.map(([px, py, z]) => ({
      x: x + px * scale, y: y + py * scale, z: z * scale
    })));
    const circle = (cx, cz, rx, rz, py = 0, segments = 12) => {
      addLine(...Array.from({ length: segments + 1 }, (_, index) => {
        const angle = index / segments * Math.PI * 2;
        return [cx + Math.cos(angle) * rx, py, cz + Math.sin(angle) * rz];
      }));
    };
    if (type === 'h') {
      addLine([-.42, -.13, .08], [-.27, -.13, .08], [-.27, -.13, .92], [-.42, -.13, .92], [-.42, -.13, .08]);
      addLine([.27, -.13, .08], [.42, -.13, .08], [.42, -.13, .92], [.27, -.13, .92], [.27, -.13, .08]);
      addLine([-.3, -.14, .48], [.3, -.14, .48]);
      addLine([-.42, .13, .08], [-.27, .13, .08], [-.27, .13, .92], [-.42, .13, .92], [-.42, .13, .08]);
      addLine([.27, .13, .08], [.42, .13, .08], [.42, .13, .92], [.27, .13, .92], [.27, .13, .08]);
      addLine([-.3, .14, .48], [.3, .14, .48]);
      for (const px of [-.35, .35]) for (const z of [.08, .92]) addLine([px, -.13, z], [px, .13, z]);
      addLine([-.27, -.13, .48], [-.27, .13, .48]); addLine([.27, -.13, .48], [.27, .13, .48]);
    } else if (type === 'snake') {
      addLine([-.58, .12, .1], [-.4, .1, .12], [-.24, -.05, .17], [-.06, -.12, .16], [.12, -.04, .12], [.3, .08, .13], [.47, .06, .19], [.54, -.04, .3]);
      addLine([.44, -.11, .27], [.59, -.11, .27], [.61, -.11, .37], [.48, -.11, .39], [.44, -.11, .27]);
      addLine([.5, -.125, .345], [.53, -.125, .345]);
      addLine([.02, -.1, .16], [.07, -.12, .2], [.12, -.1, .16]);
    } else if (type === 'apple') {
      addLine([0, 0, .08], [-.25, 0, .14], [-.38, 0, .34], [-.34, 0, .62], [-.2, 0, .78], [0, 0, .72], [.2, 0, .78], [.34, 0, .62], [.38, 0, .34], [.25, 0, .14], [0, 0, .08]);
      addLine([0, 0, .72], [.03, 0, .91], [.08, 0, .96]);
      addLine([.04, -.01, .84], [.22, -.01, .92], [.1, -.01, .78], [.04, -.01, .84]);
    } else if (type === 'telephone') {
      addLine([-.47, -.14, .08], [.47, -.14, .08], [.39, -.14, .42], [-.39, -.14, .42], [-.47, -.14, .08]);
      addLine([-.47, .14, .08], [.47, .14, .08], [.39, .14, .42], [-.39, .14, .42], [-.47, .14, .08]);
      for (const px of [-.47, .47]) for (const py of [-.14, .14]) addLine([px, py, .08], [px < 0 ? -.39 : .39, py, .42]);
      circle(0, .29, .22, .09, -.155);
      circle(0, .29, .12, .05, -.17);
      for (let index = 0; index < 8; index++) {
        const angle = index / 8 * Math.PI * 2;
        circle(Math.cos(angle) * .16, .29 + Math.sin(angle) * .065, .018, .018, -.18, 6);
      }
      addLine([-.38, -.12, .46], [-.31, -.12, .67], [-.2, -.12, .73], [.2, -.12, .73], [.31, -.12, .67], [.38, -.12, .46]);
      addLine([-.38, .12, .46], [-.31, .12, .67], [-.2, .12, .73], [.2, .12, .73], [.31, .12, .67], [.38, .12, .46]);
      addLine([-.38, -.12, .46], [-.38, .12, .46]); addLine([.38, -.12, .46], [.38, .12, .46]);
      addLine([-.34, 0, .48], [-.45, 0, .57], [-.5, 0, .69]);
    } else if (type === 'glasses') {
      addLine([-.54, -.08, .34], [-.54, -.08, .58], [-.1, -.08, .58], [-.1, -.08, .34], [-.54, -.08, .34]);
      addLine([.1, -.08, .34], [.1, -.08, .58], [.54, -.08, .58], [.54, -.08, .34], [.1, -.08, .34]);
      addLine([-.1, -.09, .49], [0, -.11, .46], [.1, -.09, .49]);
      addLine([-.54, -.08, .54], [-.7, .12, .57], [-.72, .35, .5]);
      addLine([.54, -.08, .54], [.7, .12, .57], [.72, .35, .5]);
    } else if (type === 'dog') {
      for (const py of [-.15, .15]) {
        addLine([-.48, py, .2], [.25, py, .2], [.25, py, .54], [-.48, py, .54], [-.48, py, .2]);
        addLine([.2, py, .42], [.48, py, .42], [.58, py, .54], [.53, py, .82], [.27, py, .82], [.2, py, .42]);
        addLine([.28, py, .78], [.25, py, .96], [.38, py, .82]);
        addLine([.49, py, .78], [.57, py, .92], [.55, py, .77]);
        addLine([.43, py - .01, .62], [.47, py - .01, .62]);
        addLine([-.48, py, .46], [-.62, py, .58], [-.69, py, .76]);
      }
      for (const px of [-.35, .12]) for (const py of [-.11, .11]) addLine([px, py, .2], [px, py, .06], [px + .13, py, .06], [px + .13, py, .2]);
      for (const px of [-.48, .25]) for (const z of [.2, .54]) addLine([px, -.15, z], [px, .15, z]);
      for (const px of [.25, .58]) for (const z of [.42, .82]) addLine([px, -.15, z], [px, .15, z]);
    } else if (type === 'penny') {
      circle(0, .42, .48, .48, -.055, 16);
      circle(0, .42, .48, .48, .055, 16);
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const px = Math.cos(angle) * .48;
        const z = .42 + Math.sin(angle) * .48;
        addLine([px, -.055, z], [px, .055, z]);
      }
      circle(0, .42, .36, .36, -.06, 16);
      addLine([-.12, -.07, .57], [0, -.07, .68], [.1, -.07, .57], [0, -.07, .4], [.12, -.07, .4]);
    } else if (type === 'fish') {
      addLine([-.54, 0, .34], [-.34, 0, .52], [-.1, 0, .62], [.22, 0, .59], [.43, 0, .47], [.57, 0, .34], [.43, 0, .21], [.22, 0, .1], [-.1, 0, .07], [-.34, 0, .16], [-.54, 0, .34]);
      addLine([-.54, 0, .34], [-.72, 0, .55], [-.7, 0, .34], [-.72, 0, .13], [-.54, 0, .34]);
      addLine([-.08, 0, .6], [.06, 0, .82], [.2, 0, .58]);
      addLine([-.08, 0, .09], [.06, 0, -.08], [.2, 0, .12]);
      circle(.39, .39, .035, .035, -.01, 8);
      addLine([.25, -.015, .34], [.05, -.015, .36], [.22, -.015, .4]);
    } else if (type === 'toycar') {
      addLine([-.62, -.14, .16], [.62, -.14, .16], [.54, -.14, .39], [.25, -.14, .39], [.1, -.14, .57], [-.25, -.14, .57], [-.42, -.14, .39], [-.55, -.14, .39], [-.62, -.14, .16]);
      addLine([-.62, .14, .16], [.62, .14, .16], [.54, .14, .39], [.25, .14, .39], [.1, .14, .57], [-.25, .14, .57], [-.42, .14, .39], [-.55, .14, .39], [-.62, .14, .16]);
      for (const px of [-.4, .4]) {
        circle(px, .17, .14, .14, -.16);
        circle(px, .17, .14, .14, .16);
        addLine([px, -.16, .17], [px, .16, .17]);
      }
      addLine([-.24, -.145, .42], [-.17, -.145, .52], [.04, -.145, .52], [.18, -.145, .42]);
      addLine([-.24, .145, .42], [-.17, .145, .52], [.04, .145, .52], [.18, .145, .42]);
    }
    return { lines };
  }
  function makeWallPicture(building, object) {
    let x;
    let y;
    const alongX = object.side === 'north' || object.side === 'south';
    if (object.side === 'north') {
      x = building.x + object.col * SIZE + object.offset;
      y = building.y + object.row * SIZE + 1 + .035;
    } else if (object.side === 'south') {
      x = building.x + object.col * SIZE + object.offset;
      y = building.y + (object.row + 1) * SIZE - 1 - .035;
    } else if (object.side === 'west') {
      x = building.x + object.col * SIZE + 1 + .035;
      y = building.y + object.row * SIZE + object.offset;
    } else if (object.side === 'east') {
      x = building.x + (object.col + 1) * SIZE - 1 - .035;
      y = building.y + object.row * SIZE + object.offset;
    } else {
      throw new Error(`Picture in Building ${building.name} has an invalid wall side.`);
    }
    const point = (u, v) => alongX
      ? { x: x + u, y, z: object.z + v }
      : { x, y: y + u, z: object.z + v };
    const lines = [];
    const addLine = (...points) => lines.push(points.map(([u, v]) => point(u, v)));
    const halfW = object.w / 2;
    const h = object.h;
    addLine([-halfW, 0], [halfW, 0], [halfW, h], [-halfW, h], [-halfW, 0]);
    const hangerScale = Math.min(object.w / 1.6, object.h / .72);
    const hangRise = hangerScale * .22;
    const stringHalfWidth = halfW * .42;
    const pinRadius = hangerScale * .035;
    addLine([-stringHalfWidth, h], [0, h + hangRise], [stringHalfWidth, h]);
    addLine([-pinRadius, h + hangRise], [0, h + hangRise + pinRadius], [pinRadius, h + hangRise], [0, h + hangRise - pinRadius], [-pinRadius, h + hangRise]);
    const originalArtworkWidth = 1.05;
    const originalArtworkHeight = .48;
    const originalArtworkScale = Math.min(originalArtworkWidth / 1.6, originalArtworkHeight / .72);
    const artworkScale = Math.min(object.w / originalArtworkWidth, object.h / originalArtworkHeight);
    const scale = originalArtworkScale * artworkScale;
    const artworkHeight = originalArtworkHeight * artworkScale;
    const artworkBottom = (h - artworkHeight) / 2;
    const artworkY = fraction => artworkBottom + fraction * artworkHeight;
    if (object.subject === 'dog') {
      addLine([-.17 * scale, artworkY(.42)], [-.17 * scale, artworkY(.73)], [.17 * scale, artworkY(.73)], [.17 * scale, artworkY(.42)], [-.17 * scale, artworkY(.42)]);
      addLine([-.17 * scale, artworkY(.68)], [-.29 * scale, artworkY(.66)], [-.27 * scale, artworkY(.39)], [-.16 * scale, artworkY(.43)]);
      addLine([.17 * scale, artworkY(.68)], [.29 * scale, artworkY(.66)], [.27 * scale, artworkY(.39)], [.16 * scale, artworkY(.43)]);
      addLine([-.09 * scale, artworkY(.61)], [-.06 * scale, artworkY(.61)]);
      addLine([.06 * scale, artworkY(.61)], [.09 * scale, artworkY(.61)]);
      addLine([-.12 * scale, artworkY(.49)], [-.12 * scale, artworkY(.39)], [0, artworkY(.33)], [.12 * scale, artworkY(.39)], [.12 * scale, artworkY(.49)]);
      addLine([-.035 * scale, artworkY(.43)], [.035 * scale, artworkY(.43)]);
      addLine([-.12 * scale, artworkY(.34)], [-.12 * scale, artworkY(.12)], [.12 * scale, artworkY(.12)], [.12 * scale, artworkY(.34)]);
      addLine([.12 * scale, artworkY(.17)], [.25 * scale, artworkY(.22)], [.25 * scale, artworkY(.32)]);
    } else if (object.subject === 'cat') {
      addLine([-.19 * scale, artworkY(.36)], [.19 * scale, artworkY(.36)], [.19 * scale, artworkY(.72)], [-.19 * scale, artworkY(.72)], [-.19 * scale, artworkY(.36)]);
      addLine([-.16 * scale, artworkY(.70)], [-.13 * scale, artworkY(.96)], [-.035 * scale, artworkY(.72)]);
      addLine([.035 * scale, artworkY(.72)], [.13 * scale, artworkY(.96)], [.16 * scale, artworkY(.70)]);
      addLine([-.09 * scale, artworkY(.55)], [-.06 * scale, artworkY(.55)]);
      addLine([.06 * scale, artworkY(.55)], [.09 * scale, artworkY(.55)]);
      addLine([-.15 * scale, artworkY(.49)], [-.27 * scale, artworkY(.46)]);
      addLine([.15 * scale, artworkY(.49)], [.27 * scale, artworkY(.46)]);
      addLine([-.13 * scale, artworkY(.34)], [-.13 * scale, artworkY(.12)], [.13 * scale, artworkY(.12)], [.13 * scale, artworkY(.34)]);
      addLine([.13 * scale, artworkY(.17)], [.25 * scale, artworkY(.22)], [.25 * scale, artworkY(.32)]);
    } else if (object.subject === 'coffee-table') {
      addLine([-.44 * scale, artworkY(.64)], [-.3 * scale, artworkY(.82)], [.3 * scale, artworkY(.82)], [.44 * scale, artworkY(.64)], [-.44 * scale, artworkY(.64)]);
      addLine([-.44 * scale, artworkY(.64)], [.44 * scale, artworkY(.64)], [.44 * scale, artworkY(.56)], [-.44 * scale, artworkY(.56)], [-.44 * scale, artworkY(.64)]);
      addLine([-.35 * scale, artworkY(.56)], [-.35 * scale, artworkY(.2)]);
      addLine([.35 * scale, artworkY(.56)], [.35 * scale, artworkY(.2)]);
      addLine([-.25 * scale, artworkY(.64)], [-.25 * scale, artworkY(.28)]);
      addLine([.25 * scale, artworkY(.64)], [.25 * scale, artworkY(.28)]);
      addLine([-.25 * scale, artworkY(.32)], [.25 * scale, artworkY(.32)]);
    } else if (object.subject === 'box') {
      addLine([-.32 * scale, artworkY(.2)], [.32 * scale, artworkY(.2)], [.32 * scale, artworkY(.72)], [-.32 * scale, artworkY(.72)], [-.32 * scale, artworkY(.2)]);
      addLine([-.32 * scale, artworkY(.72)], [0, artworkY(.9)], [.32 * scale, artworkY(.72)]);
      addLine([0, artworkY(.2)], [0, artworkY(.9)]);
    } else if (object.subject === 'guitar') {
      addLine([0, artworkY(.16)], [-.14 * scale, artworkY(.2)], [-.24 * scale, artworkY(.35)], [-.22 * scale, artworkY(.52)], [-.12 * scale, artworkY(.59)], [-.06 * scale, artworkY(.55)], [0, artworkY(.53)], [.06 * scale, artworkY(.55)], [.12 * scale, artworkY(.59)], [.22 * scale, artworkY(.52)], [.24 * scale, artworkY(.35)], [.14 * scale, artworkY(.2)], [0, artworkY(.16)]);
      addLine([-.055 * scale, artworkY(.54)], [-.045 * scale, artworkY(.9)], [.045 * scale, artworkY(.9)], [.055 * scale, artworkY(.54)]);
      addLine([-.045 * scale, artworkY(.88)], [-.075 * scale, artworkY(.96)], [.075 * scale, artworkY(.96)], [.045 * scale, artworkY(.88)]);
      addLine([0, artworkY(.23)], [0, artworkY(.95)]);
      addLine([-.13 * scale, artworkY(.29)], [.13 * scale, artworkY(.29)]);
      addLine([-.11 * scale, artworkY(.36)], [.11 * scale, artworkY(.36)]);
    } else if (object.subject === 'h') {
      addLine([-.22 * scale, artworkY(.16)], [-.12 * scale, artworkY(.16)], [-.12 * scale, artworkY(.84)], [-.22 * scale, artworkY(.84)], [-.22 * scale, artworkY(.16)]);
      addLine([.12 * scale, artworkY(.16)], [.22 * scale, artworkY(.16)], [.22 * scale, artworkY(.84)], [.12 * scale, artworkY(.84)], [.12 * scale, artworkY(.16)]);
      addLine([-.12 * scale, artworkY(.47)], [.12 * scale, artworkY(.47)]);
    } else if (object.subject === 'snake') {
      addLine([-.28 * scale, artworkY(.22)], [-.18 * scale, artworkY(.38)], [-.04 * scale, artworkY(.28)], [.1 * scale, artworkY(.42)], [.23 * scale, artworkY(.34)], [.18 * scale, artworkY(.55)], [.04 * scale, artworkY(.63)], [-.1 * scale, artworkY(.55)], [-.24 * scale, artworkY(.69)], [-.12 * scale, artworkY(.78)], [.04 * scale, artworkY(.73)], [.22 * scale, artworkY(.82)]);
      addLine([.22 * scale, artworkY(.82)], [.27 * scale, artworkY(.85)], [.25 * scale, artworkY(.77)], [.22 * scale, artworkY(.82)]);
      addLine([.25 * scale, artworkY(.83)], [.27 * scale, artworkY(.83)]);
    } else if (object.subject === 'apple') {
      addLine([0, artworkY(.22)], [-.09 * scale, artworkY(.29)], [-.21 * scale, artworkY(.28)], [-.3 * scale, artworkY(.4)], [-.28 * scale, artworkY(.65)], [-.15 * scale, artworkY(.79)], [0, artworkY(.74)], [.15 * scale, artworkY(.79)], [.28 * scale, artworkY(.65)], [.3 * scale, artworkY(.4)], [.21 * scale, artworkY(.28)], [.09 * scale, artworkY(.29)], [0, artworkY(.22)]);
      addLine([0, artworkY(.74)], [.015 * scale, artworkY(.9)], [.05 * scale, artworkY(.96)]);
      addLine([.025 * scale, artworkY(.84)], [.19 * scale, artworkY(.92)], [.09 * scale, artworkY(.78)], [.025 * scale, artworkY(.84)]);
    } else if (object.subject === 'telephone') {
      addLine([-.28 * scale, artworkY(.2)], [.28 * scale, artworkY(.2)], [.24 * scale, artworkY(.46)], [-.24 * scale, artworkY(.46)], [-.28 * scale, artworkY(.2)]);
      addLine([-.28 * scale, artworkY(.2)], [-.24 * scale, artworkY(.46)]);
      addLine([.28 * scale, artworkY(.2)], [.24 * scale, artworkY(.46)]);
      addLine([-.21 * scale, artworkY(.56)], [-.18 * scale, artworkY(.72)], [-.1 * scale, artworkY(.78)], [.1 * scale, artworkY(.78)], [.18 * scale, artworkY(.72)], [.21 * scale, artworkY(.56)]);
      addLine([-.21 * scale, artworkY(.56)], [-.26 * scale, artworkY(.66)], [-.29 * scale, artworkY(.82)]);
      addLine([.21 * scale, artworkY(.56)], [.26 * scale, artworkY(.66)], [.29 * scale, artworkY(.82)]);
      addLine([-.1 * scale, artworkY(.25)], [.1 * scale, artworkY(.25)], [.1 * scale, artworkY(.4)], [-.1 * scale, artworkY(.4)], [-.1 * scale, artworkY(.25)]);
      for (const [u, v] of [[-.06,.29],[0,.29],[.06,.29],[-.06,.36],[0,.36],[.06,.36]]) {
        addLine([u * scale, artworkY(v)], [(u + .018) * scale, artworkY(v + .015)], [(u - .018) * scale, artworkY(v + .015)], [u * scale, artworkY(v)]);
      }
    } else if (object.subject === 'glasses') {
      addLine([-.3 * scale, artworkY(.42)], [-.29 * scale, artworkY(.65)], [-.04 * scale, artworkY(.65)], [-.03 * scale, artworkY(.42)], [-.3 * scale, artworkY(.42)]);
      addLine([.03 * scale, artworkY(.42)], [.04 * scale, artworkY(.65)], [.29 * scale, artworkY(.65)], [.3 * scale, artworkY(.42)], [.03 * scale, artworkY(.42)]);
      addLine([-.03 * scale, artworkY(.58)], [0, artworkY(.54)], [.03 * scale, artworkY(.58)]);
      addLine([-.3 * scale, artworkY(.62)], [-.37 * scale, artworkY(.67)]);
      addLine([.3 * scale, artworkY(.62)], [.37 * scale, artworkY(.67)]);
    } else if (object.subject === 'penny') {
      addLine(...Array.from({ length: 17 }, (_, index) => {
        const angle = index / 16 * Math.PI * 2;
        return [.23 * scale * Math.cos(angle), artworkY(.52 + .38 * Math.sin(angle))];
      }));
      addLine(...Array.from({ length: 17 }, (_, index) => {
        const angle = index / 16 * Math.PI * 2;
        return [.18 * scale * Math.cos(angle), artworkY(.52 + .3 * Math.sin(angle))];
      }));
      addLine([-.035 * scale, artworkY(.3)], [.025 * scale, artworkY(.35)], [.025 * scale, artworkY(.68)], [.095 * scale, artworkY(.68)]);
    } else if (object.subject === 'fish') {
      addLine([-.26 * scale, artworkY(.52)], [-.16 * scale, artworkY(.68)], [.02 * scale, artworkY(.76)], [.2 * scale, artworkY(.66)], [.27 * scale, artworkY(.52)], [.2 * scale, artworkY(.38)], [.02 * scale, artworkY(.28)], [-.16 * scale, artworkY(.36)], [-.26 * scale, artworkY(.52)]);
      addLine([-.25 * scale, artworkY(.52)], [-.37 * scale, artworkY(.7)], [-.35 * scale, artworkY(.52)], [-.37 * scale, artworkY(.34)], [-.25 * scale, artworkY(.52)]);
      addLine([-.02 * scale, artworkY(.72)], [.06 * scale, artworkY(.88)], [.14 * scale, artworkY(.7)]);
      addLine([-.02 * scale, artworkY(.31)], [.06 * scale, artworkY(.15)], [.14 * scale, artworkY(.33)]);
      addLine([.2 * scale, artworkY(.56)], [.08 * scale, artworkY(.52)], [.19 * scale, artworkY(.48)]);
      addLine([.19 * scale, artworkY(.61)], [.21 * scale, artworkY(.61)]);
    } else {
      throw new Error(`Unsupported wall picture subject: ${object.subject}`);
    }
    return {
      type: 'picture', subject: object.subject, lines, side: object.side, x, y, w: object.w, h: object.h,
      building: building.name, room: Number(building.grid[object.row][object.col])
    };
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
      if (['h', 'snake', 'apple', 'telephone', 'glasses', 'toycar', 'dog', 'penny', 'fish'].includes(object.type)) {
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
    roomCount: roomIdsIn(building.grid).length
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
      return { building: building.name, room: Number(building.grid[row][col]), roomCount: roomIdsIn(building.grid).length };
    }
  };
}
