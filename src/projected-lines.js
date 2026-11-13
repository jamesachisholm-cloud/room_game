const NEAR_DEPTH = .26;

export function createProjector(context, frame) {
  const { width, focal, horizon, cameraHeight, player, cosA, sinA, step, quality, hitPool, hitCount, coarsePointer } = frame;
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
  const sampleSpacing = (coarsePointer ? 5 : 3) / quality;
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
      const firstY = horizon + focal * (cameraHeight - (startZ + (endZ - startZ) * clipStart)) / firstDepth;
      const lastY = horizon + focal * (cameraHeight - (startZ + (endZ - startZ) * clipEnd)) / lastDepth;
      // Sampling every few pixels lets walls cut the line close to where they begin.
      const count = Math.min(400, Math.max(subdivisions, Math.ceil(Math.hypot(lastX - firstX, lastY - firstY) / sampleSpacing)));
      let active = false;
      for (let index = 0; index <= count; index++) {
        const t = clipStart + (clipEnd - clipStart) * index / count;
        const depth = aDepth + (bDepth - aDepth) * t;
        const screenX = width / 2 + focal * (aLateral + (bLateral - aLateral) * t) / depth;
        const screenY = horizon + focal * (cameraHeight - (startZ + (endZ - startZ) * t)) / depth;
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
  return { drawProjectedPolyline, addProjectedPolyline };
}
