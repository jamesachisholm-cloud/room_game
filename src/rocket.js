function ringPoints(x, y, z, radiusX, radiusZ, count = 8) {
  return Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count;
    return { x: x + Math.cos(angle) * radiusX, y, z: z + Math.sin(angle) * radiusZ };
  });
}

export function makeRocket(x, entranceY) {
  const centerY = entranceY - .35;
  const lengthCenter = entranceY + 4.7;
  const centerZ = 1.05;
  const lines = [];
  const rings = [
    { y: -3.7, rx: .48, rz: .48 },
    { y: -3.1, rx: .68, rz: .65 },
    { y: 2.9, rx: .68, rz: .65 },
    { y: 3.6, rx: .57, rz: .55 },
    { y: 4.25, rx: .28, rz: .28 }
  ].map(ring => ringPoints(x, lengthCenter + ring.y, centerZ, ring.rx, ring.rz));

  // A riveted, cigar-shaped fuselage with a pointed nose and stepped tail.
  lines.push(...rings.map(points => [...points, points[0]]));
  for (let index = 0; index < 8; index++) {
    lines.push([rings[0][index], rings[1][index], rings[2][index], rings[3][index], rings[4][index]]);
    lines.push([rings[4][index], { x, y: lengthCenter + 5.1, z: centerZ }]);
  }

  // The rear bulkhead, boarding hatch, ladder, and two handrails face Room F.
  const bulkhead = ringPoints(x, lengthCenter - 3.72, centerZ, .45, .45, 4);
  lines.push([...bulkhead, bulkhead[0]]);
  const hatchY = lengthCenter - 4.15;
  lines.push(
    [{ x: x - .23, y: hatchY, z: .15 }, { x: x - .23, y: hatchY, z: .78 }, { x: x + .23, y: hatchY, z: .78 }, { x: x + .23, y: hatchY, z: .15 }, { x: x - .23, y: hatchY, z: .15 }],
    [{ x: x - .42, y: hatchY - .1, z: 0 }, { x: x - .42, y: hatchY - .1, z: .9 }],
    [{ x: x + .42, y: hatchY - .1, z: 0 }, { x: x + .42, y: hatchY - .1, z: .9 }],
    [{ x: x - .42, y: hatchY - .1, z: .2 }, { x: x + .42, y: hatchY - .1, z: .2 }],
    [{ x: x - .42, y: hatchY - .1, z: .42 }, { x: x + .42, y: hatchY - .1, z: .42 }],
    [{ x: x - .42, y: hatchY - .1, z: .64 }, { x: x + .42, y: hatchY - .1, z: .64 }]
  );

  // Swept fins give the silhouette its early science-fiction rocket shape.
  for (const side of [-1, 1]) {
    const fin = [
      { x: x + side * .5, y: lengthCenter + 2.8, z: .75 },
      { x: x + side * 1.65, y: lengthCenter + 4.05, z: .12 },
      { x: x + side * 1.5, y: lengthCenter - 2.8, z: .12 },
      { x: x + side * .64, y: lengthCenter - 3.4, z: .72 }
    ];
    lines.push([...fin, fin[0]], [fin[0], fin[2]], [fin[1], fin[3]]);
  }

  // Three braces keep the grounded ship just above the lunar surface.
  for (let index = 0; index < 3; index++) {
    const angle = index * Math.PI * 2 / 3;
    const foot = { x: x + Math.cos(angle) * .95, y: lengthCenter + Math.sin(angle) * 2.2, z: .06 };
    const mount = { x: x + Math.cos(angle) * .48, y: lengthCenter + Math.sin(angle) * 2.2, z: .7 };
    lines.push([mount, foot], [foot, { ...foot, z: .12 }]);
  }

  // A striped canopy sits on the upper forward section of the fuselage.
  const canopy = ringPoints(x, lengthCenter + 1.85, centerZ + .53, .34, .1, 6);
  lines.push([...canopy, canopy[0]], [canopy[0], canopy[3]], [canopy[1], canopy[4]], [canopy[2], canopy[5]]);

  // Rotate the long axis across the player's view so the ship is seen broadside from Room F.
  const sideOnLines = lines.map(line => line.map(point => ({
    x: x + point.y - lengthCenter,
    y: centerY + point.x - x,
    z: point.z
  })));
  const sideY = entranceY + .32;
  const hatch = [
    [{ x: x - .28, y: sideY, z: .18 }, { x: x - .28, y: sideY, z: .82 }, { x: x + .28, y: sideY, z: .82 }, { x: x + .28, y: sideY, z: .18 }, { x: x - .28, y: sideY, z: .18 }],
    [{ x: x - .5, y: sideY + .16, z: .08 }, { x: x - .5, y: sideY + .16, z: 1 }],
    [{ x: x + .5, y: sideY + .16, z: .08 }, { x: x + .5, y: sideY + .16, z: 1 }],
    [{ x: x - .5, y: sideY + .16, z: .25 }, { x: x + .5, y: sideY + .16, z: .25 }],
    [{ x: x - .5, y: sideY + .16, z: .5 }, { x: x + .5, y: sideY + .16, z: .5 }],
    [{ x: x - .5, y: sideY + .16, z: .75 }, { x: x + .5, y: sideY + .16, z: .75 }]
  ];
  const signY = sideY + .22;
  const signLines = [
    [{ x: x + .92, y: signY, z: .72 }, { x: x + 1.72, y: signY, z: .72 }, { x: x + 1.72, y: signY, z: 1.5 }, { x: x + .92, y: signY, z: 1.5 }, { x: x + .92, y: signY, z: .72 }],
    [{ x: x + 1.02, y: signY, z: .04 }, { x: x + 1.02, y: signY, z: .72 }],
    [{ x: x + 1.62, y: signY, z: .04 }, { x: x + 1.62, y: signY, z: .72 }],
    [{ x: x + 1.12, y: signY, z: 1.35 }, { x: x + 1.5, y: signY, z: 1.35 }, { x: x + 1.12, y: signY, z: 1.12 }, { x: x + 1.5, y: signY, z: 1.12 }, { x: x + 1.12, y: signY, z: .9 }, { x: x + 1.5, y: signY, z: .9 }]
  ];
  return { x, y: centerY, entranceX: x, entranceY, lines: [...sideOnLines, ...hatch], signLines, baseZ: 0 };
}
