const FOV = Math.PI / 3;

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

export function createSkyRenderer(context) {
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let focal = 1;
  let skyGradient = null;
  let groundGradient = null;
  let moonSprites = [];
  let cloudSprites = [];

  function resize(size) {
    ({ width, height, pixelRatio, focal } = size);
    skyGradient = context.createLinearGradient(0, 0, 0, size.horizon);
    skyGradient.addColorStop(0, '#0d1c1a');
    skyGradient.addColorStop(1, '#1c3835');
    groundGradient = context.createLinearGradient(0, size.horizon, 0, height);
    groundGradient.addColorStop(0, '#030908');
    groundGradient.addColorStop(1, '#1b302d');
    moonSprites = [];
    cloudSprites = [];
  }

  function renderMoonSprite(moon) {
    const moonRadius = height * moon.radius;
    const size = Math.ceil(moonRadius * 6.8);
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil(size * pixelRatio);
    sprite.height = sprite.width;
    const spriteContext = sprite.getContext('2d');
    spriteContext.scale(pixelRatio, pixelRatio);
    const moonX = size / 2;
    const moonY = size / 2;
    spriteContext.globalAlpha = .78;
    const glow = spriteContext.createRadialGradient(moonX, moonY, moonRadius * .6, moonX, moonY, moonRadius * 3.2);
    glow.addColorStop(0, `${moon.color}44`);
    glow.addColorStop(.3, `${moon.color}22`);
    glow.addColorStop(.6, `${moon.color}0a`);
    glow.addColorStop(1, `${moon.color}00`);
    spriteContext.fillStyle = glow;
    spriteContext.fillRect(moonX - moonRadius * 3.2, moonY - moonRadius * 3.2, moonRadius * 6.4, moonRadius * 6.4);
    // The disc fades out over its outer edge so it melts into the sky.
    const disc = spriteContext.createRadialGradient(moonX, moonY, moonRadius * .55, moonX, moonY, moonRadius * 1.14);
    disc.addColorStop(0, moon.color);
    disc.addColorStop(.6, `${moon.color}cc`);
    disc.addColorStop(1, `${moon.color}00`);
    spriteContext.fillStyle = disc;
    spriteContext.beginPath();
    spriteContext.arc(moonX, moonY, moonRadius * 1.14, 0, Math.PI * 2);
    spriteContext.fill();
    spriteContext.save();
    spriteContext.beginPath();
    spriteContext.arc(moonX, moonY, moonRadius * .9, 0, Math.PI * 2);
    spriteContext.clip();
    for (const [cx, cy, cr] of moon.craters) {
      spriteContext.fillStyle = 'rgba(40,50,80,.09)';
      spriteContext.beginPath();
      spriteContext.arc(moonX + cx * moonRadius, moonY + cy * moonRadius, cr * moonRadius, 0, Math.PI * 2);
      spriteContext.fill();
      // Lit rim on the upper-left edge of each crater.
      spriteContext.strokeStyle = 'rgba(255,255,255,.07)';
      spriteContext.lineWidth = Math.max(.6, moonRadius * .02);
      spriteContext.beginPath();
      spriteContext.arc(moonX + cx * moonRadius, moonY + cy * moonRadius, cr * moonRadius, Math.PI * .75, Math.PI * 1.75);
      spriteContext.stroke();
    }
    const shade = spriteContext.createRadialGradient(moonX - moonRadius * .3, moonY - moonRadius * .3, moonRadius * .3, moonX, moonY, moonRadius * .9);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(10,20,40,.12)');
    spriteContext.fillStyle = shade;
    spriteContext.fillRect(moonX - moonRadius, moonY - moonRadius, moonRadius * 2, moonRadius * 2);
    spriteContext.restore();
    return { canvas: sprite, size };
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

  function draw(player, time, horizon) {
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, width, horizon);
    const seconds = time / 1000;
    const starLimit = Math.tan(FOV / 2 + .05);
    const cosA = Math.cos(player.a);
    const sinA = Math.sin(player.a);
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

    MOONS.forEach((moon, index) => {
      const offset = Math.atan2(Math.sin(moon.angle - player.a), Math.cos(moon.angle - player.a));
      if (Math.abs(offset) > FOV / 2 + .3) return;
      const sprite = moonSprites[index] ?? (moonSprites[index] = renderMoonSprite(moon));
      context.drawImage(sprite.canvas, width / 2 + focal * Math.tan(offset) - sprite.size / 2, horizon * (1 - moon.height) - sprite.size / 2, sprite.size, sprite.size);
    });

    const drift = time * 8e-6;
    CLOUDS.forEach((cloud, index) => {
      const offset = Math.atan2(Math.sin(cloud.angle + drift - player.a), Math.cos(cloud.angle + drift - player.a));
      if (Math.abs(offset) > FOV / 2 + cloud.span / 2) return;
      const sprite = cloudSprites[index] ?? (cloudSprites[index] = renderCloudSprite(cloud));
      context.drawImage(sprite.canvas, width / 2 + focal * Math.tan(offset) - sprite.width / 2, horizon * (1 - cloud.height) - sprite.height / 2, sprite.width, sprite.height);
    });

    context.fillStyle = groundGradient;
    context.fillRect(0, horizon, width, height - horizon);
  }

  return { resize, draw };
}
