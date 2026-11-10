function fixture(x, y) {
  const lines = [];
  const add = (...points) => lines.push(points.map(([dx, dy, z]) => ({ x: x + dx, y: y + dy, z })));
  return { x, y, lines, add };
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
