const PATH_HALF_WIDTH = .5;
// Phones render at a lower resolution and sample fewer rays and line points.
const COARSE_POINTER = matchMedia('(pointer: coarse)').matches;
const NEAR_DEPTH = .26;
const OBJECT_RANGE = 50;
const STROKE_LEVELS = 32;
const WALL_HEIGHT = 1;
const DOOR_HEIGHT = WALL_HEIGHT;
const DOOR_GLYPHS = {
  A: [[[0, 0], [.5, 1], [1, 0]], [[.22, .42], [.78, .42]]],
  B: [[[0, 0], [0, 1], [.62, 1], [.82, .88], [.82, .66], [.62, .52], [0, .52]], [[.62, .52], [.82, .36], [.82, .12], [.62, 0], [0, 0]]],
  C: [[[.9, .9], [.7, 1], [.2, 1], [0, .8], [0, .2], [.2, 0], [.7, 0], [.9, .1]]],
  D: [[[0, 0], [0, 1], [.58, 1], [.85, .8], [.85, .2], [.58, 0], [0, 0]]],
  E: [[[.9, 1], [0, 1], [0, 0], [.9, 0]], [[0, .5], [.72, .5]]],
  F: [[[0, 0], [0, 1], [.9, 1]], [[0, .5], [.72, .5]]]
};
const ESCAPE_DOOR_GLYPHS = {
  E: [[[0, 0], [0, 4], [2, 4]], [[0, 2], [1.6, 2]], [[0, 0], [2, 0]]],
  a: [[[0, 1], [0, 3], [2, 3], [2, 0], [0, 0], [0, 1], [2, 1]]],
  c: [[[2, 3], [0, 3], [0, 0], [2, 0]]],
  s: [[[2, 3], [0, 3], [0, 2], [2, 2], [2, 0], [0, 0]]],
  p: [[[0, 0], [0, 3], [2, 3], [2, 1.5], [0, 1.5]]],
  e: [[[0, 1.5], [2, 1.5], [2, 3], [0, 3], [0, 0], [2, 0]]],
  '2': [[[0, 3], [2, 3], [2, 1.5], [0, 1.5], [0, 0], [2, 0]]],
  '0': [[[0, 0], [0, 3], [2, 3], [2, 0], [0, 0]]],
  C: [[[2, 4], [0, 4], [0, 0], [2, 0]]],
  r: [[[0, 0], [0, 3], [2, 3], [2, 2]]],
  d: [[[2, 0], [2, 3], [0, 3], [0, 0], [2, 0]]],
  i: [[[1, 0], [1, 3]], [[.5, 4], [1.5, 4]]],
  t: [[[1, 0], [1, 4]], [[0, 3], [2, 3]]]
};
const FOV = Math.PI / 3;
const BUILDING_HUES = { A: 168, B: 212, C: 124, D: 246, E: 84, F: 302 };
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
  let groundGradient = null;
  let buildingFinishes = [];
  let moonSprites = [];
  let cloudSprites = [];
  // Quality lowers the ray count on slow devices and raises it again when frames are fast.
  let quality = 1;
  let frameAverage = 16.7;
  let framesSinceAdjust = 0;
  let previousTime = 0;
  const buildings = world.buildings;
  // Corridors get a floor and ceiling just like buildings do.
  const roofedAreas = [...buildings, ...world.corridors];
  const hitPool = [];
  let pathLines = null;
  let outlineLines = null;

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
  roofedAreas.forEach((area, index) => {
    for (let y = area.y; y < area.y + area.h; y++) {
      buildingGrid.fill(index + 1, y * mapWidth + area.x, y * mapWidth + area.x + area.w);
    }
  });
  // Style strings are built once; index 0 is the default look for walls outside any building.
  const buildingHues = [168, ...roofedAreas.map(area => BUILDING_HUES[area.name] ?? 168)];
  const wallShades = buildingHues.map(hue => Array.from({ length: STROKE_LEVELS + 1 }, (_, level) => `hsl(${hue},40%,${8 + level / STROKE_LEVELS * 24}%)`));
  const wallStrokes = buildingHues.map(hue => Array.from({ length: STROKE_LEVELS + 1 }, (_, level) => `hsla(${hue},55%,68%,${level / STROKE_LEVELS})`));
  const doorStrokes = Array.from({ length: STROKE_LEVELS + 1 }, (_, level) => `rgba(114,255,208,${level / STROKE_LEVELS})`);
  const doorShades = Array.from({ length: STROKE_LEVELS + 1 }, (_, level) => `hsl(165,45%,${22 + level / STROKE_LEVELS * 22}%)`);
  const magicDoorShades = Array.from({ length: STROKE_LEVELS + 1 }, (_, level) => `hsl(285,45%,${24 + level / STROKE_LEVELS * 22}%)`);

  function resize() {
    // A 2x backing canvas quadruples the pixels painted each frame. Capping
    // desktop rendering at 1.5x keeps the image sharp while reducing that work.
    pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
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
    groundGradient = context.createLinearGradient(0, horizon, 0, height);
    groundGradient.addColorStop(0, '#030908');
    groundGradient.addColorStop(1, '#1b302d');
    buildingFinishes = roofedAreas.map((area, index) => {
      const hue = buildingHues[index + 1] ?? 168;
      const ceiling = context.createLinearGradient(0, 0, 0, horizon);
      ceiling.addColorStop(0, `hsl(${hue},30%,20%)`);
      ceiling.addColorStop(1, `hsl(${hue},30%,13%)`);
      const floor = context.createLinearGradient(0, horizon, 0, height);
      floor.addColorStop(0, `hsl(${hue},30%,13%)`);
      floor.addColorStop(1, `hsl(${hue},30%,20%)`);
      return { ceiling, floor };
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
    context.fillStyle = groundGradient;
    context.fillRect(0, horizon, width, height - horizon);

    // Rays are 2px or 4px apart; strokes are always 2px every 4px, so the wall pattern is identical at both.
    // Scale ray spacing continuously with the adaptive quality setting. The old
    // 2-or-4 step jumped straight to half the rays, and only after quality had
    // already fallen very low.
    const step = Math.max(2, Math.min(4, Math.ceil(width / (rayCount * quality))));
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
    const rayDoors = [];
    // The previous column's wall, so a bright edge can be drawn wherever the surface changes.
    let prevHit = false;
    let prevKind = 0;
    let prevSide = 0;
    let prevDistance = 0;
    let prevTop = 0;
    let prevBottom = 0;
    let prevColor = '';

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
      rayDoors.length = 0;

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
          visibleDoors.set(door.id, visible = { id: door.id, left: sx, right: sx + step, leftDepth: doorDepth, rightDepth: doorDepth, magic: world.magicDoorIds.has(door.id) });
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

      for (let buildingIndex = 0; buildingIndex < roofedAreas.length; buildingIndex++) {
        const building = roofedAreas[buildingIndex];
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
      if (!wallHit) {
        prevHit = false;
        continue;
      }
      const wallHeight = Math.min(height * 1.8, focal * WALL_HEIGHT / distance);
      const top = horizon - wallHeight / 2;
      const bottom = horizon + wallHeight / 2;
      const alpha = Math.max(.2, .9 - distance * .0012 - (side ? .16 : 0));
      const level = Math.round(alpha * STROKE_LEVELS);
      const owner = buildingGrid[hitY * mapWidth + hitX];
      const kind = doorPanel ? (magicDoorPanel ? 2 : 1) : 0;
      const colTop = doorPanel ? bottom - Math.min(wallHeight, focal * DOOR_HEIGHT / distance) : top;
      const edgeColor = kind === 2 ? 'rgba(224,112,255,.95)' : kind === 1 ? doorStrokes[Math.max(Math.round(.35 * STROKE_LEVELS), level)] : wallStrokes[owner][level];
      context.fillStyle = kind === 2 ? magicDoorShades[level] : kind === 1 ? doorShades[level] : wallShades[owner][level];
      const columnHeight = bottom - colTop;
      // Whole device pixels, so fractional scaling never leaves a see-through seam between columns.
      const left = Math.floor(sx * pixelRatio) / pixelRatio;
      const right = Math.ceil((sx + step + 1) * pixelRatio) / pixelRatio;
      const fillTop = Math.floor(colTop * pixelRatio) / pixelRatio;
      const fillBottom = Math.ceil(bottom * pixelRatio) / pixelRatio;
      context.fillRect(left, fillTop, right - left, fillBottom - fillTop);
      const jump = Math.max(.6, Math.min(distance, prevDistance) * .25);
      if (prevHit && (kind !== prevKind || Math.abs(distance - prevDistance) > jump)) {
        const nearer = distance < prevDistance;
        const edgeTop = nearer ? colTop : prevTop;
        context.fillStyle = nearer ? edgeColor : prevColor;
        context.fillRect(sx - 1, edgeTop, 2, (nearer ? bottom : prevBottom) - edgeTop);
      }
      prevHit = true;
      prevKind = kind;
      prevSide = side;
      prevDistance = distance;
      prevTop = colTop;
      prevBottom = bottom;
      prevColor = edgeColor;
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
      addProjectedPolyline(points, ignoreWalls, subdivisions);
      context.stroke();
    }
    // Adds to the current path without stroking, so callers can batch many lines into one stroke.
    function addProjectedPolyline(points, ignoreWalls, subdivisions) {
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
    }
    function drawDoorGlyph(portal) {
      const horizontalX = portal.side === 'north' || portal.side === 'south';
      const outwardX = portal.side === 'west' ? -1 : portal.side === 'east' ? 1 : 0;
      const outwardY = portal.side === 'north' ? -1 : portal.side === 'south' ? 1 : 0;
      const onOutside = (player.x - portal.x) * outwardX + (player.y - portal.y) * outwardY >= 0;
      const faceDirection = onOutside ? 1 : -1;
      const glyphDirection = (portal.side === 'north' || portal.side === 'east' ? -1 : 1) * faceDirection;
      const style = { color: '#fff', width: 1.2 };
      if (portal.building === 'E' && portal.target?.building === 'F') {
        const cell = .012;
        const advance = .048;
        const drawText = text => {
          const lines = text.split('\n');
          for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const baseline = .736 - lineIndex * .08;
            for (let index = 0; index < line.length; index++) {
              const strokes = ESCAPE_DOOR_GLYPHS[line[index]];
              if (!strokes) continue;
              for (const stroke of strokes) {
                const points = stroke.map(([x, y]) => {
                  const offset = (index * advance - line.length * advance / 2 + advance / 2 + (x - 1) * cell) * glyphDirection;
                  return {
                    x: portal.x + outwardX * .535 * faceDirection + (horizontalX ? offset : 0),
                    y: portal.y + outwardY * .535 * faceDirection + (horizontalX ? 0 : offset),
                    z: baseline + y * cell
                  };
                });
                drawProjectedPolyline(points, style, false, 3);
              }
            }
          }
        };
        drawText('Flight\n\n\n200\n\nCredits');
        return;
      }
      const strokes = DOOR_GLYPHS[portal.target?.building?.[0]];
      if (!strokes) return;
      for (const stroke of strokes) {
        const points = stroke.map(([x, y]) => {
          const offset = (x - .5) * .09 * glyphDirection;
          return {
            x: portal.x + outwardX * .535 * faceDirection + (horizontalX ? offset : 0),
            y: portal.y + outwardY * .535 * faceDirection + (horizontalX ? 0 : offset),
            z: .56 + y * .08
          };
        });
        drawProjectedPolyline(points, style, false, 3);
      }
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
    pathLines ??= (() => {
      const lines = [];
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
        lines.push(points);
      }
      }
      return lines;
    })();
    context.strokeStyle = pathStyle.color;
    context.lineWidth = pathStyle.width;
    context.beginPath();
    for (const points of pathLines) addProjectedPolyline(points, false, 1);
    context.stroke();
    if (!playerBuilding) {
      outlineLines ??= (() => {
      const lines = [];
      for (const building of roofedAreas) {
        const corners = [[building.x, building.y], [building.x + building.w, building.y], [building.x + building.w, building.y + building.h], [building.x, building.y + building.h]];
        for (const z of [0, WALL_HEIGHT]) {
          for (let index = 0; index < 4; index++) {
            const [x1, y1] = corners[index];
            const [x2, y2] = corners[(index + 1) % 4];
            const count = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4);
            const points = Array.from({ length: count + 1 }, (_, step) => ({ x: x1 + (x2 - x1) * step / count, y: y1 + (y2 - y1) * step / count, z }));
            lines.push(points);
          }
        }
        for (const [x, y] of corners) lines.push([{ x, y, z: 0 }, { x, y, z: WALL_HEIGHT }]);
      }
      return lines;
      })();
      context.strokeStyle = pathStyle.color;
      context.lineWidth = pathStyle.width;
      context.beginPath();
      for (const points of outlineLines) addProjectedPolyline(points, false, points.length === 2 ? 4 : 1);
      context.stroke();
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
      context.strokeStyle = lineStyle.color;
      context.lineWidth = lineStyle.width;
      context.beginPath();
      for (const [a, b] of edges) addProjectedPolyline([corners[a], corners[b]], ignoreWalls, 10);
      context.stroke();
    }
    function drawWireObject(cat, ignoreWalls = false, lineStyle = objectLineStyle) {
      for (const part of cat.cuboids ?? []) drawCuboid(part, ignoreWalls, lineStyle);
      context.strokeStyle = lineStyle.color;
      context.lineWidth = lineStyle.width;
      context.beginPath();
      for (const line of cat.lines) addProjectedPolyline(line, ignoreWalls, 10);
      context.stroke();
    }
    for (const box of world.boxes) if (!box.held && isNear(box)) drawCuboid(box, false, objectStyle(box));
    for (const table of world.tables) if (!table.held && isNear(table)) for (const part of table.parts) drawCuboid(part, false, objectStyle(table));
    if (world.cat && !world.cat.held && isNear(world.cat)) drawWireObject(world.cat, false, objectStyle(world.cat));
    for (const guitar of world.guitars) if (!guitar.held && isNear(guitar)) drawWireObject(guitar, false, objectStyle(guitar));
    for (const object of world.wireObjects) if (!object.held && isNear(object)) drawWireObject(object, false, objectStyle(object));
    if (world.rocket && isNear(world.rocket)) {
      const launchSeconds = player.launching?.elapsed ?? 0;
      const lift = player.launching ? Math.min(18, launchSeconds * launchSeconds * 2.4) : 0;
      const rocketStyle = player.launching
        ? { color: 'rgba(255,211,126,.95)', width: 1.8 }
        : { color: 'rgba(255,201,124,.9)', width: 1.7 };
      context.strokeStyle = rocketStyle.color;
      context.lineWidth = rocketStyle.width;
      context.beginPath();
      for (const line of world.rocket.lines) {
        addProjectedPolyline(line.map(point => ({ x: point.x, y: point.y, z: point.z + lift })), false, 8);
      }
      context.stroke();
      context.strokeStyle = 'rgba(255,227,159,.98)';
      context.lineWidth = 2.2;
      context.beginPath();
      for (const line of world.rocket.signLines) addProjectedPolyline(line, false, 8);
      context.stroke();
      if (player.launching && launchSeconds < 1.45) {
        context.save();
        context.globalAlpha = Math.max(.15, 1 - launchSeconds * .4);
        context.strokeStyle = '#ff9e52';
        context.lineWidth = 2;
        context.beginPath();
        for (const side of [-1, 0, 1]) {
          addProjectedPolyline([
            { x: world.rocket.x - 4.25, y: world.rocket.y + side * .12, z: lift + .35 },
            { x: world.rocket.x - 4.8, y: world.rocket.y + side * (.35 + launchSeconds * .2), z: Math.max(.05, lift - .9 - Math.abs(side) * .2) }
          ], true, 6);
        }
        context.stroke();
        context.restore();
      }
    }
    for (const picture of world.pictures) {
      if (!isNear(picture)) continue;
      const lineStyle = objectStyle(picture);
      context.strokeStyle = lineStyle.color;
      context.lineWidth = lineStyle.width;
      context.beginPath();
      for (const line of picture.lines) addProjectedPolyline(line, false, 10);
      context.stroke();
    }

    const robber = world.robber;
    if (robber) {
      const towardX = player.x - robber.x;
      const towardY = player.y - robber.y;
      const distance = Math.hypot(towardX, towardY) || 1;
      const sideX = -towardY / distance;
      const sideY = towardX / distance;
      const ghostLines = [
        [[-.18, 1.82], [-.12, 1.96], [0, 2.02], [.12, 1.96], [.18, 1.82], [.16, 1.68], [0, 1.62], [-.16, 1.68], [-.18, 1.82]],
        [[-.1, 1.65], [-.21, 1.52], [-.24, 1.2], [-.34, .83], [-.23, .67], [-.12, .84], [0, .72], [.12, .84], [.23, .67], [.34, .83], [.24, 1.2], [.21, 1.52], [.1, 1.65]],
        [[-.2, 1.48], [-.39, 1.26], [-.42, 1.04]],
        [[.2, 1.48], [.39, 1.26], [.42, 1.04]],
        [[-.12, .84], [-.18, .55], [-.27, .28], [-.38, .12]],
        [[.12, .84], [.18, .55], [.27, .28], [.38, .12]],
        [[-.08, 1.82], [-.025, 1.82]],
        [[.025, 1.82], [.08, 1.82]]
      ];
      const ghostPoint = ([horizontal, z]) => ({
        x: robber.x + sideX * horizontal,
        y: robber.y + sideY * horizontal,
        z
      });
      context.save();
      context.globalAlpha = .62 + Math.sin(now * .003) * .08;
      context.strokeStyle = 'rgba(170,220,255,.75)';
      context.lineWidth = 1.7;
      context.beginPath();
      for (const line of ghostLines) addProjectedPolyline(line.map(ghostPoint), false, 5);
      context.stroke();
      context.restore();
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
      if (door.magic) drawDoorGlyph(magicDoorById.get(door.id));
    }
    if (player.teleportFlash > 0) {
      const alpha = Math.min(.4, player.teleportFlash * 1.15);
      context.fillStyle = `rgba(214,128,255,${alpha})`;
      context.fillRect(0, 0, width, height);
    }
  }

  function drawLaunch(player, world, elapsed) {
    const clock = elapsed;
    const flightTime = Math.max(0, clock - 1.45);
    const progress = Math.max(0, Math.min(1, flightTime / 6.75));
    context.clearRect(0, 0, width, height);

    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#050916');
    sky.addColorStop(.55, '#101a33');
    sky.addColorStop(1, '#24172b');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    for (let index = 0; index < 180; index++) {
      const x = ((index * 97.31 + 17) % 997) / 997 * width;
      const y = ((index * 53.77 + 31) % 991) / 991 * height;
      const twinkle = .35 + .65 * (.5 + .5 * Math.sin(clock * 2 + index * 7.13));
      context.fillStyle = `rgba(220,235,255,${twinkle * (index % 9 === 0 ? .9 : .5)})`;
      context.fillRect(x, y, index % 9 === 0 ? 2 : 1, index % 9 === 0 ? 2 : 1);
    }

    // The home world starts large in the window and dwindles as the ship climbs away.
    const minSide = Math.min(width, height);
    const worldRadius = minSide * (.39 * (1 - progress) ** 1.15 + .027);
    const worldX = width * (.5 + Math.sin(progress * 2.2) * .08);
    const worldY = height * (.49 + progress * .19);
    const orb = context.createRadialGradient(worldX - worldRadius * .28, worldY - worldRadius * .42, worldRadius * .04, worldX, worldY, worldRadius);
    orb.addColorStop(0, '#7395aa');
    orb.addColorStop(.56, '#375773');
    orb.addColorStop(1, '#11182b');
    context.save();
    context.beginPath();
    context.ellipse(worldX, worldY, worldRadius, worldRadius * .66, -.12, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = orb;
    context.fillRect(worldX - worldRadius, worldY - worldRadius, worldRadius * 2, worldRadius * 2);
    context.strokeStyle = `rgba(151,220,255,${.68 * (1 - progress * .58)})`;
    context.lineWidth = Math.max(1, worldRadius * .015);
    context.beginPath();
    context.ellipse(worldX, worldY, worldRadius * .94, worldRadius * .61, -.12, 0, Math.PI * 2);
    context.stroke();

    const nearby = world.buildingPlans.filter(building => ['A', 'B', 'C', 'D', 'E'].includes(building.name));
    const minX = Math.min(...nearby.map(building => building.x));
    const minY = Math.min(...nearby.map(building => building.y));
    const spanX = Math.max(...nearby.map(building => building.x + building.w)) - minX || 1;
    const spanY = Math.max(...nearby.map(building => building.y + building.h)) - minY || 1;
    const mapPoint = (x, y) => ({
      x: worldX + ((x - minX) / spanX - .5) * worldRadius * 1.42,
      y: worldY + ((y - minY) / spanY - .5) * worldRadius * .72
    });
    context.strokeStyle = `rgba(147,255,222,${.82 * (1 - progress * .6)})`;
    context.lineWidth = Math.max(1, worldRadius * .012);
    context.beginPath();
    for (const path of world.paths) {
      const start = path.axis === 'x' ? mapPoint(path.from, path.fixed) : mapPoint(path.fixed, path.from);
      const end = path.axis === 'x' ? mapPoint(path.to, path.fixed) : mapPoint(path.fixed, path.to);
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
    }
    context.stroke();
    for (const building of nearby) {
      const left = mapPoint(building.x, building.y);
      const right = mapPoint(building.x + building.w, building.y + building.h);
      const bx = left.x;
      const by = left.y;
      const bw = right.x - left.x;
      const bh = right.y - left.y;
      context.fillStyle = building.name === 'E' ? 'rgba(255,222,151,.82)' : 'rgba(40,73,81,.95)';
      context.strokeStyle = building.name === 'E'
        ? `rgba(255,231,170,${1 - progress * .6})`
        : `rgba(163,255,225,${.9 * (1 - progress * .6)})`;
      context.lineWidth = Math.max(1, worldRadius * .014);
      context.fillRect(bx, by, bw, bh);
      context.strokeRect(bx, by, bw, bh);
      context.beginPath();
      for (let row = 1; row < building.rows; row++) {
        const y = by + bh * row / building.rows;
        context.moveTo(bx, y);
        context.lineTo(bx + bw, y);
      }
      for (let col = 1; col < building.cols; col++) {
        const x = bx + bw * col / building.cols;
        context.moveTo(x, by);
        context.lineTo(x, by + bh);
      }
      context.stroke();
    }
    const outpostX = worldX + worldRadius * .78;
    const outpostY = worldY + worldRadius * .25;
    context.strokeStyle = `rgba(255,215,139,${1 - progress * .55})`;
    context.fillStyle = `rgba(255,215,139,${.85 * (1 - progress * .5)})`;
    context.lineWidth = Math.max(1, worldRadius * .014);
    context.beginPath();
    context.moveTo(outpostX - worldRadius * .045, outpostY + worldRadius * .028);
    context.lineTo(outpostX, outpostY - worldRadius * .045);
    context.lineTo(outpostX + worldRadius * .045, outpostY + worldRadius * .028);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();

    // Warm exhaust trails slide past the window during the first seconds of flight.
    if (progress < .88) {
      const fade = 1 - progress / .88;
      for (let index = 0; index < 18; index++) {
        const x = ((index * 83 + 23) % 101) / 101 * width;
        const y = height * (.3 + ((index * 37 + clock * 115) % 70) / 100);
        context.strokeStyle = `rgba(255,170,92,${fade * .45})`;
        context.lineWidth = index % 4 === 0 ? 2 : 1;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x - width * .025, y + height * .075);
        context.stroke();
      }
    }

    // A brass-edged viewport makes the shot read as a view back from the rocket.
    context.strokeStyle = 'rgba(188,209,221,.48)';
    context.lineWidth = Math.max(2, minSide * .008);
    context.beginPath();
    context.moveTo(width * .08, height * .08);
    context.lineTo(width * .25, height * .035);
    context.lineTo(width * .75, height * .035);
    context.lineTo(width * .92, height * .08);
    context.lineTo(width * .98, height * .88);
    context.lineTo(width * .82, height * .97);
    context.moveTo(width * .18, height * .97);
    context.lineTo(width * .02, height * .88);
    context.closePath();
    context.stroke();
    context.strokeStyle = 'rgba(255,211,139,.24)';
    context.lineWidth = 1;
    context.strokeRect(width * .045, height * .09, width * .91, height * .81);
  }

  return { draw, drawLaunch };
}
