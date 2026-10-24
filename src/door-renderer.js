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

// Draws a portal's destination label using the renderer's shared line projection.
export function drawDoorGlyph(portal, player, drawProjectedPolyline) {
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
