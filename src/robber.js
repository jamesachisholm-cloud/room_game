import { SIZE } from './world-constants.js?v=20261038';
import { hasClearFootprint } from './placement.js?v=20261038';

const ROBBER_SPEED = 1.8;
const REPLAN_SECONDS = 1.2;
const CATCH_DISTANCE = .72;

function findPath(world, startX, startY, goalX, goalY) {
  const { width, height, map } = world;
  const start = Math.floor(startY) * width + Math.floor(startX);
  const goal = Math.floor(goalY) * width + Math.floor(goalX);
  if (start === goal) return [];

  const scores = new Float32Array(width * height);
  scores.fill(Infinity);
  const parents = new Int32Array(width * height);
  parents.fill(-1);
  const closed = new Uint8Array(width * height);
  const heap = [];
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
  push(start, heuristic(start));
  while (heap.length) {
    const current = pop().index;
    if (closed[current]) continue;
    if (current === goal) {
      const path = [];
      for (let index = goal; index !== start; index = parents[index]) {
        path.push({ x: index % width + .5, y: Math.floor(index / width) + .5 });
      }
      path.reverse();
      return path;
    }
    closed[current] = 1;
    const x = current % width;
    const y = Math.floor(current / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || map[ny][nx] === 1) continue;
      const next = ny * width + nx;
      if (closed[next]) continue;
      const score = scores[current] + 1;
      if (score >= scores[next]) continue;
      scores[next] = score;
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

function furthestRoomPosition(world, player) {
  const building = world.buildings.find(candidate => candidate.name === 'E');
  let best = initialPosition(world);
  let bestDistance = -1;
  for (let row = 0; row < building.rows; row++) {
    for (let col = 0; col < building.cols; col++) {
      const x = building.x + col * SIZE + SIZE / 2;
      const y = building.y + row * SIZE + SIZE / 2;
      if (world.isWall(Math.floor(x), Math.floor(y))) continue;
      const distance = (player.x - x) ** 2 + (player.y - y) ** 2;
      if (distance > bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  return best;
}

function placeStolenObject(world, object) {
  const building = world.buildings.find(candidate => candidate.name === 'E');
  const positionsByRoom = new Map();
  for (let row = 0; row < building.rows; row++) {
    for (let col = 0; col < building.cols; col++) {
      const x = building.x + col * SIZE + SIZE / 2;
      const y = building.y + row * SIZE + SIZE / 2;
      if (!hasClearFootprint(world, object, x, y)) continue;
      if (world.pickups.some(other => other !== object && !other.held && Math.hypot(other.x - x, other.y - y) < .9)) continue;
      const room = building.grid[row][col];
      if (!positionsByRoom.has(room)) positionsByRoom.set(room, []);
      positionsByRoom.get(room).push({ x, y });
    }
  }
  const rooms = [...positionsByRoom.values()];
  if (rooms.length) {
    const roomPositions = rooms[Math.floor(Math.random() * rooms.length)];
    const destination = roomPositions[Math.floor(Math.random() * roomPositions.length)];
    world.moveObject(object, destination.x, destination.y);
    object.held = false;
    return true;
  }
  return false;
}

export function createRobber(world) {
  const position = initialPosition(world);
  return { ...position, path: [], pathIndex: 0, replanIn: 0 };
}

export function updateRobber(robber, world, player, dt, onCatch) {
  robber.catchCooldown = Math.max(0, (robber.catchCooldown ?? 0) - dt);
  robber.replanIn -= dt;
  if (robber.replanIn <= 0) {
    robber.path = findPath(world, robber.x, robber.y, player.x, player.y);
    robber.pathIndex = 0;
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
    if (!world.isWall(Math.floor(nextX), Math.floor(robber.y))) robber.x = nextX;
    if (!world.isWall(Math.floor(robber.x), Math.floor(nextY))) robber.y = nextY;
  }
  if (target && distance < .14) robber.pathIndex++;

  if (robber.catchCooldown <= 0 && Math.hypot(player.x - robber.x, player.y - robber.y) <= CATCH_DISTANCE) {
    const stole = onCatch();
    robber.catchCooldown = stole ? 6 : 2;
    if (stole) {
      Object.assign(robber, furthestRoomPosition(world, player));
      robber.path = [];
      robber.pathIndex = 0;
      robber.replanIn = 0;
    }
  }
}

export function stealInventoryObject(world, player) {
  const occupied = player.inventory.flatMap((object, slot) => object ? [{ object, slot }] : []);
  if (!occupied.length) return false;
  const stolen = occupied[Math.floor(Math.random() * occupied.length)];
  if (!placeStolenObject(world, stolen.object)) return false;
  player.inventory[stolen.slot] = null;
  const nextSlot = player.inventory.findIndex(object => object !== null);
  if (nextSlot >= 0) player.selectedInventorySlot = nextSlot;
  return true;
}
