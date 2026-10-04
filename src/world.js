export const SIZE = 7;
const PAD = 12;
const ROOM_LENGTHS = 10;
const ROOM_FT = 10;
export const CELL_FT = ROOM_FT / SIZE;

export function createWorld() {
  const A = { name: 'A', cols: 5, rows: 4, x: PAD + SIZE, y: PAD };
  A.w = A.cols * SIZE;
  A.h = A.rows * SIZE;
  const pathGap = ROOM_LENGTHS * SIZE;
  const B = { name: 'B', cols: 6, rows: 4, x: A.x + A.w + pathGap, y: PAD };
  B.w = B.cols * SIZE;
  B.h = B.rows * SIZE;
  const C = { name: 'C', cols: 6, rows: 4, x: B.x, y: B.y + B.h + pathGap };
  C.w = C.cols * SIZE;
  C.h = C.rows * SIZE;
  const D = { name: 'D', cols: 6, rows: 4, x: C.x - C.w - pathGap, y: C.y };
  D.w = D.cols * SIZE;
  D.h = D.rows * SIZE;
  const buildings = [A, B, C, D];
  const width = Math.max(...buildings.map(building => building.x + building.w)) + PAD;
  const height = Math.max(...buildings.map(building => building.y + building.h)) + PAD;
  const map = Array.from({ length: height }, () => Array(width).fill(0));
  const doors = new Map();
  const allRooms = [];
  let nextDoorId = 0;
  const key = (x, y) => `${x},${y}`;
  const openDoorCell = (x, y, id) => {
    map[y][x] = 0;
    doors.set(key(x, y), id);
  };

  function addBuilding(building, exteriorDoors) {
    for (let y = building.y; y < building.y + building.h; y++) {
      for (let x = building.x; x < building.x + building.w; x++) map[y][x] = 1;
    }
    for (let roomY = 0; roomY < building.rows; roomY++) {
      for (let roomX = 0; roomX < building.cols; roomX++) {
        const id = roomY * building.cols + roomX;
        const originX = building.x + roomX * SIZE;
        const originY = building.y + roomY * SIZE;
        allRooms.push({ building: building.name, id, ox: originX, oy: originY });
        for (let y = originY + 1; y < originY + SIZE - 1; y++) {
          for (let x = originX + 1; x < originX + SIZE - 1; x++) map[y][x] = 0;
        }
        const mergedFirstPair = building.name === 'A' && roomY === 0 && roomX === 0;
        const addedRoomDoor = building.name === 'A' && roomY === 2 && roomX === 1;
        if (roomX < building.cols - 1 && !mergedFirstPair && (((id * 7 + 3) % 5 !== 0) || addedRoomDoor)) {
          const x = originX + SIZE - 1;
          const y = originY + 2 + (id * 3) % 3;
          openDoorCell(x, y, nextDoorId++);
          map[y][x + 1] = 0;
        }
        if (roomY < building.rows - 1 && (id * 11 + 1) % 4 !== 0) {
          const x = originX + 2 + (id * 2) % 3;
          const y = originY + SIZE - 1;
          openDoorCell(x, y, nextDoorId++);
          map[y + 1][x] = 0;
        }
      }
    }
    if (building.name === 'A') {
      const x = building.x + SIZE - 1;
      for (let y = building.y + 1; y < building.y + SIZE - 1; y++) {
        map[y][x] = 0;
        map[y][x + 1] = 0;
      }
    }
    for (const [side, position] of exteriorDoors) {
      let x, y;
      if (side === 'north' || side === 'south') {
        x = position;
        y = side === 'north' ? building.y : building.y + building.h - 1;
      } else {
        x = side === 'west' ? building.x : building.x + building.w - 1;
        y = position;
      }
      openDoorCell(x, y, nextDoorId++);
    }
  }

  const rowAB = A.y + 17;
  const colBC = B.x + 17;
  const rowCD = C.y + 17;
  const colDA = A.x + 17;
  addBuilding(A, [['east', rowAB], ['south', colDA]]);
  addBuilding(B, [['west', rowAB], ['south', colBC]]);
  addBuilding(C, [['north', colBC], ['west', rowCD]]);
  addBuilding(D, [['east', rowCD], ['north', D.x + 24]]);

  const paths = [
    { axis: 'x', from: A.x + A.w, to: B.x, fixed: rowAB + .5 },
    { axis: 'y', from: B.y + B.h, to: C.y, fixed: colBC + .5 },
    { axis: 'x', from: D.x + D.w, to: C.x, fixed: rowCD + .5 },
    { axis: 'y', from: A.y + A.h, to: D.y, fixed: colDA + .5 }
  ];
  const boxes = [
    { x: A.x + 1.5 * SIZE, y: A.y + 1.5 * SIZE, w: .9, d: .9, h: .55 },
    { x: A.x + 4.5 * SIZE, y: A.y + 2.5 * SIZE, w: 1.8, d: 1.8, h: .9 }
  ];

  return {
    buildings, map, doors, paths, boxes, width, height,
    start: { x: A.x + 3.5, y: A.y + 3.5, a: 0 },
    isWall(x, y) { return x < 0 || y < 0 || x >= width || y >= height ? true : map[y][x] === 1; },
    getRoomAt(x, y) {
      const building = buildings.find(candidate => x >= candidate.x && x < candidate.x + candidate.w && y >= candidate.y && y < candidate.y + candidate.h);
      if (!building) return null;
      const roomX = Math.floor((x - building.x) / SIZE);
      const roomY = Math.floor((y - building.y) / SIZE);
      const cellNumber = roomY * building.cols + roomX + 1;
      const roomNumber = building === A ? (roomY === 0 ? (roomX < 2 ? 1 : roomX) : cellNumber - 1) : cellNumber;
      return { building: building.name, room: roomNumber, roomCount: building === A ? building.cols * building.rows - 1 : building.cols * building.rows };
    }
  };
}
