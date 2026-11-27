import { drawDoorGlyph } from './door-renderer.js?v=2026112602';
import { createObjectRenderer } from './object-renderer.js?v=2026112701';
import { buildPathLines } from './path-geometry.js?v=2026112603';
import { createLaunchRenderer } from './launch-renderer.js?v=20261116';
import { createProjector } from './projected-lines.js?v=20261116';
import { createSkyRenderer } from './sky-renderer.js?v=2026112701';
import { WALL_HEIGHT } from './world-constants.js?v=20261117';

// Phones render at a lower resolution and sample fewer rays and line points.
const COARSE_POINTER = matchMedia('(pointer: coarse)').matches;
// Largest canvas backing store, about 1600x875. Bigger windows are scaled up from this.
const MAX_BACKING_PIXELS = 1.4e6;
const STROKE_LEVELS = 32;
const DOOR_HEIGHT = 1;
const DOOR_WIDTH = .8;
const EYE_HEIGHT = .5;
const FOV = Math.PI / 3;
const BUILDING_HUES = { A: 190, B: 316, C: 345, D: 246, E: 28, F: 302 };
const PROFILE_RENDERER = new URLSearchParams(location.search).get('perf') === '1';
export function createRenderer(canvas, world) {
  const context = canvas.getContext('2d');
  const skyRenderer = createSkyRenderer(context);
  const drawSceneObjects = createObjectRenderer(context, world);
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
  let buildingFinishes = [];
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
    skyRenderer.resize({ width, height, pixelRatio, focal, horizon });
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
    skyRenderer.draw(player, frameStart, horizon);
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
    drawSceneObjects({ player, now, launchView, cameraHeight, eyeHeight: EYE_HEIGHT, addProjectedPolyline });

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
