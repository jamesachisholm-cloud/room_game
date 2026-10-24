import { roomIdsIn } from './map-plan.js?v=20261096';
import { hasClearFootprint } from './placement.js?v=20261038';
import { SIZE } from './world-constants.js?v=20261038';

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function randomizeObjectPlacements(buildings, isWall) {
  const pictureRooms = new Set();
  const objects = [];
  const eligibleBuildings = buildings.filter(building => ['A', 'B', 'C', 'D'].includes(building.name));
  for (const building of eligibleBuildings) {
    for (const object of building.objects) {
      const room = building.grid[object.row][object.col];
      if (object.type === 'picture') pictureRooms.add(`${building.name}:${room}`);
      else objects.push({ building, object });
    }
  }

  const rooms = [];
  for (const building of eligibleBuildings) {
    for (const room of roomIdsIn(building.grid)) {
      if (!pictureRooms.has(`${building.name}:${room}`)) {
        const bays = [];
        for (let row = 0; row < building.rows; row++) {
          for (let col = 0; col < building.cols; col++) {
            if (building.grid[row][col] === room) bays.push({ col, row });
          }
        }
        rooms.push({ building, room, bays });
      }
    }
  }

  if (rooms.length < objects.length) throw new Error('Not enough picture-free rooms for all objects.');

  const footprintWorld = { isWall };
  const cornerOffsets = [1.6, 5.4];
  const candidatesByObject = objects.map(entry => ({
    ...entry,
    candidates: shuffle([...rooms]).flatMap(destination => {
      const positions = destination.bays.flatMap(({ col, row }) => cornerOffsets.flatMap(x => cornerOffsets.map(y => ({
        col, row, x, y,
        worldX: destination.building.x + col * SIZE + x,
        worldY: destination.building.y + row * SIZE + y
      }))));
      const clearPositions = shuffle(positions.filter(position => hasClearFootprint(footprintWorld, entry.object, position.worldX, position.worldY)));
      return clearPositions.length ? [{ destination, positions: clearPositions }] : [];
    })
  }));
  // Place the most constrained objects first, then backtrack if a room choice blocks another object.
  candidatesByObject.sort((a, b) => a.candidates.length - b.candidates.length || Math.random() - .5);
  const assignments = [];
  const usedRooms = new Set();
  function assign(index) {
    if (index === candidatesByObject.length) return true;
    const entry = candidatesByObject[index];
    for (const candidate of entry.candidates) {
      const roomKey = `${candidate.destination.building.name}:${candidate.destination.room}`;
      if (usedRooms.has(roomKey)) continue;
      usedRooms.add(roomKey);
      assignments[index] = { entry, ...candidate };
      if (assign(index + 1)) return true;
      usedRooms.delete(roomKey);
    }
    return false;
  }
  if (!assign(0)) throw new Error('Could not place all objects in distinct picture-free rooms.');

  for (const building of eligibleBuildings) {
    building.objects = building.objects.filter(object => object.type === 'picture');
  }
  for (const { entry, destination, positions } of assignments) {
    const { object } = entry;
    const selected = positions[0];
    object.col = selected.col;
    object.row = selected.row;
    object.x = selected.x;
    object.y = selected.y;
    destination.building.objects.push(object);
  }
}

