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
  // Three passenger coaches parked along the north frontage, clear of the entrance at the west end.
  for (const xOffset of [11.5, 14.5, 17.5]) {
    const coach = fixture(building.x + xOffset, building.y - 2.8, '#8fcfc8');
    // Rotate the coach's front (its local +X end) toward the north, away from the building.
    const addCoach = (...points) => coach.add(...points.map(([x, y, z]) => [-y * .595, -x * .493, z * .527]));
    // Long passenger body with a lower chassis and clipped front cab.
    addCoach([-2.85, -.72, .58], [2.15, -.72, .58], [2.85, -.48, .58], [2.85, .48, .58], [2.15, .72, .58], [-2.85, .72, .58], [-2.85, -.72, .58]);
    addCoach([-2.85, -.72, .58], [-2.85, -.72, 1.9], [2.15, -.72, 1.9], [2.85, -.48, 1.62], [2.85, .48, 1.62], [2.15, .72, 1.9], [-2.85, .72, 1.9], [-2.85, -.72, .58]);
    addCoach([-2.85, .72, .58], [-2.85, .72, 1.9]);
    addCoach([2.15, -.72, 1.9], [2.15, .72, 1.9]);
    // Passenger windows on both sides, with a broad front windscreen.
    for (const side of [-1, 1]) {
      for (const x of [-2.35, -1.55, -.75, .05, .85, 1.55]) {
        addCoach([x, side * .735, 1.18], [x + .58, side * .735, 1.18], [x + .58, side * .735, 1.72], [x, side * .735, 1.72], [x, side * .735, 1.18]);
      }
    }
    addCoach([2.19, -.48, 1.12], [2.19, .48, 1.12], [2.72, .4, 1.36], [2.72, -.4, 1.36], [2.19, -.48, 1.12]);
    // Three axles per side.
    for (const x of [-1.95, .75, 2.15]) {
      for (const side of [-1, 1]) {
        const wheel = Array.from({ length: 9 }, (_, i) => {
          const angle = i * Math.PI * 2 / 8;
          return [x + Math.cos(angle) * .31, side * .74, .35 + Math.sin(angle) * .31];
        });
        addCoach(...wheel);
      }
    }
    // Mirrors and destination sign make the coach read clearly from a distance.
    addCoach([2.45, -.48, 1.25], [2.7, -.68, 1.42], [2.7, -.68, 1.58]);
    addCoach([2.45, .48, 1.25], [2.7, .68, 1.42], [2.7, .68, 1.58]);
    addCoach([2.05, -.73, 1.73], [2.7, -.48, 1.73]);
    fixtures.push(coach);
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

  // A dedicated short landing strip and a small moored airship on the east side.
  const airshipX = rocket.x + 28;
  const airshipY = rocket.y + 10;
  const airshipStrip = fixture(airshipX, airshipY, '#b9d9e4');
  airshipStrip.add([-4, -15, z], [-4, 15, z]);
  airshipStrip.add([4, -15, z], [4, 15, z]);
  for (const y of [-15, 15]) {
    for (let x = -3.3; x <= 2.5; x += 1.1) airshipStrip.add([x, y, z], [x + .65, y, z]);
  }
  for (const y of [-11, -7, -3, 3, 7, 11]) airshipStrip.add([0, y, z], [0, y + 1.5, z]);
  fixtures.push(airshipStrip);

  // Elongated ring sections, tail fins and a suspended gondola make the zeppelin silhouette.
  const zeppelin = fixture(airshipX, airshipY, '#a8d8d1');
  const airshipRings = [
    [-6, .08, 5.75], [-4.8, .52, 6.1], [-3, .92, 6.35],
    [0, 1.12, 6.45], [3, .92, 6.35], [4.8, .52, 6.1], [6, .08, 5.75]
  ];
  for (const [y, radius, height] of airshipRings) {
    const ring = Array.from({ length: 9 }, (_, i) => {
      const angle = i * Math.PI * 2 / 8;
      return [Math.cos(angle) * radius, y, height + Math.sin(angle) * radius * .62];
    });
    zeppelin.add(...ring);
  }
  for (let i = 0; i < airshipRings.length - 1; i++) {
    const [y1, r1, h1] = airshipRings[i], [y2, r2, h2] = airshipRings[i + 1];
    for (let j = 0; j < 8; j++) {
      const angle = j * Math.PI / 4;
      zeppelin.add(
        [Math.cos(angle) * r1, y1, h1 + Math.sin(angle) * r1 * .62],
        [Math.cos(angle) * r2, y2, h2 + Math.sin(angle) * r2 * .62]
      );
    }
  }
  // Gondola, fins and short mooring ropes.
  zeppelin.add([-.55, -1.1, 5.25], [.55, -1.1, 5.25], [.55, 1.1, 5.25], [-.55, 1.1, 5.25], [-.55, -1.1, 5.25]);
  zeppelin.add([-.55, -1.1, 5.25], [-.4, -1.1, 4.82], [.4, -1.1, 4.82], [.55, -1.1, 5.25]);
  zeppelin.add([-.55, 1.1, 5.25], [-.4, 1.1, 4.82], [.4, 1.1, 4.82], [.55, 1.1, 5.25]);
  zeppelin.add([-.12, 5.1, 5.9], [-.12, 6.25, 6.35], [-.12, 7, 5.9], [-.12, 6.25, 5.5], [-.12, 5.1, 5.9]);
  zeppelin.add([.12, 5.1, 5.9], [.12, 6.25, 6.35], [.12, 7, 5.9], [.12, 6.25, 5.5], [.12, 5.1, 5.9]);
  zeppelin.add([0, -4.8, 5.95], [0, -5.5, 5.45], [0, -4.8, 5.55]);
  zeppelin.add([-.7, 0, 5.4], [-1.4, 0, .04]);
  zeppelin.add([.7, 0, 5.4], [1.4, 0, .04]);
  fixtures.push(zeppelin);

  // Bright rescue truck with cab, hose reel, lights and six wheel outlines.
  const fireTruck = fixture(rocket.x + 18.5, rocket.y + 10, '#ff806f');
  fireTruck.add([-1.7, -.72, .34], [1.65, -.72, .34], [1.65, .72, .34], [-1.7, .72, .34], [-1.7, -.72, .34]);
  fireTruck.add([-1.7, -.72, .34], [-1.7, -.72, 1.05], [-.35, -.72, 1.05], [-.35, -.72, .34]);
  fireTruck.add([-1.7, .72, .34], [-1.7, .72, 1.05], [-.35, .72, 1.05], [-.35, .72, .34]);
  fireTruck.add([-.35, -.72, .34], [-.35, -.72, 1.45], [.9, -.72, 1.45], [1.05, -.72, .34]);
  fireTruck.add([-.35, .72, .34], [-.35, .72, 1.45], [.9, .72, 1.45], [1.05, .72, .34]);
  fireTruck.add([-.35, -.72, 1.45], [-.35, .72, 1.45]);
  fireTruck.add([.9, -.72, 1.45], [.9, .72, 1.45]);
  fireTruck.add([1.65, -.62, .68], [1.95, -.62, .68], [1.95, .62, .68], [1.65, .62, .68]);
  // Hose reel on the rear body and a roof ladder.
  for (let side of [-1, 1]) {
    const reel = Array.from({ length: 9 }, (_, i) => {
      const a = i * Math.PI * 2 / 8;
      return [.72 + Math.cos(a) * .38, side * .735, .88 + Math.sin(a) * .38];
    });
    fireTruck.add(...reel);
  }
  fireTruck.add([-.2, -.35, 1.5], [1.35, -.35, 1.5]);
  fireTruck.add([-.2, -.2, 1.63], [1.35, -.2, 1.63]);
  for (let x = -.05; x <= 1.2; x += .3) fireTruck.add([x, -.35, 1.5], [x, -.2, 1.63]);
  fireTruck.add([-.95, -.74, 1.1], [-.55, -.74, 1.1], [-.55, -.74, 1.28], [-.95, -.74, 1.28], [-.95, -.74, 1.1]);
  for (const x of [-1.15, .25, 1.35]) {
    for (const side of [-1, 1]) {
      const wheel = Array.from({ length: 9 }, (_, i) => {
        const a = i * Math.PI * 2 / 8;
        return [x + Math.cos(a) * .26, side * .73, .27 + Math.sin(a) * .26];
      });
      fireTruck.add(...wheel);
    }
  }
  fixtures.push(fireTruck);

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
