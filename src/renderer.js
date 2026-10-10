const PATH_HALF_WIDTH = .5;
// Phones render at a lower resolution and sample fewer rays and line points.
const COARSE_POINTER = matchMedia('(pointer: coarse)').matches;
const NEAR_DEPTH = .26;
const OBJECT_RANGE = 50;
const STROKE_LEVELS = 32;
const WALL_HEIGHT = 1;
const DOOR_HEIGHT = WALL_HEIGHT;
const FOV = Math.PI / 3;
const BUILDING_HUES = { A: 168, B: 190, C: 148, D: 208, E: 128, F: 280 };
// Map north is -y, so angles are measured from +x (east) towards +y (south).
// Craters are [x, y, radius] in units of the moon's radius.
const MOONS = [
  { angle: -Math.PI / 2, color: '#dfeaff', radius: .07, height: .62, craters: [[-.35, -.3, .22], [.3, .15, .16], [-.1, .5, .12], [.5, -.45, .1], [-.55, .25, .09]] },
  { angle: 0, color: '#ffe9bd', radius: .055, height: .5, craters: [[.25, -.35, .2], [-.4, .1, .18], [.1, .45, .13], [-.15, -.55, .09]] },
  { angle: Math.PI / 2, color: '#ffd3df', radius: .085, height: .68, craters: [[-.2, -.4, .25], [.4, .25, .2], [-.45, .35, .12], [.15, .6, .1], [.55, -.35, .09], [0, 0, .07]] },
  { angle: Math.PI, color: '#d4ffe6', radius: .045, height: .45, craters: [[.3, .2, .24], [-.35, -.25, .17], [-.05, .55, .11]] }
];

// Each cloud is a cluster of soft, flattened puffs at a fixed bearing and sky height.
const CLOUDS = [[-2.9, .78, .9], [-2.1, .42, .7], [-1.2, .66, .8], [-.4, .3, .6], [.5, .72, .9], [1.3, .38, .7], [2.2, .6, .8]].map(([angle, height, span], seed) => ({
  angle, height, span,
  puffs: Array.from({ length: 8 }, (_, k) => ({
    dx: k / 7 - .5 + Math.sin(seed * 3 + k * 2.1) * .05,
    dy: Math.sin(seed * 5 + k * 1.7) * .012,
    radius: .16 + .1 * Math.abs(Math.sin(seed * 2 + k * 1.3)),
    alpha: .04 + .03 * Math.abs(Math.cos(seed * 4 + k * 2.2))
  }))
}));

// Stars are fixed bearings and sky heights, generated from a seeded sequence so they never move.
const STARS = (() => {
  let seed = 20261044;
  const random = () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: 420 }, () => {
    const roll = random();
    // About one star in eight is bright, and another few are mid-brightness.
    const bright = roll < .12;
    const angle = random() * Math.PI * 2 - Math.PI;
    return {
      angle,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      height: .02 + random() * .96,
      size: bright ? 2 : 1,
      bright,
      alpha: bright ? .8 + random() * .2 : roll < .35 ? .55 + random() * .3 : .22 + random() * .3,
      phase: random() * Math.PI * 2
    };
  });
})();

export function createRenderer(canvas, world) {
  const context = canvas.getContext('2d');
  const magicDoorById = new Map(world.magicDoors.map(door => [door.id, door]));
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let rayCount = 600;
  let horizon = 0;
  let focal = 1;
  let skyGradient = null;
  let buildingFinishes = [];
  let moonSprites = [];
  let cloudSprites = [];
  // Quality lowers the ray count on slow devices and raises it again when frames are fast.
  let quality = 1;
  let frameAverage = 16.7;
  let framesSinceAdjust = 0;
  let previousTime = 0;
  const buildings = world.buildings;
  const hitPool = [];

  // Flat lookup tables avoid string keys and nested arrays inside the ray loop.
  const mapWidth = world.width;
  const mapHeight = world.height;
  const wallGrid = new Uint8Array(mapWidth * mapHeight);
  const doorGrid = new Int32Array(mapWidth * mapHeight).fill(-1);
  const buildingGrid = new Uint8Array(mapWidth * mapHeight);
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) wallGrid[y * mapWidth + x] = world.map[y][x] === 1 ? 1 : 0;
  }
  for (const [cell, doorId] of world.doors) {
    const [x, y] = cell.split(',').map(Number);
    doorGrid[y * mapWidth + x] = doorId;
  }
  buildings.forEach((building, index) => {
    for (let y = building.y; y < building.y + building.h; y++) {
      buildingGrid.fill(index + 1, y * mapWidth + building.x, y * mapWidth + building.x + building.w);
    }
  });
  // Style strings are built once; index 0 is the default look for walls outside any building.
  const buildingHues = [168, ...buildings.map(building => BUILDING_HUES[building.name] ?? 168)];
  const wallFills = buildingHues.map(hue => `hsl(${hue},40%,10%)`);
  const wallStrokes = buildingHues.map(hue => Array.from({ length: STROKE_LEVELS + 1 }, (_, level) => `hsla(${hue},55%,68%,${level / STROKE_LEVELS})`));
  const doorStrokes = Array.from({ length: STROKE_LEVELS + 1 }, (_, level) => `rgba(114,255,208,${level / STROKE_LEVELS})`);

  function resize() {
    pixelRatio = Math.min(devicePixelRatio || 1, COARSE_POINTER ? 1.25 : 2);
    width = innerWidth;
    height = innerHeight;
    horizon = height * .5;
    focal = width / (2 * Math.tan(FOV / 2));
    rayCount = Math.min(COARSE_POINTER ? 480 : 900, Math.max(360, Math.floor(width * .72)));
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    skyGradient = context.createLinearGradient(0, 0, 0, horizon);
    skyGradient.addColorStop(0, '#0d1c1a');
    skyGradient.addColorStop(1, '#1c3835');
    buildingFinishes = buildings.map((building, index) => {
      const hue = buildingHues[index + 1];
      const ceiling = context.createLinearGradient(0, 0, 0, horizon);
      ceiling.addColorStop(0, `hsl(${hue},30%,11%)`);
      ceiling.addColorStop(1, `hsl(${hue},32%,16%)`);
      return { ceiling, floor: `hsl(${hue},30%,14%)` };
    });
    moonSprites = [];
    cloudSprites = [];
  }
  // Clouds are soft, so their sprites are drawn at half resolution to save memory.
  function renderCloudSprite(cloud) {
    const spread = focal * cloud.span;
    const sizeX = Math.ceil(spread * 1.7);
    const sizeY = Math.ceil(spread * .4 + height * .04);
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil(sizeX * .5);
    sprite.height = Math.ceil(sizeY * .5);
    const spriteContext = sprite.getContext('2d');
    spriteContext.scale(.5, .5);
    for (const puff of cloud.puffs) {
      const puffRadius = spread * puff.radius;
      spriteContext.save();
      spriteContext.translate(sizeX / 2 + spread * puff.dx, sizeY / 2 + puff.dy * height);
      spriteContext.scale(1, .3);
      const body = spriteContext.createRadialGradient(0, 0, 0, 0, 0, puffRadius);
      body.addColorStop(0, `rgba(205,230,235,${puff.alpha})`);
      body.addColorStop(.25, `rgba(205,230,235,${puff.alpha * .8})`);
      body.addColorStop(.5, `rgba(205,230,235,${puff.alpha * .45})`);
      body.addColorStop(.75, `rgba(205,230,235,${puff.alpha * .15})`);
      body.addColorStop(1, 'rgba(205,230,235,0)');
      spriteContext.fillStyle = body;
      spriteContext.fillRect(-puffRadius, -puffRadius, puffRadius * 2, puffRadius * 2);
      spriteContext.restore();
    }
    return { canvas: sprite, width: sizeX, height: sizeY };
  }
  addEventListener('resize', resize);
  resize();

  function draw(player) {
    const frameStart = performance.now();
    if (previousTime) {
      frameAverage += (Math.min(100, frameStart - previousTime) - frameAverage) * .1;
      if (++framesSinceAdjust >= 45) {
        framesSinceAdjust = 0;
        if (frameAverage > 22) quality = Math.max(.45, quality - .1);
        else if (frameAverage < 17.5) quality = Math.min(1, quality + .05);
      }
    }
    previousTime = frameStart;
    const playerBuilding = world.getRoomAt(player.x, player.y)?.building;
    const cosA = Math.cos(player.a);
    const sinA = Math.sin(player.a);
    context.fillStyle = '#081412';
    context.fillRect(0, 0, width, height);
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, width, horizon);
    {
      const seconds = frameStart / 1000;
      const starLimit = Math.tan(FOV / 2 + .05);
      context.fillStyle = '#e8f4ff';
      for (const star of STARS) {
        const depth = star.cos * cosA + star.sin * sinA;
        const lateral = star.sin * cosA - star.cos * sinA;
        if (depth <= 0 || Math.abs(lateral) > depth * starLimit) continue;
        const starX = width / 2 + focal * lateral / depth;
        const starY = horizon * (1 - star.height);
        const twinkle = .8 + .2 * Math.sin(seconds * 1.5 + star.phase);
        if (star.bright) {
          context.globalAlpha = star.alpha * twinkle * .18;
          context.fillRect(starX - 1.5, starY - 1.5, star.size + 3, star.size + 3);
        }
        context.globalAlpha = star.alpha * twinkle;
        context.fillRect(starX, starY, star.size, star.size);
      }
      context.globalAlpha = 1;
    }
    MOONS.forEach((moon, index) => {
      const offset = Math.atan2(Math.sin(moon.angle - player.a), Math.cos(moon.angle - player.a));
      if (Math.abs(offset) > FOV / 2 + .3) return;
      const sprite = moonSprites[index] ?? (moonSprites[index] = renderMoonSprite(moon));
      context.drawImage(sprite.canvas, width / 2 + focal * Math.tan(offset) - sprite.size / 2, horizon * (1 - moon.height) - sprite.size / 2, sprite.size, sprite.size);
    });

    // Each moon is drawn once into a sprite, because its gradients are costly to rebuild every frame.
    function renderMoonSprite(moon) {
      const moonRadius = height * moon.radius;
      const size = Math.ceil(moonRadius * 6.8);
      const sprite = document.createElement('canvas');
      sprite.width = Math.ceil(size * pixelRatio);
      sprite.height = sprite.width;
      const context = sprite.getContext('2d');
      context.scale(pixelRatio, pixelRatio);
      const moonX = size / 2;
      const moonY = size / 2;
      context.globalAlpha = .78;
      const glow = context.createRadialGradient(moonX, moonY, moonRadius * .6, moonX, moonY, moonRadius * 3.2);
      glow.addColorStop(0, `${moon.color}44`);
      glow.addColorStop(.3, `${moon.color}22`);
      glow.addColorStop(.6, `${moon.color}0a`);
      glow.addColorStop(1, `${moon.color}00`);
      context.fillStyle = glow;
      context.fillRect(moonX - moonRadius * 3.2, moonY - moonRadius * 3.2, moonRadius * 6.4, moonRadius * 6.4);
      // The disc fades out over its outer edge so it melts into the sky.
      const disc = context.createRadialGradient(moonX, moonY, moonRadius * .55, moonX, moonY, moonRadius * 1.14);
      disc.addColorStop(0, moon.color);
      disc.addColorStop(.6, `${moon.color}cc`);
      disc.addColorStop(1, `${moon.color}00`);
      context.fillStyle = disc;
      context.beginPath();
      context.arc(moonX, moonY, moonRadius * 1.14, 0, Math.PI * 2);
      context.fill();
      context.save();
      context.beginPath();
      context.arc(moonX, moonY, moonRadius * .9, 0, Math.PI * 2);
      context.clip();
      for (const [cx, cy, cr] of moon.craters) {
        context.fillStyle = 'rgba(40,50,80,.09)';
        context.beginPath();
        context.arc(moonX + cx * moonRadius, moonY + cy * moonRadius, cr * moonRadius, 0, Math.PI * 2);
        context.fill();
        // Lit rim on the upper-left edge of each crater.
        context.strokeStyle = 'rgba(255,255,255,.07)';
        context.lineWidth = Math.max(.6, moonRadius * .02);
        context.beginPath();
        context.arc(moonX + cx * moonRadius, moonY + cy * moonRadius, cr * moonRadius, Math.PI * .75, Math.PI * 1.75);
        context.stroke();
      }
      const shade = context.createRadialGradient(moonX - moonRadius * .3, moonY - moonRadius * .3, moonRadius * .3, moonX, moonY, moonRadius * .9);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(10,20,40,.12)');
      context.fillStyle = shade;
      context.fillRect(moonX - moonRadius, moonY - moonRadius, moonRadius * 2, moonRadius * 2);
      context.restore();
      return { canvas: sprite, size };
    }
    {
      const drift = frameStart * 8e-6;
      CLOUDS.forEach((cloud, index) => {
        const offset = Math.atan2(Math.sin(cloud.angle + drift - player.a), Math.cos(cloud.angle + drift - player.a));
        if (Math.abs(offset) > FOV / 2 + cloud.span / 2) return;
        const sprite = cloudSprites[index] ?? (cloudSprites[index] = renderCloudSprite(cloud));
        context.drawImage(sprite.canvas, width / 2 + focal * Math.tan(offset) - sprite.width / 2, horizon * (1 - cloud.height) - sprite.height / 2, sprite.width, sprite.height);
      });
    }
    context.fillStyle = '#101d1a';
    context.fillRect(0, horizon, width, height - horizon);

    const step = Math.max(2, Math.ceil(width / (rayCount * quality)));
    let hitCount = 0;
    const now = frameStart;
    const maxRaySteps = Math.min(mapWidth + mapHeight, COARSE_POINTER ? 250 : 400);
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
    for (let i = 1; i <= 12; i++) {
      const ceilingY = horizon - horizon * (i / 13) ** 2;
      context.moveTo(0, ceilingY);
      context.lineTo(width, ceilingY);
    }
    context.stroke();

    for (let sx = 0; sx < width; sx += step) {
      const screenOffset = (sx - width / 2) / focal;
      const cosDelta = 1 / Math.sqrt(1 + screenOffset * screenOffset);
      const rayX = (cosA - sinA * screenOffset) * cosDelta;
      const rayY = (sinA + cosA * screenOffset) * cosDelta;
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

      for (let i = 0; i < maxRaySteps; i++) {
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
        if (mapX < 0 || mapY < 0 || mapX >= mapWidth || mapY >= mapHeight) break;
        const cell = mapY * mapWidth + mapX;
        const doorId = doorGrid[cell];
        if (doorId >= 0) {
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
        if (wallGrid[cell] === 1) {
          hitX = mapX;
          hitY = mapY;
          wallHit = true;
          break;
        }
      }

      distance = Math.max(.08, distance * cosDelta);
      for (const door of rayDoors) {
        const doorDepth = door.distance * cosDelta;
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

      for (let buildingIndex = 0; buildingIndex < buildings.length; buildingIndex++) {
        const building = buildings[buildingIndex];
        let tMin = -Infinity;
        let tMax = Infinity;
        if (Math.abs(rayX) < 1e-9) {
          if (player.x < building.x || player.x > building.x + building.w) continue;
        } else {
          const a = (building.x - player.x) / rayX;
          const b = (building.x + building.w - player.x) / rayX;
          tMin = a < b ? a : b;
          tMax = a < b ? b : a;
        }
        if (Math.abs(rayY) < 1e-9) {
          if (player.y < building.y || player.y > building.y + building.h) continue;
        } else {
          const a = (building.y - player.y) / rayY;
          const b = (building.y + building.h - player.y) / rayY;
          tMin = Math.max(tMin, a < b ? a : b);
          tMax = Math.min(tMax, a < b ? b : a);
        }
        const enter = Math.max(tMin, 0);
        if (tMax <= enter) continue;
        const finishes = buildingFinishes[buildingIndex];
        const near = enter * cosDelta;
        const far = tMax * cosDelta;
        const roofTop = near < .01 ? 0 : Math.max(0, horizon - focal * WALL_HEIGHT / 2 / near);
        const roofBottom = Math.min(horizon, horizon - focal * WALL_HEIGHT / 2 / far);
        if (roofBottom > roofTop) {
          context.fillStyle = finishes.ceiling;
          context.fillRect(sx, roofTop, step + 1, roofBottom - roofTop);
        }
        const floorTop = Math.max(horizon, horizon + focal * WALL_HEIGHT / 2 / far);
        const floorBottom = near < .01 ? height : Math.min(height, horizon + focal * WALL_HEIGHT / 2 / near);
        if (floorBottom > floorTop) {
          context.fillStyle = finishes.floor;
          context.fillRect(sx, floorTop, step + 1, floorBottom - floorTop);
        }
      }

      const hit = hitPool[hitCount] ?? (hitPool[hitCount] = {});
      hit.distance = distance;
      hit.wallHit = wallHit;
      hitCount++;
      if (!wallHit) continue;
      const wallHeight = Math.min(height * 1.8, focal * WALL_HEIGHT / distance);
      const top = horizon - wallHeight / 2;
      const bottom = horizon + wallHeight / 2;
      const alpha = Math.max(.13, .72 - distance * .0012 - (side ? .16 : 0));
      const level = Math.round(alpha * STROKE_LEVELS);
      const owner = buildingGrid[hitY * mapWidth + hitX];
      if (doorPanel) {
        const panelHeight = Math.min(wallHeight, focal * DOOR_HEIGHT / distance);
        const panelTop = bottom - panelHeight;
        context.fillStyle = magicDoorPanel ? '#24102e' : '#102421';
        context.fillRect(sx, panelTop, step + 1, panelHeight);
        context.fillStyle = magicDoorPanel ? 'rgba(224,112,255,.95)' : doorStrokes[Math.max(Math.round(.35 * STROKE_LEVELS), level)];
        context.fillRect(sx, panelTop, 1, panelHeight);
      } else {
        context.fillStyle = wallFills[owner];
        context.fillRect(sx, top, step + 1, wallHeight);
        context.fillStyle = wallStrokes[owner][level];
        context.fillRect(sx, top, 1, wallHeight);
      }
    }

    // Polylines are projected with plain numbers (no per-point objects) so phones avoid garbage-collection stalls.
    let clipStart = 0;
    let clipEnd = 1;
    const clipPlane = (fa, fb) => {
      if (fa < 0 && fb < 0) return false;
      if (fa < 0) clipStart = Math.max(clipStart, fa / (fa - fb));
      else if (fb < 0) clipEnd = Math.min(clipEnd, fa / (fa - fb));
      return true;
    };
    const screenEdge = (width / 2 + 10) / focal;
    const sampleSpacing = COARSE_POINTER ? 5 : 3;
    function drawProjectedPolyline(points, style, ignoreWalls = false, subdivisions = 10) {
      context.strokeStyle = style.color;
      context.lineWidth = style.width;
      context.beginPath();
      for (let segment = 0; segment < points.length - 1; segment++) {
        const start = points[segment];
        const end = points[segment + 1];
        const startDx = start.x - player.x;
        const startDy = start.y - player.y;
        const endDx = end.x - player.x;
        const endDy = end.y - player.y;
        const aDepth = startDx * cosA + startDy * sinA;
        const aLateral = -startDx * sinA + startDy * cosA;
        const bDepth = endDx * cosA + endDy * sinA;
        const bLateral = -endDx * sinA + endDy * cosA;
        clipStart = 0;
        clipEnd = 1;
        // Clip against the near plane and both side edges of the screen so lines run right to the edge.
        if (!clipPlane(aDepth - NEAR_DEPTH, bDepth - NEAR_DEPTH)
          || !clipPlane(aLateral + screenEdge * aDepth, bLateral + screenEdge * bDepth)
          || !clipPlane(screenEdge * aDepth - aLateral, screenEdge * bDepth - bLateral)
          || clipStart >= clipEnd) continue;
        const startZ = start.z ?? 0;
        const endZ = end.z ?? 0;
        const firstDepth = aDepth + (bDepth - aDepth) * clipStart;
        const lastDepth = aDepth + (bDepth - aDepth) * clipEnd;
        const firstX = width / 2 + focal * (aLateral + (bLateral - aLateral) * clipStart) / firstDepth;
        const lastX = width / 2 + focal * (aLateral + (bLateral - aLateral) * clipEnd) / lastDepth;
        const firstY = horizon + focal * (WALL_HEIGHT / 2 - (startZ + (endZ - startZ) * clipStart)) / firstDepth;
        const lastY = horizon + focal * (WALL_HEIGHT / 2 - (startZ + (endZ - startZ) * clipEnd)) / lastDepth;
        // Sampling every few pixels lets walls cut the line close to where they begin.
        const count = Math.min(400, Math.max(subdivisions, Math.ceil(Math.hypot(lastX - firstX, lastY - firstY) / sampleSpacing)));
        let active = false;
        for (let index = 0; index <= count; index++) {
          const t = clipStart + (clipEnd - clipStart) * index / count;
          const depth = aDepth + (bDepth - aDepth) * t;
          const screenX = width / 2 + focal * (aLateral + (bLateral - aLateral) * t) / depth;
          const screenY = horizon + focal * (WALL_HEIGHT / 2 - (startZ + (endZ - startZ) * t)) / depth;
          const hit = hitPool[Math.min(hitCount - 1, Math.max(0, Math.floor(screenX / step)))];
          if (!ignoreWalls && hit && hit.wallHit && depth > hit.distance + .5) {
            active = false;
            continue;
          }
          if (!active) {
            context.moveTo(screenX, screenY);
            active = true;
          } else {
            context.lineTo(screenX, screenY);
          }
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
    if (!playerBuilding) {
      for (const building of world.buildings) {
        const corners = [[building.x, building.y], [building.x + building.w, building.y], [building.x + building.w, building.y + building.h], [building.x, building.y + building.h]];
        for (const z of [0, WALL_HEIGHT]) {
          for (let index = 0; index < 4; index++) {
            const [x1, y1] = corners[index];
            const [x2, y2] = corners[(index + 1) % 4];
            const count = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4);
            const points = Array.from({ length: count + 1 }, (_, step) => ({ x: x1 + (x2 - x1) * step / count, y: y1 + (y2 - y1) * step / count, z }));
            drawProjectedPolyline(points, pathStyle, false, 1);
          }
        }
        for (const [x, y] of corners) drawProjectedPolyline([{ x, y, z: 0 }, { x, y, z: WALL_HEIGHT }], pathStyle, false, 4);
      }
    }
    const objectLineStyle = { color: 'rgba(114,255,208,.72)', width: 1.5 };
    // Objects beyond this range are too small to see and are skipped.
    const isNear = object => (object.x - player.x) ** 2 + (object.y - player.y) ** 2 < OBJECT_RANGE ** 2;
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
    for (const box of world.boxes) if (!box.held && isNear(box)) drawCuboid(box, false, objectStyle(box));
    for (const table of world.tables) if (!table.held && isNear(table)) for (const part of table.parts) drawCuboid(part, false, objectStyle(table));
    if (world.cat && !world.cat.held && isNear(world.cat)) drawWireObject(world.cat, false, objectStyle(world.cat));
    for (const guitar of world.guitars) if (!guitar.held && isNear(guitar)) drawWireObject(guitar, false, objectStyle(guitar));
    for (const object of world.wireObjects) if (!object.held && isNear(object)) drawWireObject(object, false, objectStyle(object));
    for (const picture of world.pictures) {
      if (!isNear(picture)) continue;
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
