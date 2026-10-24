const PATH_HALF_WIDTH = .5;

// Build the two parallel edges and clean corner joins for the world's paths.
export function buildPathLines(paths) {
  const lines = [];
  const innerCornerTrims = new Map();
  const cornerJoins = [];
  const trimKey = (pathIndex, endpoint, offset) => `${pathIndex}:${endpoint}:${offset}`;

  const trimJunctionEnd = (path, endpoint, otherEndpoint) => {
    const crossing = paths.some(other => {
      if (other.axis === path.axis) return false;
      const low = Math.min(other.from, other.to);
      const high = Math.max(other.from, other.to);
      return other.fixed === endpoint && path.fixed > low && path.fixed < high;
    });
    return crossing ? endpoint + Math.sign(otherEndpoint - endpoint) * PATH_HALF_WIDTH : endpoint;
  };

  // Find 90-degree shared endpoints before drawing the parallel path edges.
  for (let first = 0; first < paths.length; first++) {
    for (let second = first + 1; second < paths.length; second++) {
      const a = paths[first];
      const b = paths[second];
      if (a.axis === b.axis) continue;
      const horizontalIndex = a.axis === 'x' ? first : second;
      const verticalIndex = a.axis === 'y' ? first : second;
      const horizontal = paths[horizontalIndex];
      const vertical = paths[verticalIndex];
      for (const x of [horizontal.from, horizontal.to]) {
        for (const y of [vertical.from, vertical.to]) {
          if (vertical.fixed !== x || horizontal.fixed !== y) continue;
          const horizontalInward = Math.sign((x === horizontal.from ? horizontal.to : horizontal.from) - x);
          const verticalInward = Math.sign((y === vertical.from ? vertical.to : vertical.from) - y);
          for (const side of [-1, 1]) {
            const verticalSide = side * horizontalInward * verticalInward;
            if (side === verticalInward) {
              // The inner edges already intersect; stop both there to avoid doubled strokes.
              innerCornerTrims.set(trimKey(horizontalIndex, x, side), x + verticalSide * PATH_HALF_WIDTH);
              innerCornerTrims.set(trimKey(verticalIndex, y, verticalSide), y + side * PATH_HALF_WIDTH);
            } else {
              cornerJoins.push([
                { x, y: y + side * PATH_HALF_WIDTH, z: 0 },
                { x: x + verticalSide * PATH_HALF_WIDTH, y: y + side * PATH_HALF_WIDTH, z: 0 },
                { x: x + verticalSide * PATH_HALF_WIDTH, y, z: 0 }
              ]);
            }
          }
        }
      }
    }
  }

  for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
    const path = paths[pathIndex];
    for (const offset of [-PATH_HALF_WIDTH, PATH_HALF_WIDTH]) {
      const from = innerCornerTrims.get(trimKey(pathIndex, path.from, offset))
        ?? trimJunctionEnd(path, path.from, path.to);
      const to = innerCornerTrims.get(trimKey(pathIndex, path.to, offset))
        ?? trimJunctionEnd(path, path.to, path.from);
      const low = Math.min(from, to);
      const high = Math.max(from, to);
      const samples = [];
      for (let value = low; value < high; value += 4) samples.push(value);
      samples.push(high);
      const points = samples.map(value => ({
        x: path.axis === 'x' ? value : path.fixed + offset,
        y: path.axis === 'x' ? path.fixed + offset : value,
        z: 0
      }));
      lines.push(points);
    }
  }

  lines.push(...cornerJoins);
  return lines;
}
