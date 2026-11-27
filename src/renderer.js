import { drawDoorGlyph } from './door-renderer.js?v=2026112602';
import { buildPathLines } from './path-geometry.js?v=2026112603';
import { createLaunchRenderer } from './launch-renderer.js?v=20261116';
import { createProjector } from './projected-lines.js?v=20261116';
import { WALL_HEIGHT } from './world-constants.js?v=20261117';

// Phones render at a lower resolution and sample fewer rays and line points.
const COARSE_POINTER = matchMedia('(pointer: coarse)').matches;
// Largest canvas backing store, about 1600x875. Bigger windows are scaled up from this.
const MAX_BACKING_PIXELS = 1.4e6;
const OBJECT_RANGE = 50;
const STROKE_LEVELS = 32;
const DOOR_HEIGHT = 1;
const DOOR_WIDTH = .8;
const EYE_HEIGHT = .5;
const FOV = Math.PI / 3;
const BUILDING_HUES = { A: 190, B: 316, C: 345, D: 246, E: 28, F: 302 };
const PROFILE_RENDERER = new URLSearchParams(location.search).get('perf') === '1';
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
  const doorAlongBounds = new Map();
  for (const [cell, doorId] of world.doors) {
    const [x, y] = cell.split(',').map(Number);
    const bounds = doorAlongBounds.get(doorId);
    if (bounds) {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y);
    } else doorAlongBounds.set(doorId, { minX: x, maxX: x, minY: y, maxY: y });
  }
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
  let pixelRatioCap = 1.25;
  let frameAverage = 16.7;
  let framesSinceAdjust = 0;
  let previousTime = 0;
  const buildings = world.buildings;
  // Corridors get a floor and ceiling just like buildings do.
  const roofedAreas = [...buildings, ...world.corridors];
  const hitPool = [];
  const visibleDoors = new Map();
  const rayDoorIds = [];
  const rayDoorDistances = [];
  let pathLines = null;
  let outlineLines = null;
  let profileWindowStartedAt = performance.now();
  let profileSamples = [];
  let profileSummary = 'Collecting frame timings…';
  const profilePanel = PROFILE_RENDERER ? document.createElement('div') : null;
  const profileText = PROFILE_RENDERER ? document.createElement('pre') : null;
  const profileCopyButton = PROFILE_RENDERER ? document.createElement('button') : null;
  if (profilePanel) {
    profilePanel.setAttribute('aria-label', 'Renderer performance timings');
    profilePanel.style.cssText = 'position:fixed;z-index:20;top:12px;right:12px;padding:10px 12px;color:#d8fff2;background:#07100fee;border:1px solid #70a9a088;font:12px/1.5 ui-monospace,monospace;pointer-events:auto';
    profileText.style.cssText = 'margin:0 0 8px;white-space:pre';
    profileText.textContent = 'Renderer profiling enabled\nCollecting frame timings…';
    profileCopyButton.type = 'button';
    profileCopyButton.textContent = 'Copy timings';
    profileCopyButton.style.cssText = 'padding:4px 8px;color:#d8fff2;background:#18352d;border:1px solid #70a9a088;font:inherit;cursor:pointer';
    profileCopyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(profileSummary);
        profileCopyButton.textContent = 'Copied';
      } catch {
        profileCopyButton.textContent = 'Clipboard unavailable';
      }
    });
    profilePanel.append(profileText, profileCopyButton);
    document.body.append(profilePanel);
  }

  function reportFrameProfile(phases, frameMs, rayStep) {
    if (!PROFILE_RENDERER) return;
    profileSamples.push({ ...phases, frameMs });
    const now = performance.now();
    if (now - profileWindowStartedAt < 2000) return;

    const average = key => profileSamples.reduce((total, sample) => total + sample[key], 0) / profileSamples.length;
    const sortedFrameTimes = profileSamples.map(sample => sample.frameMs).sort((a, b) => a - b);
    const p95 = sortedFrameTimes[Math.floor((sortedFrameTimes.length - 1) * .95)];
    const summary = {
      frames: profileSamples.length,
      'draw avg ms': +average('frameMs').toFixed(2),
      'draw p95 ms': +p95.toFixed(2),
      'rAF interval avg ms': +frameAverage.toFixed(2),
      'sky ms': +average('skyMs').toFixed(2),
      'ray + walls + floors ms': +average('rayMs').toFixed(2),
      'projected lines ms': +average('lineMs').toFixed(2),
      quality: +quality.toFixed(2),
      rayStep
    };
    profileSummary = [
      'RENDERER PERFORMANCE (2s average)',
      `frames: ${summary.frames}    draw avg: ${summary['draw avg ms']} ms    p95: ${summary['draw p95 ms']} ms`,
      `frame interval: ${summary['rAF interval avg ms']} ms    quality: ${summary.quality}    ray step: ${rayStep}`,
      `sky: ${summary['sky ms']} ms`,
      `ray + walls + floors: ${summary['ray + walls + floors ms']} ms`,
      `projected lines: ${summary['projected lines ms']} ms`
    ].join('\n');
    profileText.textContent = profileSummary;
    profileCopyButton.textContent = 'Copy timings';
    console.table([summary]);
    profileSamples = [];
    profileWindowStartedAt = now;
  }

  // Flat lookup tables avoid string keys and nested arrays inside the ray loop.
  const mapWidth = world.width;
  const mapHeight = world.height;
  const wallGrid = new Uint8Array(mapWidth * mapHeight);
  const doorGrid = new Int32Array(mapWidth * mapHeight).fill(-1);
  const buildingGrid = new Uint8Array(mapWidth * mapHeight);
  const verticalWallEdges = new Uint8Array((mapWidth + 1) * mapHeight);
  const horizontalWallEdges = new Uint8Array(mapWidth * (mapHeight + 1));
  const verticalDoorEdges = new Int32Array((mapWidth + 1) * mapHeight).fill(-1);
  const horizontalDoorEdges = new Int32Array(mapWidth * (mapHeight + 1)).fill(-1);
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) wallGrid[y * mapWidth + x] = world.map[y][x] === 1 ? 1 : 0;
  }
  for (const [cell, doorId] of world.doors) {
    if (world.interiorDoorIds?.has(doorId)) continue;
    const [x, y] = cell.split(',').map(Number);
    doorGrid[y * mapWidth + x] = doorId;
  }
  for (const edge of world.interiorWallEdges ?? []) {
    if (edge.orientation === 'vertical') verticalWallEdges[edge.along * (mapWidth + 1) + edge.line] = 1;
    else horizontalWallEdges[edge.line * mapWidth + edge.along] = 1;
  }
  for (const edge of world.interiorDoorEdges ?? []) {
    if (edge.orientation === 'vertical') verticalDoorEdges[edge.along * (mapWidth + 1) + edge.line] = edge.id;
    else horizontalDoorEdges[edge.line * mapWidth + edge.along] = edge.id;
  }
  roofedAreas.forEach((area, index) => {
    for (let y = area.y; y < area.y + area.h; y++) {
      buildingGrid.fill(index + 1, y * mapWidth + area.x, y * mapWidth + area.x + area.w);
    }
  });
  // Style strings are built once; index 0 is the default look for walls outside any building.
  const buildingHues = [168, ...roofedAreas.map(area => BUILDING_HUES[area.name] ?? 168)];
  const buildingSaturations = [40, ...roofedAreas.map(area => ['A', 'B'].includes(area.name) ? 68 : ['C', 'D', 'E'].includes(area.name) ? 52 : 40)];
  const buildingLightnessOffsets = [0, ...roofedAreas.map(area => area.name === 'A' ? 1.5 : 0)];
  const wallShades = buildingHues.map((hue, index) => Array.from({ length: STROKE_LEVELS + 1 }, (_, level) => `hsl(${hue},${buildingSaturations[index]}%,${8 + level / STROKE_LEVELS * 24 + buildingLightnessOffsets[index]}%)`));
  const doorShades = Array.from({ length: STROKE_LEVELS + 1 }, (_, level) => `hsl(165,45%,${22 + level / STROKE_LEVELS * 22}%)`);
  const magicDoorShades = Array.from({ length: STROKE_LEVELS + 1 }, (_, level) => `hsl(285,45%,${24 + level / STROKE_LEVELS * 22}%)`);

  function resize() {
    // Keep the backing canvas modest on high-DPI displays. Lower tiers reduce
    // pixel work as well as ray and line work on slower machines.
    pixelRatioCap = quality < .55 ? .9 : quality < .75 ? 1 : 1.25;
    width = innerWidth;
    height = innerHeight;
    // The canvas is stretched to the window by CSS, so large windows can render at a lower
    // pixel ratio to keep the pixel count (and fill cost) bounded.
    const budgetRatio = Math.sqrt(MAX_BACKING_PIXELS / (width * height));
    pixelRatio = Math.min(devicePixelRatio || 1, pixelRatioCap, budgetRatio);
    horizon = height * .5;
    focal = width / (2 * Math.tan(FOV / 2));
    rayCount = Math.min(COARSE_POINTER ? 480 : 720, Math.max(360, Math.floor(width * .72)));
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
      const saturation = ['A', 'B'].includes(area.name) ? 48 : ['C', 'D', 'E'].includes(area.name) ? 38 : 30;
      const lightnessOffset = area.name === 'A' ? 1 : 0;
      ceiling.addColorStop(0, `hsl(${hue},${saturation}%,${20 + lightnessOffset}%)`);
      ceiling.addColorStop(1, `hsl(${hue},${saturation}%,${13 + lightnessOffset}%)`);
      const floor = context.createLinearGradient(0, horizon, 0, height);
      floor.addColorStop(0, `hsl(${hue},${saturation}%,${13 + lightnessOffset}%)`);
      floor.addColorStop(1, `hsl(${hue},${saturation}%,${20 + lightnessOffset}%)`);
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
    const framePhases = PROFILE_RENDERER ? {} : null;
    let phaseStartedAt = frameStart;
    if (previousTime) {
      frameAverage += (Math.min(100, frameStart - previousTime) - frameAverage) * .1;
      if (++framesSinceAdjust >= 45) {
        framesSinceAdjust = 0;
        const oldPixelRatioCap = pixelRatioCap;
        if (frameAverage > 22) quality = Math.max(.45, quality - .1);
        else if (frameAverage < 17.5) quality = Math.min(1, quality + .05);
        const nextPixelRatioCap = quality < .55 ? .9 : quality < .75 ? 1 : 1.25;
        if (nextPixelRatioCap !== oldPixelRatioCap) resize();
      }
    }
    previousTime = frameStart;
    const launchView = player.launchView;
    const originalHorizon = horizon;
    const cameraHeight = launchView?.height ?? EYE_HEIGHT;
    if (launchView) {
      horizon = Math.max(height * .08, originalHorizon - focal * Math.tan(launchView.pitch));
    }
    const playerBuilding = launchView && cameraHeight > WALL_HEIGHT
      ? null
      : world.getRoomAt(player.x, player.y)?.building;
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
    if (framePhases) {
      phaseStartedAt = performance.now();
      framePhases.skyMs = phaseStartedAt - frameStart;
    }

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
    visibleDoors.clear();
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
      let narrowDoorPanel = false;
      rayDoorIds.length = 0;
      rayDoorDistances.length = 0;

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
        const edgeLine = side === 0 ? (stepX > 0 ? mapX : mapX + 1) : (stepY > 0 ? mapY : mapY + 1);
        const edgeIndex = side === 0 ? mapY * (mapWidth + 1) + edgeLine : edgeLine * mapWidth + mapX;
        const edgeDoorId = side === 0 ? verticalDoorEdges[edgeIndex] : horizontalDoorEdges[edgeIndex];
        const edgeWall = side === 0 ? verticalWallEdges[edgeIndex] : horizontalWallEdges[edgeIndex];
        if (edgeDoorId >= 0) {
          const bounds = doorAlongBounds.get(edgeDoorId);
          const along = side === 0 ? player.y + rayY * distance : player.x + rayX * distance;
          const min = bounds ? (side === 0 ? bounds.minY : bounds.minX) : Math.floor(along);
          const max = bounds ? (side === 0 ? bounds.maxY : bounds.maxX) : Math.floor(along);
          const center = (min + max + 1) / 2;
          narrowDoorPanel = Math.abs(along - center) <= (max - min + 1) * DOOR_WIDTH / 2;
          if (narrowDoorPanel) {
            rayDoorIds.push(edgeDoorId);
            rayDoorDistances.push(distance);
          }
          // At close range, treat the opening as passable so the lintel does
          // not expand down across the view as the player crosses the plane.
          if (distance > 1.15) {
            hitX = mapX;
            hitY = mapY;
            wallHit = true;
            doorPanel = true;
            break;
          }
        }
        if (edgeWall) {
          hitX = mapX;
          hitY = mapY;
          wallHit = true;
          break;
        }
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
          const bounds = doorAlongBounds.get(doorId);
          const along = side === 0 ? player.y + rayY * distance : player.x + rayX * distance;
          const min = bounds ? (side === 0 ? bounds.minY : bounds.minX) : Math.floor(along);
          const max = bounds ? (side === 0 ? bounds.maxY : bounds.maxX) : Math.floor(along);
          const center = (min + max + 1) / 2;
          narrowDoorPanel = Math.abs(along - center) <= (max - min + 1) * DOOR_WIDTH / 2;
          if (narrowDoorPanel) {
            rayDoorIds.push(doorId);
            rayDoorDistances.push(distance);
          }
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
      for (let doorIndex = 0; doorIndex < rayDoorIds.length; doorIndex++) {
        const doorId = rayDoorIds[doorIndex];
        const doorDepth = rayDoorDistances[doorIndex] * cosDelta;
        let visible = visibleDoors.get(doorId);
        if (!visible) {
          visibleDoors.set(doorId, visible = { id: doorId, left: sx, right: sx + step, leftDepth: doorDepth, rightDepth: doorDepth, magic: world.magicDoorIds.has(doorId) });
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
        const roofTop = near < .01 ? 0 : Math.max(0, horizon + focal * (cameraHeight - WALL_HEIGHT) / near);
        const roofBottom = Math.min(height, horizon + focal * (cameraHeight - WALL_HEIGHT) / far);
        if (roofBottom > roofTop) {
          context.fillStyle = finishes.ceiling;
          context.fillRect(sx, roofTop, step + 1, roofBottom - roofTop);
        }
        const floorTop = Math.max(horizon, horizon + focal * cameraHeight / far);
        const floorBottom = near < .01 ? height : Math.min(height, horizon + focal * cameraHeight / near);
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
      const top = horizon + focal * (cameraHeight - WALL_HEIGHT) / distance;
      const bottom = horizon + focal * cameraHeight / distance;
      const alpha = Math.max(.2, .9 - distance * .0012 - (side ? .16 : 0));
      const level = Math.round(alpha * STROKE_LEVELS);
      // The lintel belongs to the wall that was hit. Using the player's tile
      // miscolors it when viewing an exterior door from outside, or an interior
      // door beyond an exterior entrance while the player is still outside.
      const owner = buildingGrid[hitY * mapWidth + hitX];
      // Whole device pixels, so fractional scaling never leaves a see-through seam between columns.
      const left = Math.floor(sx * pixelRatio) / pixelRatio;
      const right = Math.ceil((sx + step + 1) * pixelRatio) / pixelRatio;
      const fillTop = Math.floor(top * pixelRatio) / pixelRatio;
      const fillBottom = Math.ceil(bottom * pixelRatio) / pixelRatio;
      // A door cell is still part of the wall above the door opening. Paint the
      // full wall first, then overlay the shorter door panel below its lintel.
      context.fillStyle = wallShades[owner][level];
      context.fillRect(left, fillTop, right - left, fillBottom - fillTop);
      if (doorPanel) {
        const panelTop = Math.max(top, bottom - Math.min(wallHeight, focal * DOOR_HEIGHT / distance));
        const fillPanelTop = Math.floor(panelTop * pixelRatio) / pixelRatio;
        if (narrowDoorPanel) {
          context.fillStyle = magicDoorPanel ? magicDoorShades[level] : doorShades[level];
          context.fillRect(left, fillPanelTop, right - left, fillBottom - fillPanelTop);
        }
      }
    }
    if (framePhases) {
      const rayEndedAt = performance.now();
      framePhases.rayMs = rayEndedAt - phaseStartedAt;
      phaseStartedAt = rayEndedAt;
    }

    const { drawProjectedPolyline, addProjectedPolyline } = createProjector(context, {
      width, focal, horizon, cameraHeight, player, cosA, sinA, step, quality, hitPool, hitCount, coarsePointer: COARSE_POINTER
    });
    const pathStyle = { color: 'rgba(114,255,208,.58)', width: 1.4 };
    pathLines ??= buildPathLines(world.paths.filter(path => path.drawPath !== false));
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
    for (const fixture of world.fixtures ?? []) {
      if (!isNear(fixture)) continue;
      const fixtureStyle = fixture.color ? { color: fixture.color, width: 1.5 } : objectLineStyle;
      drawWireObject(fixture, false, fixtureStyle);
    }
    if (world.ticketSeller && isNear(world.ticketSeller)) drawWireObject(world.ticketSeller, false, objectLineStyle);
    if (world.rocket && isNear(world.rocket)) {
      const launchSeconds = player.launching?.elapsed ?? 0;
      const lift = launchView ? Math.max(0, cameraHeight - EYE_HEIGHT) : player.launching ? Math.min(18, launchSeconds * launchSeconds * 2.4) : 0;
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
      const frontSide = picture.side === 'north' ? player.y > picture.y
        : picture.side === 'south' ? player.y < picture.y
        : picture.side === 'west' ? player.x > picture.x
        : player.x < picture.x;
      if (!frontSide) continue;
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
      const leftBottom = horizon + focal * cameraHeight / door.leftDepth;
      const rightBottom = horizon + focal * cameraHeight / door.rightDepth;
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
      if (door.magic) drawDoorGlyph(magicDoorById.get(door.id), player, drawProjectedPolyline);
    }
    if (player.teleportFlash > 0) {
      const alpha = Math.min(.4, player.teleportFlash * 1.15);
      context.fillStyle = `rgba(214,128,255,${alpha})`;
      context.fillRect(0, 0, width, height);
    }
    if (framePhases) {
      framePhases.lineMs = performance.now() - phaseStartedAt;
      reportFrameProfile(framePhases, performance.now() - frameStart, step);
    }
    horizon = originalHorizon;
  }

  const drawLaunch = createLaunchRenderer(context, () => ({ width, height }), draw, EYE_HEIGHT);

  return { draw, drawLaunch };
}
