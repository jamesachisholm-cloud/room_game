function fixture(x, y, color = null) {
  const lines = [];
  const add = (...points) => lines.push(points.map(([dx, dy, z]) => ({ x: x + dx, y: y + dy, z })));
  return { x, y, lines, add, color };
}

export function makeAirportFixtures(building) {
  const fixtures = [];
  // The top row is one large departure lounge. Keep furnishings to its perimeter
  // and leave the north exit clear at the west end.
  // Small vending machine with a product window and dispensing slot.
  {
    const f = fixture(building.x + 10.5, building.y + 1.15);
    f.add([-.34, 0, 0], [.34, 0, 0], [.34, 0, .72], [-.34, 0, .72], [-.34, 0, 0]);
    // Front faces south, toward the open lounge.
    f.add([-.25, .025, .35], [.12, .025, .35], [.12, .025, .62], [-.25, .025, .62], [-.25, .025, .35]);
    for (const z of [.43, .51]) f.add([-.23, .035, z], [.1, .035, z]);
    for (let i = 0; i < 3; i++) f.add([.18 + i * .045, .04, .58], [.2 + i * .045, .04, .58]);
    f.add([.13, .03, .08], [.28, .03, .08], [.28, .03, .23], [.13, .03, .23], [.13, .03, .08]);
    fixtures.push(f);
  }
  // Three compact seats, with their backs toward the north wall and seats facing south.
  {
    const f = fixture(building.x + 16.2, building.y + 1.1);
    for (let i = 0; i < 3; i++) {
      const x = i * .72;
      f.add([x, 0, .34], [x + .54, 0, .34], [x + .54, 0, .68], [x, 0, .68], [x, 0, .34]);
      f.add([x, .04, .32], [x + .54, .04, .32], [x + .54, .4, .32], [x, .4, .32], [x, .04, .32]);
      for (const dx of [.08, .46]) f.add([x + dx, .12, .32], [x + dx, .12, .06]);
    }
    fixtures.push(f);
  }
  // Compact wall fountain with a recognizable basin, bubbler and drain, facing west.
  {
    const f = fixture(building.x + 25.8, building.y + 4.6);
    f.add([0, -.24, .04], [0, .24, .04], [0, .24, .52], [0, -.24, .52], [0, -.24, .04]);
    f.add([-.03, -.3, .5], [-.03, .3, .5], [-.25, .23, .61], [-.25, -.23, .61], [-.03, -.3, .5]);
    f.add([-.28, -.09, .63], [-.28, -.09, .72], [-.1, -.09, .72]);
    f.add([-.1, -.09, .72], [-.1, -.09, .64]);
    f.add([-.18, -.1, .53], [-.12, -.1, .53]);
    fixtures.push(f);
  }
  return fixtures;
}

export function makeRocketAirport(rocket) {
  const fixtures = [];
  const runway = fixture(rocket.x, rocket.y, '#d7e6e8');
  const halfLength = 19;
  const halfWidth = 5;
  const z = .025;
  // Parallel edge lines and threshold bars make a clear landing strip around the ship.
  runway.add([-halfLength, -halfWidth, z], [halfLength, -halfWidth, z]);
  runway.add([-halfLength, halfWidth, z], [halfLength, halfWidth, z]);
  for (const x of [-halfLength, halfLength]) {
    for (let y = -halfWidth + .5; y <= halfWidth - .5; y += 1.1) {
      runway.add([x, y, z], [x, y + .55, z]);
    }
  }
  // Dashed centerline sections sit outside the rocket's footprint.
  for (const x of [-16, -13, -10, 10, 13, 16]) runway.add([x, 0, z], [x + 1.4, 0, z]);
  fixtures.push(runway);

  // A shorter cross runway gives the field a small-aircraft area away from the rocket.
  const crossRunway = fixture(rocket.x - 15, rocket.y + 1, '#c4d9df');
  const crossHalfLength = 17;
  const crossHalfWidth = 4;
  crossRunway.add([-crossHalfWidth, -crossHalfLength, z], [-crossHalfWidth, crossHalfLength, z]);
  crossRunway.add([crossHalfWidth, -crossHalfLength, z], [crossHalfWidth, crossHalfLength, z]);
  for (const y of [-crossHalfLength, crossHalfLength]) {
    for (let x = -crossHalfWidth + .4; x <= crossHalfWidth - .4; x += 1.2) {
      crossRunway.add([x, y, z], [x + .55, y, z]);
    }
  }
  for (const y of [-13, -9, -5, 5, 9, 13]) crossRunway.add([0, y, z], [0, y + 1.5, z]);
  fixtures.push(crossRunway);

  // Vintage biplane parked beside the cross runway, with nose pointed south.
  const plane = fixture(rocket.x - 24, rocket.y + 8, '#f0c36b');
  const bodyRings = [
    [-2.25, .08, .92], [-1.75, .25, .98], [-.85, .32, 1.02],
    [.45, .28, .98], [1.45, .19, .93], [2.05, .06, .9]
  ];
  for (const [y, w, h] of bodyRings) {
    plane.add([-w, y, h], [w, y, h]);
    plane.add([-w, y, h], [-w * .8, y, h + .13]);
    plane.add([w, y, h], [w * .8, y, h + .13]);
  }
  for (let i = 0; i < bodyRings.length - 1; i++) {
    const [ay, aw, ah] = bodyRings[i], [by, bw, bh] = bodyRings[i + 1];
    plane.add([-aw, ay, ah], [-bw, by, bh]);
    plane.add([aw, ay, ah], [bw, by, bh]);
    plane.add([-aw * .8, ay, ah + .13], [-bw * .8, by, bh + .13]);
    plane.add([aw * .8, ay, ah + .13], [bw * .8, by, bh + .13]);
  }
  plane.add([-3.5, -.45, 1.42], [3.5, -.45, 1.42], [3.15, .38, 1.42], [-3.15, .38, 1.42], [-3.5, -.45, 1.42]);
  plane.add([-3.05, .05, .72], [3.05, .05, .72], [2.75, .72, .72], [-2.75, .72, .72], [-3.05, .05, .72]);
  for (const side of [-1, 1]) {
    plane.add([side * .28, -.35, 1.36], [side * 2.65, .1, .76]);
    plane.add([side * 2.65, -.35, 1.36], [side * .28, .1, .76]);
  }
  plane.add([-1.25, 1.55, 1], [1.25, 1.55, 1], [1.05, 1.95, 1], [-1.05, 1.95, 1], [-1.25, 1.55, 1]);
  plane.add([0, 1.5, .98], [0, 2.02, 1.65], [0, 2.02, .98]);
  for (const side of [-1, 1]) {
    plane.add([side * .22, -.65, .83], [side * .62, -.55, .22]);
    const wheel = Array.from({ length: 9 }, (_, i) => {
      const a = i * Math.PI * 2 / 8;
      return [side * .62 + Math.cos(a) * .22, -.55, .22 + Math.sin(a) * .22];
    });
    plane.add(...wheel);
  }
  plane.add([-.72, -2.35, .95], [.72, -2.35, .95]);
  plane.add([0, -2.35, .23], [0, -2.35, 1.67]);
  fixtures.push(plane);

  // Biggles in a flight cap and goggles, standing beside his biplane.
  const pilot = fixture(rocket.x - 18.5, rocket.y + 10, '#d9c59d');
  pilot.add([-.2, 0, .08], [-.2, 0, .7], [-.43, 0, .08], [-.2, 0, .08]);
  pilot.add([.2, 0, .08], [.2, 0, .7], [.43, 0, .08], [.2, 0, .08]);
  pilot.add([-.29, 0, .66], [-.29, 0, 1.18], [.29, 0, 1.18], [.29, 0, .66], [-.29, 0, .66]);
  pilot.add([-.28, 0, 1.08], [-.52, 0, .86], [-.54, 0, .62]);
  pilot.add([.28, 0, 1.08], [.52, 0, .86], [.54, 0, .62]);
  pilot.add([-.17, 0, 1.16], [-.17, 0, 1.54], [.17, 0, 1.54], [.17, 0, 1.16]);
  pilot.add([-.2, 0, 1.48], [-.18, 0, 1.67], [0, 0, 1.76], [.18, 0, 1.67], [.2, 0, 1.48]);
  pilot.add([-.32, 0, 1.52], [.32, 0, 1.52]);
  fixtures.push(pilot);
  const goggles = fixture(rocket.x - 18.5, rocket.y + 10, '#ffd66f');
  for (const side of [-1, 1]) {
    goggles.add([side * .18, -.025, 1.43], [side * .04, -.025, 1.43], [side * .04, -.025, 1.55], [side * .18, -.025, 1.55], [side * .18, -.025, 1.43]);
  }
  goggles.add([-.04, -.025, 1.49], [.04, -.025, 1.49]);
  fixtures.push(goggles);

  // A tall pole and striped windsock mark the field's wind direction.
  const pole = fixture(rocket.x - 9, rocket.y - 3.5, '#b9d9e4');
  pole.add([0, 0, 0], [0, 0, 4.2]);
  pole.add([-.18, 0, 4.08], [.18, 0, 4.08]);
  fixtures.push(pole);
  const sockRed = fixture(rocket.x - 9, rocket.y - 3.5, '#ff8c72');
  sockRed.add([.12, 0, 4.02], [.85, 0, 3.72], [1.15, 0, 3.72]);
  sockRed.add([.12, 0, 4.02], [.85, 0, 4.32], [1.15, 0, 4.32]);
  sockRed.add([1.15, 0, 3.72], [1.15, 0, 4.32]);
  sockRed.add([.48, 0, 3.87], [.48, 0, 4.17]);
  sockRed.add([.84, 0, 3.72], [.84, 0, 4.32]);
  fixtures.push(sockRed);

  // Compact electric tow tractor with cab, chassis, bumpers and four wheel outlines.
  const tug = fixture(rocket.x + 8, rocket.y - 2.5);
  tug.add([-.9, -.48, .22], [.9, -.48, .22], [.9, .48, .22], [-.9, .48, .22], [-.9, -.48, .22]);
  tug.add([-.72, -.4, .55], [.42, -.4, .55], [.42, .4, .55], [-.72, .4, .55], [-.72, -.4, .55]);
  tug.add([-.72, -.4, .55], [-.48, -.4, 1.22], [.32, -.4, 1.22], [.42, -.4, .55]);
  tug.add([-.72, .4, .55], [-.48, .4, 1.22], [.32, .4, 1.22], [.42, .4, .55]);
  tug.add([-.48, -.4, 1.22], [-.48, .4, 1.22]);
  tug.add([.32, -.4, 1.22], [.32, .4, 1.22]);
  tug.add([.9, -.52, .32], [1.15, -.52, .32], [1.15, .52, .32], [.9, .52, .32]);
  for (const wheelX of [-.58, .62]) {
    for (const wheelY of [-.51, .51]) {
      const points = Array.from({ length: 9 }, (_, index) => {
        const angle = index * Math.PI * 2 / 8;
        return [wheelX + Math.cos(angle) * .2, wheelY, .24 + Math.sin(angle) * .2];
      });
      tug.add(...points);
    }
  }
  fixtures.push(tug);

  // Low two-bay baggage trailer parked beside the tractor.
  const cart = fixture(rocket.x + 11, rocket.y - 2.5, '#a9d8ca');
  cart.add([-.85, -.48, .38], [.85, -.48, .38], [.85, .48, .38], [-.85, .48, .38], [-.85, -.48, .38]);
  cart.add([-.85, -.48, .38], [-.85, -.48, .76], [-.05, -.48, .76], [-.05, -.48, .38]);
  cart.add([-.85, .48, .38], [-.85, .48, .76], [-.05, .48, .76], [-.05, .48, .38]);
  cart.add([.05, -.48, .38], [.85, -.48, .38], [.85, -.48, .76], [.05, -.48, .76], [.05, -.48, .38]);
  cart.add([.05, .48, .38], [.85, .48, .38], [.85, .48, .76], [.05, .48, .76], [.05, .48, .38]);
  cart.add([-.85, -.48, .38], [-1.05, -.48, .2], [-1.05, .48, .2], [-.85, .48, .38]);
  for (const wheelX of [-.55, .55]) {
    for (const wheelY of [-.5, .5]) {
      const points = Array.from({ length: 9 }, (_, index) => {
        const angle = index * Math.PI * 2 / 8;
        return [wheelX + Math.cos(angle) * .15, wheelY, .17 + Math.sin(angle) * .15];
      });
      cart.add(...points);
    }
  }
  fixtures.push(cart);
  return fixtures;
}
