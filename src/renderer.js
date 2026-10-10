const PATH_HALF_WIDTH = .5;
const WALL_HEIGHT = 1;
const DOOR_HEIGHT = .8;
const FOV = Math.PI / 3;
const BUILDING_HUES = { A: 168, B: 190, C: 148, D: 208, E: 128 };
// Map north is -y, so angles are measured from +x (east) towards +y (south).
const MOONS = [
  { angle: -Math.PI / 2, color: '#dfeaff', radius: .07, height: .62 },
  { angle: 0, color: '#ffe9bd', radius: .055, height: .5 },
  { angle: Math.PI / 2, color: '#ffd3df', radius: .085, height: .68 },
  { angle: Math.PI, color: '#d4ffe6', radius: .045, height: .45 }
];

export function createRenderer(canvas, world) {
  const context = canvas.getContext('2d');
  const magicDoorById = new Map(world.magicDoors.map(door => [door.id, door]));
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let rayCount = 600;

  function resize() {
    pixelRatio = Math.min(devicePixelRatio || 1, 2);
    width = innerWidth;
    height = innerHeight;
    rayCount = Math.min(900, Math.max(360, Math.floor(width * .72)));
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  function draw(player) {
    const horizon = height * .5;
    const focal = width / (2 * Math.tan(FOV / 2));
    const playerBuilding = world.getRoomAt(player.x, player.y)?.building;
    const indoorHue = BUILDING_HUES[playerBuilding];
    context.fillStyle = '#081412';
    context.fillRect(0, 0, width, height);
    const outdoorSky = context.createLinearGradient(0, 0, 0, horizon);
    if (indoorHue === undefined) {
      outdoorSky.addColorStop(0, '#07100f');
      outdoorSky.addColorStop(1, '#122422');
    } else {
      outdoorSky.addColorStop(0, `hsl(${indoorHue},30%,8%)`);
      outdoorSky.addColorStop(1, `hsl(${indoorHue},32%,12%)`);
    }
    context.fillStyle = outdoorSky;
    context.fillRect(0, 0, width, horizon);
    for (const moon of indoorHue === undefined ? MOONS : []) {
      const offset = Math.atan2(Math.sin(moon.angle - player.a), Math.cos(moon.angle - player.a));
      if (Math.abs(offset) > FOV / 2 + .3) continue;
      const moonX = width / 2 + focal * Math.tan(offset);
      const moonY = horizon * (1 - moon.height);
      const moonRadius = height * moon.radius;
      const glow = context.createRadialGradient(moonX, moonY, moonRadius * .8, moonX, moonY, moonRadius * 2.6);
      glow.addColorStop(0, `${moon.color}55`);
      glow.addColorStop(1, `${moon.color}00`);
      context.fillStyle = glow;
      context.fillRect(moonX - moonRadius * 2.6, moonY - moonRadius * 2.6, moonRadius * 5.2, moonRadius * 5.2);
      context.fillStyle = moon.color;
      context.beginPath();
      context.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = indoorHue === undefined ? '#101d1a' : `hsl(${indoorHue},30%,11%)`;
    context.fillRect(0, horizon, width, height - horizon);

    const step = Math.max(2, Math.ceil(width / rayCount));
    const hits = [];
    const now = performance.now();
    const objectStyle = object => {
      const remaining = (object.flashUntil ?? 0) - now;
      if (remaining > 0) {
        const progress = Math.max(0, Math.min(1, 1 - remaining / 1100));
        const glow = Math.sin(progress * Math.PI);
        return { color: `rgba(221,255,245,${.35 + glow * .65})`, width: 1.5 + glow * 1.5 };
      }
      return object.paired
        ? { color: 'rgba(147,235,255,.9)', width: 2 }
        : { color: 'rgba(114,255,208,.72)', width: 1.5 };
    };
    const visibleDoors = new Map();

    context.lineWidth = 1;
    context.strokeStyle = 'rgba(112,169,160,.18)';
    context.beginPath();
    for (let i = 1; i <= 12 && indoorHue === undefined; i++) {
      const ceilingY = horizon - horizon * (i / 13) ** 2;
      context.moveTo(0, ceilingY);
      context.lineTo(width, ceilingY);
    }
    context.stroke();

    for (let sx = 0; sx < width; sx += step) {
      const rayAngle = player.a + Math.atan((sx - width / 2) / focal);
      const rayX = Math.cos(rayAngle);
      const rayY = Math.sin(rayAngle);
      let mapX = Math.floor(player.x);
      let mapY = Math.floor(player.y);
      const deltaX = Math.abs(1 / rayX);
      const deltaY = Math.abs(1 / rayY);
      const stepX = rayX < 0 ? -1 : 1;
      const stepY = rayY < 0 ? -1 : 1;
      let sideX = (rayX < 0 ? player.x - mapX : mapX + 1 - player.x) * deltaX;
      let sideY = (rayY < 0 ? player.y - mapY : mapY + 1 - player.y) * deltaY;
      let side = 0;
      let distance = 0;
      let hitX = 0;
      let hitY = 0;
      let wallHit = false;
      let doorPanel = false;
      let magicDoorPanel = false;
      const rayDoors = [];

      for (let i = 0; i < world.width + world.height; i++) {
        if (sideX < sideY) {
          distance = sideX;
          sideX += deltaX;
          mapX += stepX;
          side = 0;
        } else {
          distance = sideY;
          sideY += deltaY;
          mapY += stepY;
          side = 1;
        }
        if (mapX < 0 || mapY < 0 || mapX >= world.width || mapY >= world.height) break;
        const doorId = world.doors.get(`${mapX},${mapY}`);
        if (doorId !== undefined) {
          const portal = magicDoorById.get(doorId);
          if (portal && portal.building !== playerBuilding) {
            hitX = mapX;
            hitY = mapY;
            wallHit = true;
            break;
          }
          rayDoors.push({ id: doorId, distance });
          if (distance > 1.15) {
            hitX = mapX;
            hitY = mapY;
            wallHit = true;
            doorPanel = true;
            magicDoorPanel = world.magicDoorIds.has(doorId);
            break;
          }
        }
        if (world.map[mapY][mapX] === 1) {
          hitX = mapX;
          hitY = mapY;
          wallHit = true;
          break;
        }
      }

      distance = Math.max(.08, distance * Math.cos(rayAngle - player.a));
      for (const door of rayDoors) {
        const doorDepth = door.distance * Math.cos(rayAngle - player.a);
        let visible = visibleDoors.get(door.id);
        if (!visible) {
          visibleDoors.set(door.id, visible = { left: sx, right: sx + step, leftDepth: doorDepth, rightDepth: doorDepth, magic: world.magicDoorIds.has(door.id) });
        } else {
          if (sx < visible.left) {
            visible.left = sx;
            visible.leftDepth = doorDepth;
          }
          if (sx + step > visible.right) {
            visible.right = sx + step;
            visible.rightDepth = doorDepth;
          }
        }
      }

      hits.push({ sx, distance, hitX, hitY, side, wallHit });
      if (!wallHit) continue;
      const wallHeight = Math.min(height * 1.8, focal * WALL_HEIGHT / distance);
      const top = horizon - wallHeight / 2;
      const bottom = horizon + wallHeight / 2;
      const alpha = Math.max(.13, .72 - distance * .0012 - (side ? .16 : 0));
      const hitBuilding = world.buildings.find(b => hitX >= b.x && hitX < b.x + b.w && hitY >= b.y && hitY < b.y + b.h);
      const hue = BUILDING_HUES[hitBuilding?.name] ?? 168;
      context.strokeStyle = `hsla(${hue},55%,68%,${alpha})`;
      context.lineWidth = 1;
      if (doorPanel) {
        const panelHeight = Math.min(wallHeight, focal * DOOR_HEIGHT / distance);
        const panelTop = bottom - panelHeight;
        context.fillStyle = magicDoorPanel ? '#24102e' : '#102421';
        context.fillRect(sx, panelTop, step + 1, panelHeight);
        context.strokeStyle = magicDoorPanel ? 'rgba(224,112,255,.95)' : `rgba(114,255,208,${Math.max(.35, alpha)})`;
        context.beginPath();
        context.moveTo(sx, panelTop);
        context.lineTo(sx, bottom);
        context.stroke();
      } else {
        context.fillStyle = `hsl(${hue},40%,10%)`;
        context.fillRect(sx, top, step + 1, wallHeight);
        context.beginPath();
        context.moveTo(sx, top);
        context.lineTo(sx, bottom);
        context.stroke();
      }
    }

    function projectPoint(x, y, z = 0, ignoreWalls = false) {
      const dx = x - player.x;
      const dy = y - player.y;
      const depth = dx * Math.cos(player.a) + dy * Math.sin(player.a);
      const lateral = -dx * Math.sin(player.a) + dy * Math.cos(player.a);
      if (depth < .25) return null;
      const sx = width / 2 + focal * lateral / depth;
      const sy = horizon + focal * (WALL_HEIGHT / 2 - z) / depth;
      const ray = hits[Math.min(hits.length - 1, Math.max(0, Math.floor(sx / step)))];
      return { sx, sy, visible: ignoreWalls || !ray || !ray.wallHit || depth <= ray.distance + .5 };
    }
    function drawProjectedPolyline(points, style, ignoreWalls = false, subdivisions = 10) {
      context.strokeStyle = style.color;
      context.lineWidth = style.width;
      context.beginPath();
      let active = false;
      let lastPoint = null;
      for (let segment = 0; segment < points.length - 1; segment++) {
        const start = points[segment];
        const end = points[segment + 1];
        for (let index = segment === 0 ? 0 : 1; index <= subdivisions; index++) {
          const amount = index / subdivisions;
          const point = projectPoint(
            start.x + (end.x - start.x) * amount,
            start.y + (end.y - start.y) * amount,
            (start.z ?? 0) + ((end.z ?? 0) - (start.z ?? 0)) * amount,
            ignoreWalls
          );
          if (!point || !point.visible || point.sx < -10 || point.sx > width + 10) {
            active = false;
            lastPoint = null;
            continue;
          }
          if (!active || Math.abs(point.sx - lastPoint.sx) >= width * .7) {
            context.moveTo(point.sx, point.sy);
            active = true;
          } else {
            context.lineTo(point.sx, point.sy);
          }
          lastPoint = point;
        }
      }
      context.stroke();
    }
    const pathStyle = { color: 'rgba(114,255,208,.58)', width: 1.4 };
    function trimJunctionEnd(path, endpoint, otherEndpoint) {
      const crossing = world.paths.some(other => {
        if (other.axis === path.axis) return false;
        const low = Math.min(other.from, other.to);
        const high = Math.max(other.from, other.to);
        return other.fixed === endpoint && path.fixed > low && path.fixed < high;
      });
      return crossing ? endpoint + Math.sign(otherEndpoint - endpoint) * PATH_HALF_WIDTH : endpoint;
    }
    for (const path of world.paths) {
      for (const offset of [-PATH_HALF_WIDTH, PATH_HALF_WIDTH]) {
        const from = trimJunctionEnd(path, path.from, path.to);
        const to = trimJunctionEnd(path, path.to, path.from);
        const low = Math.min(from, to);
        const high = Math.max(from, to);
        const samples = [];
        for (let value = low; value < high; value += 4) samples.push(value);
        samples.push(high);
        const points = [];
        for (const value of samples) {
          const x = path.axis === 'x' ? value : path.fixed + offset;
          const y = path.axis === 'x' ? path.fixed + offset : value;
          points.push({ x, y, z: 0 });
        }
        drawProjectedPolyline(points, pathStyle, false, 1);
      }
    }
    const objectLineStyle = { color: 'rgba(114,255,208,.72)', width: 1.5 };
    function drawCuboid(box, ignoreWalls = false, lineStyle = objectLineStyle) {
      const baseZ = box.z ?? 0;
      const corners = [];
      for (const z of [baseZ, baseZ + box.h]) {
        for (const sy of [-1, 1]) {
          for (const sx of [-1, 1]) corners.push({ x: box.x + sx * box.w / 2, y: box.y + sy * box.d / 2, z });
        }
      }
      const edges = [[0,1],[0,2],[1,3],[2,3],[4,5],[4,6],[5,7],[6,7],[0,4],[1,5],[2,6],[3,7]];
      for (const [a, b] of edges) {
        drawProjectedPolyline([corners[a], corners[b]], lineStyle, ignoreWalls);
      }
    }
    function drawWireObject(cat, ignoreWalls = false, lineStyle = objectLineStyle) {
      for (const part of cat.cuboids ?? []) drawCuboid(part, ignoreWalls, lineStyle);
      for (const line of cat.lines) drawProjectedPolyline(line, lineStyle, ignoreWalls);
    }
    for (const box of world.boxes) if (!box.held) drawCuboid(box, false, objectStyle(box));
    for (const table of world.tables) if (!table.held) for (const part of table.parts) drawCuboid(part, false, objectStyle(table));
    if (world.cat && !world.cat.held) drawWireObject(world.cat, false, objectStyle(world.cat));
    for (const guitar of world.guitars) if (!guitar.held) drawWireObject(guitar, false, objectStyle(guitar));
    for (const object of world.wireObjects) if (!object.held) drawWireObject(object, false, objectStyle(object));
    for (const picture of world.pictures) {
      const lineStyle = objectStyle(picture);
      for (const line of picture.lines) drawProjectedPolyline(line, lineStyle);
    }

    for (const door of visibleDoors.values()) {
      const leftBottom = horizon + focal * WALL_HEIGHT / (2 * door.leftDepth);
      const rightBottom = horizon + focal * WALL_HEIGHT / (2 * door.rightDepth);
      const leftTop = leftBottom - focal * DOOR_HEIGHT / door.leftDepth;
      const rightTop = rightBottom - focal * DOOR_HEIGHT / door.rightDepth;
      context.strokeStyle = door.magic ? '#e070ff' : 'rgba(114,255,208,.72)';
      context.lineWidth = door.magic ? 2.5 : 1.5;
      context.beginPath();
      context.moveTo(door.left, leftTop);
      context.lineTo(door.right, rightTop);
      context.lineTo(door.right, rightBottom);
      context.lineTo(door.left, leftBottom);
      context.closePath();
      context.stroke();
    }
    if (player.teleportFlash > 0) {
      const alpha = Math.min(.4, player.teleportFlash * 1.15);
      context.fillStyle = `rgba(214,128,255,${alpha})`;
      context.fillRect(0, 0, width, height);
    }
  }

  return { draw };
}
