export function createLaunchRenderer(context, getViewport, drawWorld, eyeHeight) {
  return function drawLaunch(player, elapsed) {
    const { width, height } = getViewport();
    const clock = elapsed;
    const worldDepartureDuration = 6;
    const planetStart = worldDepartureDuration;
    const flightTime = Math.max(0, clock - planetStart);
    const progress = Math.max(0, Math.min(1, flightTime / 6.75));

    if (clock < planetStart) {
      const rise = Math.max(0, Math.min(1, clock / worldDepartureDuration)) ** 2;
      drawWorld({
        ...player,
        x: player.launching.cameraX,
        y: player.launching.cameraY,
        a: player.launching.cameraAngle,
        launchView: { height: eyeHeight + 19.5 * rise, pitch: .18 + .4 * rise }
      });
      drawViewport();
      return;
    }

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

    // The home planet starts large in the window and dwindles as the ship climbs away.
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
    // Painted continents and cloud bands make the distant body read as a planet,
    // rather than a diagram of the outpost map.
    const surfacePoint = (x, y) => ({
      x: worldX + x * worldRadius * 1.35,
      y: worldY + y * worldRadius * .88
    });
    context.fillStyle = `rgba(91,150,112,${.76 * (1 - progress * .55)})`;
    const landmasses = [
      [[-.78,-.06],[-.68,-.32],[-.46,-.37],[-.32,-.2],[-.38,-.02],[-.55,.08],[-.6,.32],[-.78,.22]],
      [[-.26,-.55],[.02,-.52],[.2,-.37],[.15,-.2],[-.02,-.1],[-.12,.09],[-.3,-.02],[-.38,-.28]],
      [[.28,-.28],[.53,-.38],[.78,-.2],[.7,.03],[.52,.12],[.45,.34],[.22,.28],[.12,.03]],
      [[-.18,.2],[.02,.14],[.18,.31],[.12,.55],[-.05,.66],[-.22,.5],[-.32,.34]]
    ];
    for (const landmass of landmasses) {
      context.beginPath();
      landmass.forEach(([x, y], index) => {
        const point = surfacePoint(x, y);
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.fill();
    }
    context.strokeStyle = `rgba(225,245,255,${.3 * (1 - progress * .65)})`;
    context.lineWidth = Math.max(1, worldRadius * .025);
    for (const band of [[-.68,-.43,.05],[-.18,.22,.025],[.4,.7,-.03]]) {
      const start = surfacePoint(band[0], band[2]);
      const end = surfacePoint(band[1], band[2] + .04);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.quadraticCurveTo(worldX, worldY + band[2] * worldRadius * .88, end.x, end.y);
      context.stroke();
    }
    context.strokeStyle = `rgba(151,220,255,${.72 * (1 - progress * .58)})`;
    context.lineWidth = Math.max(1, worldRadius * .018);
    context.beginPath();
    context.ellipse(worldX, worldY, worldRadius * .94, worldRadius * .61, -.12, 0, Math.PI * 2);
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

    drawViewport();

    function drawViewport() {
      const minSide = Math.min(width, height);
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
  };
}
