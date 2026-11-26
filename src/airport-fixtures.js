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
