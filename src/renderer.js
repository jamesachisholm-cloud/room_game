const PATH_HALF_WIDTH = .5;
const WALL_HEIGHT = 1;
const DOOR_HEIGHT = .8;
const FOV = Math.PI / 3;

export function createRenderer(canvas, world) {
  const context = canvas.getContext('2d');
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
    context.fillStyle = '#081412';
    context.fillRect(0, 0, width, height);
    const sky = context.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#07100f');
    sky.addColorStop(1, '#122422');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, horizon);
    context.fillStyle = '#101d1a';
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
    for (let i = 1; i <= 12; i++) {
      const y = horizon + (height - horizon) * (i / 13) ** 2;
      const ceilingY = horizon - horizon * (i / 13) ** 2;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.moveTo(0, ceilingY);
      context.lineTo(width, ceilingY);
      context.stroke();
    }

    for (let sx = 0; sx < width; sx += step) {
      const rayAngle = player.a - FOV / 2 + (sx / width) * FOV;
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
      context.strokeStyle = `rgba(126,220,199,${alpha})`;
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
        context.fillStyle = side ? '#0b1916' : '#0e1c19';
        context.fillRect(sx, top, step + 1, wallHeight);
        context.beginPath();
        context.moveTo(sx, top);
        context.lineTo(sx, bottom);
        context.stroke();
      }
    }

    function projectGroundPoint(x, y) {
      const dx = x - player.x;
      const dy = y - player.y;
      const depth = dx * Math.cos(player.a) + dy * Math.sin(player.a);
      const lateral = -dx * Math.sin(player.a) + dy * Math.cos(player.a);
      if (depth < .25) return null;
      const sx = width / 2 + focal * lateral / depth;
      const sy = horizon + focal * (WALL_HEIGHT / 2) / depth;
      const ray = hits[Math.min(hits.length - 1, Math.max(0, Math.floor(sx / step)))];
      if (ray && ray.wallHit && depth > ray.distance + .5) return null;
      return { sx, sy };
    }
    context.strokeStyle = 'rgba(114,255,208,.58)';
    context.lineWidth = 1.4;
    for (const path of world.paths) {
      for (const offset of [-PATH_HALF_WIDTH, PATH_HALF_WIDTH]) {
        const low = Math.min(path.from, path.to);
        const high = Math.max(path.from, path.to);
        const samples = [];
        for (let value = low; value < high; value += 4) samples.push(value);
        samples.push(high);
        context.beginPath();
        let active = false;
        let lastPoint = null;
        for (const value of samples) {
          const x = path.axis === 'x' ? value : path.fixed + offset;
          const y = path.axis === 'x' ? path.fixed + offset : value;
          const point = projectGroundPoint(x, y);
          if (!point || point.sx < -10 || point.sx > width + 10) {
            if (active) context.stroke();
            active = false;
            lastPoint = null;
            continue;
          }
          if (!active) {
            context.moveTo(point.sx, point.sy);
            active = true;
          } else if (Math.abs(point.sx - lastPoint.sx) < width * .7) {
            context.lineTo(point.sx, point.sy);
          } else {
            context.stroke();
            context.beginPath();
            context.moveTo(point.sx, point.sy);
            active = true;
          }
          lastPoint = point;
        }
        if (active) context.stroke();
      }
    }

    function projectBoxPoint(x, y, z, ignoreWalls = false) {
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
    context.strokeStyle = 'rgba(114,255,208,.72)';
    context.lineWidth = 1.5;
    function drawCuboid(box, ignoreWalls = false, style = null) {
      const lineStyle = style ?? { color: 'rgba(114,255,208,.72)', width: 1.5 };
      context.strokeStyle = lineStyle.color;
      context.lineWidth = lineStyle.width;
      const baseZ = box.z ?? 0;
      const corners = [];
      for (const z of [baseZ, baseZ + box.h]) {
        for (const sy of [-1, 1]) {
          for (const sx of [-1, 1]) corners.push({ x: box.x + sx * box.w / 2, y: box.y + sy * box.d / 2, z });
        }
      }
      const edges = [[0,1],[0,2],[1,3],[2,3],[4,5],[4,6],[5,7],[6,7],[0,4],[1,5],[2,6],[3,7]];
      for (const [a, b] of edges) {
        context.beginPath();
        let pen = false;
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const point = projectBoxPoint(
            corners[a].x + (corners[b].x - corners[a].x) * t,
            corners[a].y + (corners[b].y - corners[a].y) * t,
            corners[a].z + (corners[b].z - corners[a].z) * t,
            ignoreWalls
          );
          if (!point || !point.visible || point.sx < -10 || point.sx > width + 10) {
            pen = false;
            continue;
          }
          if (!pen) {
            context.moveTo(point.sx, point.sy);
            pen = true;
          } else context.lineTo(point.sx, point.sy);
        }
        context.stroke();
      }
    }
    function drawWireObject(cat, ignoreWalls = false, style = null) {
      const lineStyle = style ?? { color: 'rgba(114,255,208,.72)', width: 1.5 };
      for (const part of cat.cuboids ?? []) drawCuboid(part, ignoreWalls, lineStyle);
      context.strokeStyle = lineStyle.color;
      context.lineWidth = lineStyle.width;
      for (const line of cat.lines) {
        for (let segment = 0; segment < line.length - 1; segment++) {
          const start = line[segment];
          const end = line[segment + 1];
          context.beginPath();
          let pen = false;
          for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const point = projectBoxPoint(
              start.x + (end.x - start.x) * t,
              start.y + (end.y - start.y) * t,
              start.z + (end.z - start.z) * t,
              ignoreWalls
            );
            if (!point || !point.visible || point.sx < -10 || point.sx > width + 10) {
              pen = false;
              continue;
            }
            if (!pen) {
              context.moveTo(point.sx, point.sy);
              pen = true;
            } else context.lineTo(point.sx, point.sy);
          }
          context.stroke();
        }
      }
    }
    for (const box of world.boxes) if (!box.held) drawCuboid(box, false, objectStyle(box));
    for (const table of world.tables) if (!table.held) for (const part of table.parts) drawCuboid(part, false, objectStyle(table));
    if (world.cat && !world.cat.held) drawWireObject(world.cat, false, objectStyle(world.cat));
    for (const guitar of world.guitars) if (!guitar.held) drawWireObject(guitar, false, objectStyle(guitar));
    for (const picture of world.pictures) {
      const lineStyle = objectStyle(picture);
      context.strokeStyle = lineStyle.color;
      context.lineWidth = lineStyle.width;
      for (const line of picture.lines) {
        for (let segment = 0; segment < line.length - 1; segment++) {
          const start = line[segment];
          const end = line[segment + 1];
          context.beginPath();
          let pen = false;
          for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const point = projectBoxPoint(
              start.x + (end.x - start.x) * t,
              start.y + (end.y - start.y) * t,
              start.z + (end.z - start.z) * t
            );
            if (!point || !point.visible || point.sx < -10 || point.sx > width + 10) {
              pen = false;
              continue;
            }
            if (!pen) {
              context.moveTo(point.sx, point.sy);
              pen = true;
            } else context.lineTo(point.sx, point.sy);
          }
          context.stroke();
        }
      }
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
