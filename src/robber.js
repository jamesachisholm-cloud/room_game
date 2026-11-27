import { SIZE } from './world-constants.js?v=20261038';
import { hasClearFootprint } from './placement.js?v=20261038';

const ROBBER_SPEED = 1.08;
const REPLAN_SECONDS = 1.2;
const CATCH_DISTANCE = .72;
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
let pathWorkspace = null;

function getPathWorkspace(width, height) {
  const size = width * height;
  if (!pathWorkspace || pathWorkspace.width !== width || pathWorkspace.height !== height) {
    pathWorkspace = {
      width, height,
      scores: new Float32Array(size), parents: new Int32Array(size),
      seen: new Uint32Array(size), closed: new Uint32Array(size), generation: 0,
      heap: []
    };
  }
  const workspace = pathWorkspace;
  workspace.generation = (workspace.generation + 1) >>> 0;
  if (!workspace.generation) {
    workspace.seen.fill(0);
    workspace.closed.fill(0);
    workspace.generation = 1;
  }
  workspace.heap.length = 0;
  return workspace;
}

function findPath(world, startX, startY, goalX, goalY) {
  const { width, height, map } = world;
  const start = Math.floor(startY) * width + Math.floor(startX);
  const goal = Math.floor(goalY) * width + Math.floor(goalX);
  if (start === goal) return [];

  const workspace = getPathWorkspace(width, height);
  const { scores, parents, seen, closed, heap, generation } = workspace;
  const heuristic = index => Math.abs(index % width - goalX) + Math.abs(Math.floor(index / width) - goalY);
  const push = (index, score) => {
    const node = { index, score };
    let child = heap.length;
    heap.push(node);
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (heap[parent].score <= score) break;
      heap[child] = heap[parent];
      child = parent;
    }
    heap[child] = node;
  };
  const pop = () => {
    const first = heap[0];
    const last = heap.pop();
    if (heap.length) {
      let parent = 0;
      while (true) {
        const left = parent * 2 + 1;
        if (left >= heap.length) break;
        const right = left + 1;
        const child = right < heap.length && heap[right].score < heap[left].score ? right : left;
        if (heap[child].score >= last.score) break;
        heap[parent] = heap[child];
        parent = child;
      }
      heap[parent] = last;
    }
    return first;
  };

  scores[start] = 0;
  seen[start] = generation;
  push(start, heuristic(start));
  while (heap.length) {
    const current = pop().index;
    if (closed[current] === generation) continue;
    if (current === goal) {
      const path = [];
      for (let index = goal; index !== start; index = parents[index]) {
        path.push({ x: index % width + .5, y: Math.floor(index / width) + .5 });
      }
      path.reverse();
      return path;
    }
    closed[current] = generation;
    const x = current % width;
    const y = Math.floor(current / width);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || map[ny][nx] === 1) continue;
      const next = ny * width + nx;
      if (closed[next] === generation) continue;
      const score = scores[current] + 1;
      if (seen[next] === generation && score >= scores[next]) continue;
      if (!world.canMove(x + .5, y + .5, nx + .5, ny + .5)) continue;
      scores[next] = score;
      seen[next] = generation;
      parents[next] = current;
      push(next, score + heuristic(next));
    }
  }
  return [];
}

function initialPosition(world) {
  const building = world.buildings.find(candidate => candidate.name === 'E');
  for (let row = 0; row < building.rows; row++) {
    for (let col = 0; col < building.cols; col++) {
      const x = building.x + col * SIZE + SIZE / 2;
      const y = building.y + row * SIZE + SIZE / 2;
      if (!world.isWall(Math.floor(x), Math.floor(y))) return { x, y };
    }
  }
  return { x: building.x + 1.5, y: building.y + 1.5 };
}

function getStashRooms(world, { emptyOnly = true } = {}) {
  const buildings = world.buildings.filter(candidate => ['A', 'B', 'C', 'D'].includes(candidate.name));
  const occupied = new Set();
  for (const object of world.pickups) {
    if (object.held) continue;
    const room = world.getRoomAt(object.x, object.y);
    if (room && ['A', 'B', 'C', 'D'].includes(room.building)) occupied.add(`${room.building}:${room.room}`);
  }
  const rooms = new Map();
  for (const building of buildings) {
    for (let row = 0; row < building.rows; row++) {
      for (let col = 0; col < building.cols; col++) {
        const roomId = Number(building.grid[row][col]);
        const key = `${building.name}:${roomId}`;
        if (emptyOnly && occupied.has(key)) continue;
        if (!rooms.has(key)) rooms.set(key, { key, building, roomId, bays: [] });
        rooms.get(key).bays.push({ col, row });
      }
    }
  }
  return [...rooms.values()];
}

export function stashTicket(world, ticket) {
  const rooms = getStashRooms(world, { emptyOnly: false });
  // Select a room first so the ticket is guaranteed to land in a random room,
  // rather than having larger rooms dominate the placement lottery.
  const shuffledRooms = rooms.slice();
  for (let i = shuffledRooms.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledRooms[i], shuffledRooms[j]] = [shuffledRooms[j], shuffledRooms[i]];
  }
  for (const room of shuffledRooms) {
    const positions = [];
    for (const { col, row } of room.bays) {
      for (let y = 1; y < SIZE - 1; y++) {
        for (let x = 1; x < SIZE - 1; x++) {
          const worldX = room.building.x + col * SIZE + x + .5;
          const worldY = room.building.y + row * SIZE + y + .5;
          if (!hasClearFootprint(world, ticket, worldX, worldY)) continue;
          if (world.pickups.some(other => other !== ticket && !other.held && Math.hypot(other.x - worldX, other.y - worldY) < .9)) continue;
          positions.push({ x: worldX, y: worldY });
        }
      }
    }
    if (!positions.length) continue;
    const destination = positions[Math.floor(Math.random() * positions.length)];
    world.moveObject(ticket, destination.x, destination.y);
    ticket.held = false;
    return true;
  }
  return false;
}

function placeStolenObject(world, object, emptyRooms, roomsUsedThisCatch) {
  const unusedRooms = emptyRooms.filter(room => !roomsUsedThisCatch.has(room.key));
  const candidateRooms = unusedRooms.length ? unusedRooms : emptyRooms;
  const positions = [];
  for (const room of candidateRooms) {
    for (const { col, row } of room.bays) {
      for (const offsetX of [1.6, 5.4]) {
        for (const offsetY of [1.6, 5.4]) {
          const x = room.building.x + col * SIZE + offsetX;
          const y = room.building.y + row * SIZE + offsetY;
          if (!hasClearFootprint(world, object, x, y)) continue;
          if (world.pickups.some(other => other !== object && !other.held && Math.hypot(other.x - x, other.y - y) < .9)) continue;
          positions.push({ x, y, roomKey: room.key });
        }
      }
    }
  }

  if (!positions.length) {
    for (const room of candidateRooms) {
      for (const { col, row } of room.bays) {
        for (let y = 1; y < SIZE - 1; y++) {
          for (let x = 1; x < SIZE - 1; x++) {
            const worldX = room.building.x + col * SIZE + x + .5;
            const worldY = room.building.y + row * SIZE + y + .5;
            if (!hasClearFootprint(world, object, worldX, worldY)) continue;
            if (world.pickups.some(other => other !== object && !other.held && Math.hypot(other.x - worldX, other.y - worldY) < .9)) continue;
            positions.push({ x: worldX, y: worldY, roomKey: room.key });
          }
        }
      }
    }
  }

  if (!positions.length) return false;
  const destination = positions[Math.floor(Math.random() * positions.length)];
  world.moveObject(object, destination.x, destination.y);
  object.held = false;
  roomsUsedThisCatch.add(destination.roomKey);
  return true;
}

export function createRobber(world) {
  const position = initialPosition(world);
  return { ...position, path: [], pathIndex: 0, replanIn: 0 };
}

export function updateRobber(robber, world, player, dt, onCatch) {
  robber.catchCooldown = Math.max(0, (robber.catchCooldown ?? 0) - dt);
  robber.replanIn -= dt;
  if (robber.replanIn <= 0) {
    const goalX = Math.floor(player.x);
    const goalY = Math.floor(player.y);
    // Keep following a valid route to the same tile, but retry if movement has stalled.
    if (goalX !== robber.goalX || goalY !== robber.goalY
      || robber.pathIndex <= robber.lastReplanIndex || robber.pathIndex >= robber.path.length) {
      robber.path = findPath(world, robber.x, robber.y, player.x, player.y);
      robber.pathIndex = 0;
      robber.goalX = goalX;
      robber.goalY = goalY;
    }
    robber.lastReplanIndex = robber.pathIndex;
    robber.replanIn = REPLAN_SECONDS;
  }
  const target = robber.path[robber.pathIndex];
  const dx = (target?.x ?? player.x) - robber.x;
  const dy = (target?.y ?? player.y) - robber.y;
  const distance = Math.hypot(dx, dy);
  const step = Math.min(distance, ROBBER_SPEED * dt);
  if (distance > 0) {
    const nextX = robber.x + dx / distance * step;
    const nextY = robber.y + dy / distance * step;
    if (!world.isWall(Math.floor(nextX), Math.floor(robber.y)) && world.canMove(robber.x, robber.y, nextX, robber.y, .14)) robber.x = nextX;
    if (!world.isWall(Math.floor(robber.x), Math.floor(nextY)) && world.canMove(robber.x, robber.y, robber.x, nextY, .14)) robber.y = nextY;
  }
  if (target && distance < .14) robber.pathIndex++;

  if (robber.catchCooldown <= 0 && Math.hypot(player.x - robber.x, player.y - robber.y) <= CATCH_DISTANCE) {
    const stole = onCatch();
    robber.catchCooldown = stole ? 6 : 2;
    if (stole) {
      Object.assign(robber, initialPosition(world));
      robber.path = [];
      robber.pathIndex = 0;
      robber.replanIn = 0;
    }
  }
}

export function stealInventoryObjects(world, player) {
  const occupied = player.inventory.flatMap((object, slot) => object ? [{ object, slot }] : []);
  if (!occupied.length) return 0;
  let stolenCount = 0;
  const emptyRooms = getStashRooms(world);
  const roomsUsedThisCatch = new Set();
  for (const { object, slot } of occupied) {
    if (!placeStolenObject(world, object, emptyRooms, roomsUsedThisCatch)) continue;
    player.inventory[slot] = null;
    stolenCount++;
  }
  const nextSlot = player.inventory.findIndex(object => object !== null);
  player.selectedInventorySlot = nextSlot >= 0 ? nextSlot : 0;
  return stolenCount;
}
