export const SIZE = 7;
const PAD = 12;
const ROOM_LENGTHS = 10;
const ROOM_FT = 10;
export const CELL_FT = ROOM_FT / SIZE;

async function loadPlan() {
  const response = await fetch('./maps/world.map?v=20261026', { cache: 'no-store' });
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
    } else if (section === 'rooms' && current) {
      current.grid.push(parts);
    } else if (section === 'doors' && current && parts[0] === 'door') {
      current.doors.push({
        roomA: parts[1].padStart(2, '0'), roomB: parts[2].padStart(2, '0'),
        offset: Number(parts[3]), width: Number(parts[4] ?? 1)
      });
    } else if (section === 'exits' && current && parts[0] === 'exit') {
      current.exits.push({ side: parts[1], roomId: parts[2].padStart(2, '0') });
    } else if (section === 'magicdoors' && current && parts[0] === 'magicdoor') {
      current.magicDoors.push({ side: parts[1], roomId: parts[2].padStart(2, '0'), pairId: parts[3] });
    } else if (section === 'objects' && current && parts[0] === 'box') {
      current.objects.push({ type: 'box', col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), w: Number(parts[5]), d: Number(parts[6]), h: Number(parts[7]) });
    } else if (section === 'objects' && current && parts[0] === 'table') {
      current.objects.push({ type: 'table', col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), w: Number(parts[5]), d: Number(parts[6]), h: Number(parts[7]) });
    } else if (section === 'objects' && current && parts[0] === 'cat') {
      current.objects.push({ type: 'cat', col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), scale: Number(parts[5]) });
    } else if (section === 'objects' && current && parts[0] === 'picture') {
      current.objects.push({ type: 'picture', subject: parts[1], col: Number(parts[2]), row: Number(parts[3]), side: parts[4], offset: Number(parts[5]), z: Number(parts[6]), w: Number(parts[7]), h: Number(parts[8]) });
    } else if (section === 'connections') {
      connections.push({ fromBuilding: parts[0], fromSide: parts[1], toBuilding: parts[2], toSide: parts[3] });
    } else {
      throw new Error(`Unrecognized map line: ${rawLine}`);
    }
  }

  if (buildings.length !== 4) throw new Error('The world map must define four buildings.');
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
      if (walls.length !== 1) {
        throw new Error(`Rooms ${door.roomA} and ${door.roomB} in Building ${building.name} must share one continuous wall for this door format.`);
      }
      door.orientation = walls[0].orientation;
      door.line = walls[0].line;
      door.start = walls[0].start;
      door.end = walls[0].end;
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
      const position = start + Math.floor((end - start - 1) / 2);
      exit.bay = Math.floor(position / SIZE);
      exit.offset = position % SIZE;
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
  return { buildings, connections };
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
  const placed = {
    A: { ...A, x: PAD + SIZE, y: PAD },
    B: { ...B, x: 0, y: PAD },
    C: { ...C, x: 0, y: 0 },
    D: { ...D, x: 0, y: 0 }
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
  const buildings = [placed.A, placed.B, placed.C, placed.D];
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
    } else {
      throw new Error(`Unsupported wall picture subject: ${object.subject}`);
    }
    return { type: 'picture', subject: object.subject, lines, side: object.side, x, y, w: object.w, h: object.h };
  }
  const boxes = [];
  const tables = [];
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
        const box = { type: 'box', x, y, w: object.w, d: object.d, h: object.h, held: false };
        boxes.push(box);
        pickups.push(box);
      }
      if (object.type === 'table') {
        const topThickness = object.h * .18;
        const legWidth = Math.min(object.w, object.d) * .13;
        const legHeight = object.h - topThickness;
        const table = {
          type: 'table', x, y, w: object.w, d: object.d, h: object.h, held: false,
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
        cat = { ...makeCat(x, y, object.scale), type: 'cat', x, y, scale: object.scale, held: false };
        pickups.push(cat);
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
    buildings, buildingPlans, map, doors, paths, boxes, tables, pictures, cat, pickups, magicDoors, magicDoorIds, width, height, start,
    moveObject(object, x, y) {
      const dx = x - object.x;
      const dy = y - object.y;
      object.x = x;
      object.y = y;
      if (object.type === 'cat') {
        for (const part of object.cuboids) {
          part.x += dx;
          part.y += dy;
        }
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
