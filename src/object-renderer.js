const OBJECT_RANGE = 50;
const OBJECT_LINE_STYLE = { color: 'rgba(114,255,208,.72)', width: 1.5 };

export function createObjectRenderer(context, world) {
  function drawCuboid(box, addProjectedPolyline, ignoreWalls = false, lineStyle = OBJECT_LINE_STYLE) {
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

  function drawWireObject(object, addProjectedPolyline, ignoreWalls = false, lineStyle = OBJECT_LINE_STYLE) {
    for (const part of object.cuboids ?? []) drawCuboid(part, addProjectedPolyline, ignoreWalls, lineStyle);
    context.strokeStyle = lineStyle.color;
    context.lineWidth = lineStyle.width;
    context.beginPath();
    for (const line of object.lines) addProjectedPolyline(line, ignoreWalls, 10);
    context.stroke();
  }

  function draw({ player, now, launchView, cameraHeight, eyeHeight, addProjectedPolyline }) {
    const objectStyle = object => {
      const remaining = (object.flashUntil ?? 0) - now;
      if (remaining > 0) {
        const progress = Math.max(0, Math.min(1, 1 - remaining / 1100));
        const glow = Math.sin(progress * Math.PI);
        return { color: `rgba(221,255,245,${.35 + glow * .65})`, width: 1.5 + glow * 1.5 };
      }
      return object.paired
        ? { color: 'rgba(147,235,255,.9)', width: 2 }
        : OBJECT_LINE_STYLE;
    };
    const isNear = object => (object.x - player.x) ** 2 + (object.y - player.y) ** 2 < OBJECT_RANGE ** 2;

    for (const box of world.boxes) if (!box.held && isNear(box)) drawCuboid(box, addProjectedPolyline, false, objectStyle(box));
    for (const table of world.tables) {
      if (!table.held && isNear(table)) {
        for (const part of table.parts) drawCuboid(part, addProjectedPolyline, false, objectStyle(table));
      }
    }
    if (world.cat && !world.cat.held && isNear(world.cat)) drawWireObject(world.cat, addProjectedPolyline, false, objectStyle(world.cat));
    for (const guitar of world.guitars) {
      if (!guitar.held && isNear(guitar)) drawWireObject(guitar, addProjectedPolyline, false, objectStyle(guitar));
    }
    for (const object of world.wireObjects) {
      if (!object.held && isNear(object)) drawWireObject(object, addProjectedPolyline, false, objectStyle(object));
    }
    for (const fixture of world.fixtures ?? []) {
      if (!isNear(fixture)) continue;
      const fixtureStyle = fixture.color ? { color: fixture.color, width: 1.5 } : OBJECT_LINE_STYLE;
      drawWireObject(fixture, addProjectedPolyline, false, fixtureStyle);
    }
    if (world.ticketSeller && isNear(world.ticketSeller)) {
      drawWireObject(world.ticketSeller, addProjectedPolyline, false, OBJECT_LINE_STYLE);
    }

    if (world.rocket && isNear(world.rocket)) {
      const launchSeconds = player.launching?.elapsed ?? 0;
      const lift = launchView ? Math.max(0, cameraHeight - eyeHeight) : player.launching ? Math.min(18, launchSeconds * launchSeconds * 2.4) : 0;
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
  }

  return draw;
}
