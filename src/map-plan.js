import { SIZE } from './world-constants.js?v=20261037';
import { OBJECT_METADATA, SIMPLE_OBJECT_TYPES } from './object-types.js?v=20261037';

export async function loadPlan() {
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
    } else if (section === 'objects' && current && ['box', 'table'].includes(parts[0])) {
      current.objects.push({ type: parts[0], col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), w: Number(parts[5]), d: Number(parts[6]), h: Number(parts[7]), value: Number(parts[8] ?? OBJECT_METADATA[parts[0]].defaultValue) });
    } else if (section === 'objects' && current && ['cat', 'guitar'].includes(parts[0])) {
      current.objects.push({ type: parts[0], col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), scale: Number(parts[5]), value: Number(parts[6] ?? OBJECT_METADATA[parts[0]].defaultValue) });
    } else if (section === 'objects' && current && SIMPLE_OBJECT_TYPES.includes(parts[0])) {
      current.objects.push({ type: parts[0], col: Number(parts[1]), row: Number(parts[2]), x: Number(parts[3]), y: Number(parts[4]), scale: Number(parts[5]), value: Number(parts[6] ?? OBJECT_METADATA[parts[0]].defaultValue) });
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
    const roomIds = roomIdsIn(building.grid);
    for (const roomId of roomIds) {
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
      if (!roomIds.includes(door.roomA) || !roomIds.includes(door.roomB) || door.roomA === door.roomB) {
        throw new Error(`Building ${building.name} has a doorway that names a missing or identical room.`);
      }
      const walls = sharedWalls(building.grid, door.roomA, door.roomB);
      if (!walls.length) throw new Error(`Rooms ${door.roomA} and ${door.roomB} in Building ${building.name} must share a wall for a door.`);
      // If rooms share multiple segments, use the first found north-west to south-east.
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
      if (!['north', 'east', 'south', 'west'].includes(exit.side) || !roomIds.includes(exit.roomId)) {
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
      if (!['north', 'east', 'south', 'west'].includes(gate.side) || !roomIds.includes(gate.roomId) || !gate.pairId) {
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

export function roomIdsIn(grid) {
  return [...new Set(grid.flat())];
}