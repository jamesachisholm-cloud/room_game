import { SIZE } from './world-constants.js?v=20261038';

export function buildWorldMap(plan, buildings, padding) {
  const placed = Object.fromEntries(buildings.map(building => [building.name, building]));
  const width = Math.max(...buildings.map(building => building.x + building.w)) + padding;
  const height = Math.max(...buildings.map(building => building.y + building.h)) + padding;
  const map = Array.from({ length: height }, () => Array(width).fill(0));
  const doors = new Map();
  const interiorWallEdges = [];
  const interiorDoorEdges = [];
  const interiorDoorIds = new Set();
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

  // Interior partitions live on the shared boundary between adjacent floor
  // cells. Clear their old two-cell raster footprint and retain the wall as a
  // zero-thickness edge for rendering and collision.
  for (const building of buildings) {
    const addPartition = (orientation, line, start, end) => {
      const vertical = orientation === 'vertical';
      // A line can contain multiple disjoint partition segments. Only the
      // segment containing the door opening may claim its ID; otherwise a
      // nearby collinear wall can be misclassified as part of this doorway.
      const door = building.doors.find(candidate => candidate.orientation === orientation
        && candidate.line === line
        && candidate.start + candidate.offset < end
        && candidate.start + candidate.offset + candidate.width > start);
      let doorId = null;
      let doorStart = -1;
      let doorEnd = -1;
      if (door) {
        doorId = doors.get(vertical
          ? `${building.x + line - 1},${building.y + door.start + door.offset}`
          : `${building.x + door.start + door.offset},${building.y + line - 1}`) ?? null;
        doorStart = (vertical ? building.y : building.x) + door.start + door.offset;
        doorEnd = doorStart + door.width;
        if (doorId !== null) interiorDoorIds.add(doorId);
      }
      const globalLine = (vertical ? building.x : building.y) + line;
      for (let along = start; along < end; along++) {
        const globalAlong = (vertical ? building.y : building.x) + along;
        const perimeterStart = vertical ? building.y : building.x;
        const perimeterEnd = perimeterStart + (vertical ? building.h : building.w) - 1;
        if (globalAlong > perimeterStart && globalAlong < perimeterEnd) {
          if (vertical) {
            map[globalAlong][globalLine - 1] = 0;
            map[globalAlong][globalLine] = 0;
          } else {
            map[globalLine - 1][globalAlong] = 0;
            map[globalLine][globalAlong] = 0;
          }
        }
        if (globalAlong > perimeterStart && globalAlong < perimeterEnd && doorId !== null && globalAlong >= doorStart && globalAlong < doorEnd) {
          interiorDoorEdges.push({ orientation, line: globalLine, along: globalAlong, id: doorId });
        } else if (globalAlong > perimeterStart && globalAlong < perimeterEnd) {
          interiorWallEdges.push({ orientation, line: globalLine, along: globalAlong });
        }
      }
      // Clear the rasterized corner cell at the end of each segment. The
      // zero-thickness edge ends at this grid line, so leaving that cell solid
      // creates a one-cell stub that reads as a wall protrusion.
      const endpoint = (vertical ? building.y : building.x) + end;
      const perimeterStart = vertical ? building.y : building.x;
      const perimeterEnd = perimeterStart + (vertical ? building.h : building.w) - 1;
      if (endpoint > perimeterStart && endpoint < perimeterEnd) {
        if (vertical) {
          map[endpoint][globalLine - 1] = 0;
          map[endpoint][globalLine] = 0;
        } else {
          map[globalLine - 1][endpoint] = 0;
          map[globalLine][endpoint] = 0;
        }
      }
    };
    for (let row = 0; row < building.rows; row++) {
      for (let col = 0; col + 1 < building.cols; col++) {
        if (building.grid[row][col] === building.grid[row][col + 1]) continue;
        addPartition('vertical', (col + 1) * SIZE, row * SIZE, (row + 1) * SIZE);
      }
    }
    for (let row = 0; row + 1 < building.rows; row++) {
      for (let col = 0; col < building.cols; col++) {
        if (building.grid[row][col] === building.grid[row + 1][col]) continue;
        addPartition('horizontal', (row + 1) * SIZE, col * SIZE, (col + 1) * SIZE);
      }
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
        id: doorId, pairId: definition.pairId, building: building.name, roomId: definition.roomId, tollAmount: definition.toll ?? 0,
        requiredItem: definition.requiredItem,
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
    // Both doors of a pair share one toll, so paying at either side opens both for good.
    const amount = Math.max(...pair.map(portal => portal.tollAmount));
    if (amount > 0) {
      const toll = { amount, paid: false };
      for (const portal of pair) portal.toll = toll;
    }
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
      return { axis: 'x', from: edgeX(firstBuilding), to: otherEdgeX(secondBuilding), fixed: firstCell.y + .5, corridor: connection.corridor, drawPath: connection.drawPath };
    }
    if (firstCell.x !== secondCell.x) throw new Error('North/south linked exits must line up on the same column.');
    const edgeY = (building, side) => side === 'south' ? building.y + building.h : building.y;
    return { axis: 'y', from: edgeY(firstBuilding, connection.fromSide), to: edgeY(secondBuilding, connection.toSide), fixed: firstCell.x + .5, corridor: connection.corridor, drawPath: connection.drawPath };
  });
  // A corridor is a door-wide path with solid wall cells on both sides and a ceiling over it.
  const corridors = [];
  for (const path of paths) {
    if (!path.corridor) continue;
    const low = Math.min(path.from, path.to);
    const high = Math.max(path.from, path.to);
    const lane = Math.floor(path.fixed);
    for (let along = low; along < high; along++) {
      if (path.axis === 'x') {
        map[lane - 1][along] = 1;
        map[lane + 1][along] = 1;
      } else {
        map[along][lane - 1] = 1;
        map[along][lane + 1] = 1;
      }
    }
    corridors.push(path.axis === 'x'
      ? { x: low, y: lane - 1, w: high - low, h: 3 }
      : { x: lane - 1, y: low, w: 3, h: high - low });
  }
  for (const route of plan.junctionPaths) {
    if (route.type === 'segment') {
      if (![route.x1, route.y1, route.x2, route.y2].every(Number.isFinite) || (route.x1 !== route.x2 && route.y1 !== route.y2)) {
        throw new Error(`Path segment must have finite coordinates and run horizontally or vertically: ${JSON.stringify(route)}`);
      }
      paths.push(route.x1 === route.x2
        ? { axis: 'y', from: route.y1, to: route.y2, fixed: route.x1 }
        : { axis: 'x', from: route.x1, to: route.x2, fixed: route.y1 });
      continue;
    }
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
  // A path that ends in a corridor lane needs a doorway through the corridor wall.
  for (const path of paths) {
    if (path.corridor || path.axis === undefined) continue;
    for (const corridor of corridors) {
      const lane = corridor.w > corridor.h ? corridor.y + 1 : corridor.x + 1;
      const corridorAlongX = corridor.w > corridor.h;
      if (corridorAlongX === (path.axis === 'x')) continue;
      const end = [path.from, path.to].find(value => Math.floor(value) === lane);
      if (end === undefined) continue;
      const cross = Math.floor(path.fixed);
      const start = corridorAlongX ? corridor.x : corridor.y;
      if (cross < start || cross >= start + (corridorAlongX ? corridor.w : corridor.h)) continue;
      const otherEnd = end === path.from ? path.to : path.from;
      const wall = lane + Math.sign(otherEnd - end);
      if (corridorAlongX) map[wall][cross] = 0;
      else map[cross][wall] = 0;
    }
  }
  return { width, height, map, doors, paths, corridors, magicDoors, magicDoorIds, interiorWallEdges, interiorDoorEdges, interiorDoorIds };
}
