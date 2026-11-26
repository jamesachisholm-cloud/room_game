const PATH_HALF_WIDTH = .5;
const JOIN_EPSILON = 1e-9;

function addSegment(segmentsByCoordinate, coordinate, start, end) {
  if (!segmentsByCoordinate.has(coordinate)) segmentsByCoordinate.set(coordinate, []);
  segmentsByCoordinate.get(coordinate).push([Math.min(start, end), Math.max(start, end)]);
}

function mergeEdges(segmentsByCoordinate, vertical) {
  const lines = [];
  for (const [coordinate, segments] of segmentsByCoordinate) {
    segments.sort((a, b) => a[0] - b[0]);
    let [start, end] = segments[0] ?? [];
    const addLine = (from, to) => lines.push(vertical
      ? [{ x: coordinate, y: from, z: 0 }, { x: coordinate, y: to, z: 0 }]
      : [{ x: from, y: coordinate, z: 0 }, { x: to, y: coordinate, z: 0 }]);
    for (let index = 1; index < segments.length; index++) {
      const [nextStart, nextEnd] = segments[index];
      if (nextStart <= end + JOIN_EPSILON) {
        end = Math.max(end, nextEnd);
      } else {
        addLine(start, end);
        [start, end] = [nextStart, nextEnd];
      }
    }
    if (start !== undefined) addLine(start, end);
  }
  return lines;
}

// Draw the outline of the combined path surface. Treating paths as a union of
// rectangles gives turns and junctions one shared boundary, without overlap
// stubs from independently extended path edges.
export function buildPathLines(paths) {
  const rectangles = [];
  for (const path of paths) {
    if (!Number.isFinite(path.from) || !Number.isFinite(path.to) || !Number.isFinite(path.fixed)) continue;
    const low = Math.min(path.from, path.to);
    const high = Math.max(path.from, path.to);
    if (high <= low) continue;
    rectangles.push(path.axis === 'x'
      ? { left: low, right: high, top: path.fixed - PATH_HALF_WIDTH, bottom: path.fixed + PATH_HALF_WIDTH }
      : { left: path.fixed - PATH_HALF_WIDTH, right: path.fixed + PATH_HALF_WIDTH, top: low, bottom: high });
  }
  if (!rectangles.length) return [];

  const xs = [...new Set(rectangles.flatMap(rect => [rect.left, rect.right]))].sort((a, b) => a - b);
  const ys = [...new Set(rectangles.flatMap(rect => [rect.top, rect.bottom]))].sort((a, b) => a - b);
  const occupied = Array.from({ length: ys.length - 1 }, () => new Uint8Array(xs.length - 1));
  for (let row = 0; row < ys.length - 1; row++) {
    const y = (ys[row] + ys[row + 1]) / 2;
    for (let column = 0; column < xs.length - 1; column++) {
      const x = (xs[column] + xs[column + 1]) / 2;
      if (rectangles.some(rect => x > rect.left && x < rect.right && y > rect.top && y < rect.bottom)) {
        occupied[row][column] = 1;
      }
    }
  }

  const verticalEdges = new Map();
  const horizontalEdges = new Map();
  for (let row = 0; row < ys.length - 1; row++) {
    for (let column = 0; column < xs.length - 1; column++) {
      if (!occupied[row][column]) continue;
      const left = xs[column];
      const right = xs[column + 1];
      const top = ys[row];
      const bottom = ys[row + 1];
      if (column === 0 || !occupied[row][column - 1]) addSegment(verticalEdges, left, top, bottom);
      if (column === xs.length - 2 || !occupied[row][column + 1]) addSegment(verticalEdges, right, top, bottom);
      if (row === 0 || !occupied[row - 1][column]) addSegment(horizontalEdges, top, left, right);
      if (row === ys.length - 2 || !occupied[row + 1][column]) addSegment(horizontalEdges, bottom, left, right);
    }
  }

  return [...mergeEdges(verticalEdges, true), ...mergeEdges(horizontalEdges, false)];
}
