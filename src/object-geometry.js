import { SIZE } from './world-constants.js?v=20261038';

export function makeCat(x, y, scale) {
  const cat = {
    cuboids: [
      { x, y, w: 1.3 * scale, d: .72 * scale, z: .35 * scale, h: .5 * scale },
      { x: x + .85 * scale, y, w: .65 * scale, d: .65 * scale, z: .75 * scale, h: .65 * scale },
      ...[-1, 1].flatMap(side => [-1, 1].map(front => ({
        x: x + front * .43 * scale, y: y + side * .23 * scale,
        w: .16 * scale, d: .16 * scale, z: 0, h: .43 * scale
      })))
    ],
    lines: []
  };
  const addLine = (...points) => cat.lines.push(points.map(([px, py, z]) => ({ x: x + px * scale, y: y + py * scale, z: z * scale })));
  for (const side of [-1, 1]) {
    const a = [.62, side * .2, 1.39];
    const b = [.94, side * .2, 1.39];
    const tip = [.78, side * .2, 1.72];
    addLine(a, b); addLine(b, tip); addLine(tip, a);
  }
  addLine([-.62, 0, .65], [-.92, 0, .82], [-1.05, 0, 1.12]);
  for (const side of [-1, 1]) {
    addLine([1.19, side * .16, 1.13], [1.2, side * .16, 1.2]);
    addLine([1.13, side * .25, 1.02], [1.48, side * .39, 1.08]);
  }
  return cat;
}

export function makeGuitar(x, y, scale) {
  const lines = [];
  const addLine = (...points) => lines.push(points.map(([px, py, z]) => ({
    x: x + px * scale, y: y + py * scale, z: z * scale
  })));
  addLine([0, 0, .12], [-.23, 0, .16], [-.4, 0, .32], [-.36, 0, .52], [-.2, 0, .61], [-.1, 0, .55], [0, 0, .51], [.1, 0, .55], [.2, 0, .61], [.36, 0, .52], [.4, 0, .32], [.23, 0, .16], [0, 0, .12]);
  addLine([-.085, 0, .53], [-.075, 0, 1.38], [.075, 0, 1.38], [.085, 0, .53]);
  addLine([-.075, 0, 1.34], [-.12, 0, 1.43], [-.1, 0, 1.57], [.1, 0, 1.57], [.12, 0, 1.43], [.075, 0, 1.34]);
  addLine([-.12, -.012, .36], [-.08, -.012, .42], [0, -.012, .45], [.08, -.012, .42], [.12, -.012, .36], [.08, -.012, .3], [0, -.012, .27], [-.08, -.012, .3], [-.12, -.012, .36]);
  addLine([-.13, -.02, .23], [.13, -.02, .23]);
  for (const offset of [-.045, -.015, .015, .045]) addLine([offset, -.025, .23], [offset * .7, -.025, 1.39]);
  for (const z of [.76, .88, 1, 1.1, 1.19, 1.27]) addLine([-.078, -.02, z], [.078, -.02, z]);
  return { lines };
}

export function makeSimpleObject(type, x, y, scale) {
  const lines = [];
  const addLine = (...points) => lines.push(points.map(([px, py, z]) => ({
    x: x + px * scale, y: y + py * scale, z: z * scale
  })));
  const circle = (cx, cz, rx, rz, py = 0, segments = 12) => {
    addLine(...Array.from({ length: segments + 1 }, (_, index) => {
      const angle = index / segments * Math.PI * 2;
      return [cx + Math.cos(angle) * rx, py, cz + Math.sin(angle) * rz];
    }));
  };
  if (type === 'h') {
    addLine([-.42, -.13, .08], [-.27, -.13, .08], [-.27, -.13, .92], [-.42, -.13, .92], [-.42, -.13, .08]);
    addLine([.27, -.13, .08], [.42, -.13, .08], [.42, -.13, .92], [.27, -.13, .92], [.27, -.13, .08]);
    addLine([-.3, -.14, .48], [.3, -.14, .48]);
    addLine([-.42, .13, .08], [-.27, .13, .08], [-.27, .13, .92], [-.42, .13, .92], [-.42, .13, .08]);
    addLine([.27, .13, .08], [.42, .13, .08], [.42, .13, .92], [.27, .13, .92], [.27, .13, .08]);
    addLine([-.3, .14, .48], [.3, .14, .48]);
    for (const px of [-.35, .35]) for (const z of [.08, .92]) addLine([px, -.13, z], [px, .13, z]);
    addLine([-.27, -.13, .48], [-.27, .13, .48]); addLine([.27, -.13, .48], [.27, .13, .48]);
  } else if (type === 'snake') {
    addLine([-.58, .12, .1], [-.4, .1, .12], [-.24, -.05, .17], [-.06, -.12, .16], [.12, -.04, .12], [.3, .08, .13], [.47, .06, .19], [.54, -.04, .3]);
    addLine([.44, -.11, .27], [.59, -.11, .27], [.61, -.11, .37], [.48, -.11, .39], [.44, -.11, .27]);
    addLine([.5, -.125, .345], [.53, -.125, .345]);
    addLine([.02, -.1, .16], [.07, -.12, .2], [.12, -.1, .16]);
  } else if (type === 'apple') {
    addLine([0, 0, .08], [-.25, 0, .14], [-.38, 0, .34], [-.34, 0, .62], [-.2, 0, .78], [0, 0, .72], [.2, 0, .78], [.34, 0, .62], [.38, 0, .34], [.25, 0, .14], [0, 0, .08]);
    addLine([0, 0, .72], [.03, 0, .91], [.08, 0, .96]);
    addLine([.04, -.01, .84], [.22, -.01, .92], [.1, -.01, .78], [.04, -.01, .84]);
  } else if (type === 'telephone') {
    addLine([-.47, -.14, .08], [.47, -.14, .08], [.39, -.14, .42], [-.39, -.14, .42], [-.47, -.14, .08]);
    addLine([-.47, .14, .08], [.47, .14, .08], [.39, .14, .42], [-.39, .14, .42], [-.47, .14, .08]);
    for (const px of [-.47, .47]) for (const py of [-.14, .14]) addLine([px, py, .08], [px < 0 ? -.39 : .39, py, .42]);
    circle(0, .29, .22, .09, -.155);
    circle(0, .29, .12, .05, -.17);
    for (let index = 0; index < 8; index++) {
      const angle = index / 8 * Math.PI * 2;
      circle(Math.cos(angle) * .16, .29 + Math.sin(angle) * .065, .018, .018, -.18, 6);
    }
    addLine([-.38, -.12, .46], [-.31, -.12, .67], [-.2, -.12, .73], [.2, -.12, .73], [.31, -.12, .67], [.38, -.12, .46]);
    addLine([-.38, .12, .46], [-.31, .12, .67], [-.2, .12, .73], [.2, .12, .73], [.31, .12, .67], [.38, .12, .46]);
    addLine([-.38, -.12, .46], [-.38, .12, .46]); addLine([.38, -.12, .46], [.38, .12, .46]);
    addLine([-.34, 0, .48], [-.45, 0, .57], [-.5, 0, .69]);
  } else if (type === 'glasses') {
    addLine([-.54, -.08, .34], [-.54, -.08, .58], [-.1, -.08, .58], [-.1, -.08, .34], [-.54, -.08, .34]);
    addLine([.1, -.08, .34], [.1, -.08, .58], [.54, -.08, .58], [.54, -.08, .34], [.1, -.08, .34]);
    addLine([-.1, -.09, .49], [0, -.11, .46], [.1, -.09, .49]);
    addLine([-.54, -.08, .54], [-.7, .12, .57], [-.72, .35, .5]);
    addLine([.54, -.08, .54], [.7, .12, .57], [.72, .35, .5]);
  } else if (type === 'dog') {
    for (const py of [-.15, .15]) {
      addLine([-.48, py, .2], [.25, py, .2], [.25, py, .54], [-.48, py, .54], [-.48, py, .2]);
      addLine([.2, py, .42], [.48, py, .42], [.58, py, .54], [.53, py, .82], [.27, py, .82], [.2, py, .42]);
      addLine([.28, py, .78], [.25, py, .96], [.38, py, .82]);
      addLine([.49, py, .78], [.57, py, .92], [.55, py, .77]);
      addLine([.43, py - .01, .62], [.47, py - .01, .62]);
      addLine([-.48, py, .46], [-.62, py, .58], [-.69, py, .76]);
    }
    for (const px of [-.35, .12]) for (const py of [-.11, .11]) addLine([px, py, .2], [px, py, .06], [px + .13, py, .06], [px + .13, py, .2]);
    for (const px of [-.48, .25]) for (const z of [.2, .54]) addLine([px, -.15, z], [px, .15, z]);
    for (const px of [.25, .58]) for (const z of [.42, .82]) addLine([px, -.15, z], [px, .15, z]);
  } else if (type === 'penny') {
    circle(0, .42, .48, .48, -.055, 16);
    circle(0, .42, .48, .48, .055, 16);
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const px = Math.cos(angle) * .48;
      const z = .42 + Math.sin(angle) * .48;
      addLine([px, -.055, z], [px, .055, z]);
    }
    circle(0, .42, .36, .36, -.06, 16);
    addLine([-.12, -.07, .57], [0, -.07, .68], [.1, -.07, .57], [0, -.07, .4], [.12, -.07, .4]);
  } else if (type === 'fish') {
    addLine([-.54, 0, .34], [-.34, 0, .52], [-.1, 0, .62], [.22, 0, .59], [.43, 0, .47], [.57, 0, .34], [.43, 0, .21], [.22, 0, .1], [-.1, 0, .07], [-.34, 0, .16], [-.54, 0, .34]);
    addLine([-.54, 0, .34], [-.72, 0, .55], [-.7, 0, .34], [-.72, 0, .13], [-.54, 0, .34]);
    addLine([-.08, 0, .6], [.06, 0, .82], [.2, 0, .58]);
    addLine([-.08, 0, .09], [.06, 0, -.08], [.2, 0, .12]);
    circle(.39, .39, .035, .035, -.01, 8);
    addLine([.25, -.015, .34], [.05, -.015, .36], [.22, -.015, .4]);
  } else if (type === 'toycar') {
    addLine([-.62, -.14, .16], [.62, -.14, .16], [.54, -.14, .39], [.25, -.14, .39], [.1, -.14, .57], [-.25, -.14, .57], [-.42, -.14, .39], [-.55, -.14, .39], [-.62, -.14, .16]);
    addLine([-.62, .14, .16], [.62, .14, .16], [.54, .14, .39], [.25, .14, .39], [.1, .14, .57], [-.25, .14, .57], [-.42, .14, .39], [-.55, .14, .39], [-.62, .14, .16]);
    for (const px of [-.4, .4]) {
      circle(px, .17, .14, .14, -.16);
      circle(px, .17, .14, .14, .16);
      addLine([px, -.16, .17], [px, .16, .17]);
    }
    addLine([-.24, -.145, .42], [-.17, -.145, .52], [.04, -.145, .52], [.18, -.145, .42]);
    addLine([-.24, .145, .42], [-.17, .145, .52], [.04, .145, .52], [.18, .145, .42]);
  } else if (type === 'plant') {
    for (const py of [-.1, .1]) addLine([-.22, py, .04], [.22, py, .04], [.28, py, .34], [-.28, py, .34], [-.22, py, .04]);
    for (const [px, z] of [[-.22, .04], [.22, .04], [.28, .34], [-.28, .34]]) addLine([px, -.1, z], [px, .1, z]);
    addLine([0, 0, .34], [0, 0, .7]);
    addLine([0, 0, .5], [-.22, 0, .66]);
    addLine([0, 0, .5], [.22, 0, .66]);
    addLine([0, 0, .62], [-.09, 0, .8], [0, 0, 1], [.09, 0, .8], [0, 0, .62]);
    addLine([-.1, 0, .55], [-.36, 0, .62], [-.42, 0, .84], [-.2, 0, .76], [-.1, 0, .55]);
    addLine([.1, 0, .55], [.36, 0, .62], [.42, 0, .84], [.2, 0, .76], [.1, 0, .55]);
  } else {
    throw new Error(`Unsupported object type: ${type}`);
  }
  return { lines };
}

export function makeWallPicture(building, object) {
  let x;
  let y;
  const alongX = object.side === 'north' || object.side === 'south';
  if (object.side === 'north') {
    x = building.x + object.col * SIZE + object.offset;
    y = building.y + object.row * SIZE + 1 + .035;
  } else if (object.side === 'south') {
    x = building.x + object.col * SIZE + object.offset;
    y = building.y + (object.row + 1) * SIZE - 1 - .035;
  } else if (object.side === 'west') {
    x = building.x + object.col * SIZE + 1 + .035;
    y = building.y + object.row * SIZE + object.offset;
  } else if (object.side === 'east') {
    x = building.x + (object.col + 1) * SIZE - 1 - .035;
    y = building.y + object.row * SIZE + object.offset;
  } else {
    throw new Error(`Picture in Building ${building.name} has an invalid wall side.`);
  }
  const point = (u, v) => alongX
    ? { x: x + u, y, z: object.z + v }
    : { x, y: y + u, z: object.z + v };
  const lines = [];
  const addLine = (...points) => lines.push(points.map(([u, v]) => point(u, v)));
  const halfW = object.w / 2;
  const h = object.h;
  addLine([-halfW, 0], [halfW, 0], [halfW, h], [-halfW, h], [-halfW, 0]);
  const hangerScale = Math.min(object.w / 1.6, object.h / .72);
  const hangRise = hangerScale * .22;
  const stringHalfWidth = halfW * .42;
  const pinRadius = hangerScale * .035;
  addLine([-stringHalfWidth, h], [0, h + hangRise], [stringHalfWidth, h]);
  addLine([-pinRadius, h + hangRise], [0, h + hangRise + pinRadius], [pinRadius, h + hangRise], [0, h + hangRise - pinRadius], [-pinRadius, h + hangRise]);
  const originalArtworkWidth = 1.05;
  const originalArtworkHeight = .48;
  const originalArtworkScale = Math.min(originalArtworkWidth / 1.6, originalArtworkHeight / .72);
  const artworkScale = Math.min(object.w / originalArtworkWidth, object.h / originalArtworkHeight);
  const scale = originalArtworkScale * artworkScale;
  const artworkHeight = originalArtworkHeight * artworkScale;
  const artworkBottom = (h - artworkHeight) / 2;
  const artworkY = fraction => artworkBottom + fraction * artworkHeight;
  if (object.subject === 'dog') {
    addLine([-.17 * scale, artworkY(.42)], [-.17 * scale, artworkY(.73)], [.17 * scale, artworkY(.73)], [.17 * scale, artworkY(.42)], [-.17 * scale, artworkY(.42)]);
    addLine([-.17 * scale, artworkY(.68)], [-.29 * scale, artworkY(.66)], [-.27 * scale, artworkY(.39)], [-.16 * scale, artworkY(.43)]);
    addLine([.17 * scale, artworkY(.68)], [.29 * scale, artworkY(.66)], [.27 * scale, artworkY(.39)], [.16 * scale, artworkY(.43)]);
    addLine([-.09 * scale, artworkY(.61)], [-.06 * scale, artworkY(.61)]);
    addLine([.06 * scale, artworkY(.61)], [.09 * scale, artworkY(.61)]);
    addLine([-.12 * scale, artworkY(.49)], [-.12 * scale, artworkY(.39)], [0, artworkY(.33)], [.12 * scale, artworkY(.39)], [.12 * scale, artworkY(.49)]);
    addLine([-.035 * scale, artworkY(.43)], [.035 * scale, artworkY(.43)]);
    addLine([-.12 * scale, artworkY(.34)], [-.12 * scale, artworkY(.12)], [.12 * scale, artworkY(.12)], [.12 * scale, artworkY(.34)]);
    addLine([.12 * scale, artworkY(.17)], [.25 * scale, artworkY(.22)], [.25 * scale, artworkY(.32)]);
  } else if (object.subject === 'cat') {
    addLine([-.19 * scale, artworkY(.36)], [.19 * scale, artworkY(.36)], [.19 * scale, artworkY(.72)], [-.19 * scale, artworkY(.72)], [-.19 * scale, artworkY(.36)]);
    addLine([-.16 * scale, artworkY(.70)], [-.13 * scale, artworkY(.96)], [-.035 * scale, artworkY(.72)]);
    addLine([.035 * scale, artworkY(.72)], [.13 * scale, artworkY(.96)], [.16 * scale, artworkY(.70)]);
    addLine([-.09 * scale, artworkY(.55)], [-.06 * scale, artworkY(.55)]);
    addLine([.06 * scale, artworkY(.55)], [.09 * scale, artworkY(.55)]);
    addLine([-.15 * scale, artworkY(.49)], [-.27 * scale, artworkY(.46)]);
    addLine([.15 * scale, artworkY(.49)], [.27 * scale, artworkY(.46)]);
    addLine([-.13 * scale, artworkY(.34)], [-.13 * scale, artworkY(.12)], [.13 * scale, artworkY(.12)], [.13 * scale, artworkY(.34)]);
    addLine([.13 * scale, artworkY(.17)], [.25 * scale, artworkY(.22)], [.25 * scale, artworkY(.32)]);
  } else if (object.subject === 'coffee-table') {
    addLine([-.44 * scale, artworkY(.64)], [-.3 * scale, artworkY(.82)], [.3 * scale, artworkY(.82)], [.44 * scale, artworkY(.64)], [-.44 * scale, artworkY(.64)]);
    addLine([-.44 * scale, artworkY(.64)], [.44 * scale, artworkY(.64)], [.44 * scale, artworkY(.56)], [-.44 * scale, artworkY(.56)], [-.44 * scale, artworkY(.64)]);
    addLine([-.35 * scale, artworkY(.56)], [-.35 * scale, artworkY(.2)]);
    addLine([.35 * scale, artworkY(.56)], [.35 * scale, artworkY(.2)]);
    addLine([-.25 * scale, artworkY(.64)], [-.25 * scale, artworkY(.28)]);
    addLine([.25 * scale, artworkY(.64)], [.25 * scale, artworkY(.28)]);
    addLine([-.25 * scale, artworkY(.32)], [.25 * scale, artworkY(.32)]);
  } else if (object.subject === 'box') {
    addLine([-.32 * scale, artworkY(.2)], [.32 * scale, artworkY(.2)], [.32 * scale, artworkY(.72)], [-.32 * scale, artworkY(.72)], [-.32 * scale, artworkY(.2)]);
    addLine([-.32 * scale, artworkY(.72)], [0, artworkY(.9)], [.32 * scale, artworkY(.72)]);
    addLine([0, artworkY(.2)], [0, artworkY(.9)]);
  } else if (object.subject === 'guitar') {
    addLine([0, artworkY(.16)], [-.14 * scale, artworkY(.2)], [-.24 * scale, artworkY(.35)], [-.22 * scale, artworkY(.52)], [-.12 * scale, artworkY(.59)], [-.06 * scale, artworkY(.55)], [0, artworkY(.53)], [.06 * scale, artworkY(.55)], [.12 * scale, artworkY(.59)], [.22 * scale, artworkY(.52)], [.24 * scale, artworkY(.35)], [.14 * scale, artworkY(.2)], [0, artworkY(.16)]);
    addLine([-.055 * scale, artworkY(.54)], [-.045 * scale, artworkY(.9)], [.045 * scale, artworkY(.9)], [.055 * scale, artworkY(.54)]);
    addLine([-.045 * scale, artworkY(.88)], [-.075 * scale, artworkY(.96)], [.075 * scale, artworkY(.96)], [.045 * scale, artworkY(.88)]);
    addLine([0, artworkY(.23)], [0, artworkY(.95)]);
    addLine([-.13 * scale, artworkY(.29)], [.13 * scale, artworkY(.29)]);
    addLine([-.11 * scale, artworkY(.36)], [.11 * scale, artworkY(.36)]);
  } else if (object.subject === 'h') {
    addLine([-.22 * scale, artworkY(.16)], [-.12 * scale, artworkY(.16)], [-.12 * scale, artworkY(.84)], [-.22 * scale, artworkY(.84)], [-.22 * scale, artworkY(.16)]);
    addLine([.12 * scale, artworkY(.16)], [.22 * scale, artworkY(.16)], [.22 * scale, artworkY(.84)], [.12 * scale, artworkY(.84)], [.12 * scale, artworkY(.16)]);
    addLine([-.12 * scale, artworkY(.47)], [.12 * scale, artworkY(.47)]);
  } else if (object.subject === 'snake') {
    addLine([-.28 * scale, artworkY(.22)], [-.18 * scale, artworkY(.38)], [-.04 * scale, artworkY(.28)], [.1 * scale, artworkY(.42)], [.23 * scale, artworkY(.34)], [.18 * scale, artworkY(.55)], [.04 * scale, artworkY(.63)], [-.1 * scale, artworkY(.55)], [-.24 * scale, artworkY(.69)], [-.12 * scale, artworkY(.78)], [.04 * scale, artworkY(.73)], [.22 * scale, artworkY(.82)]);
    addLine([.22 * scale, artworkY(.82)], [.27 * scale, artworkY(.85)], [.25 * scale, artworkY(.77)], [.22 * scale, artworkY(.82)]);
    addLine([.25 * scale, artworkY(.83)], [.27 * scale, artworkY(.83)]);
  } else if (object.subject === 'apple') {
    addLine([0, artworkY(.22)], [-.09 * scale, artworkY(.29)], [-.21 * scale, artworkY(.28)], [-.3 * scale, artworkY(.4)], [-.28 * scale, artworkY(.65)], [-.15 * scale, artworkY(.79)], [0, artworkY(.74)], [.15 * scale, artworkY(.79)], [.28 * scale, artworkY(.65)], [.3 * scale, artworkY(.4)], [.21 * scale, artworkY(.28)], [.09 * scale, artworkY(.29)], [0, artworkY(.22)]);
    addLine([0, artworkY(.74)], [.015 * scale, artworkY(.9)], [.05 * scale, artworkY(.96)]);
    addLine([.025 * scale, artworkY(.84)], [.19 * scale, artworkY(.92)], [.09 * scale, artworkY(.78)], [.025 * scale, artworkY(.84)]);
  } else if (object.subject === 'telephone') {
    addLine([-.28 * scale, artworkY(.2)], [.28 * scale, artworkY(.2)], [.24 * scale, artworkY(.46)], [-.24 * scale, artworkY(.46)], [-.28 * scale, artworkY(.2)]);
    addLine([-.28 * scale, artworkY(.2)], [-.24 * scale, artworkY(.46)]);
    addLine([.28 * scale, artworkY(.2)], [.24 * scale, artworkY(.46)]);
    addLine([-.21 * scale, artworkY(.56)], [-.18 * scale, artworkY(.72)], [-.1 * scale, artworkY(.78)], [.1 * scale, artworkY(.78)], [.18 * scale, artworkY(.72)], [.21 * scale, artworkY(.56)]);
    addLine([-.21 * scale, artworkY(.56)], [-.26 * scale, artworkY(.66)], [-.29 * scale, artworkY(.82)]);
    addLine([.21 * scale, artworkY(.56)], [.26 * scale, artworkY(.66)], [.29 * scale, artworkY(.82)]);
    addLine([-.1 * scale, artworkY(.25)], [.1 * scale, artworkY(.25)], [.1 * scale, artworkY(.4)], [-.1 * scale, artworkY(.4)], [-.1 * scale, artworkY(.25)]);
    for (const [u, v] of [[-.06,.29],[0,.29],[.06,.29],[-.06,.36],[0,.36],[.06,.36]]) {
      addLine([u * scale, artworkY(v)], [(u + .018) * scale, artworkY(v + .015)], [(u - .018) * scale, artworkY(v + .015)], [u * scale, artworkY(v)]);
    }
  } else if (object.subject === 'glasses') {
    addLine([-.3 * scale, artworkY(.42)], [-.29 * scale, artworkY(.65)], [-.04 * scale, artworkY(.65)], [-.03 * scale, artworkY(.42)], [-.3 * scale, artworkY(.42)]);
    addLine([.03 * scale, artworkY(.42)], [.04 * scale, artworkY(.65)], [.29 * scale, artworkY(.65)], [.3 * scale, artworkY(.42)], [.03 * scale, artworkY(.42)]);
    addLine([-.03 * scale, artworkY(.58)], [0, artworkY(.54)], [.03 * scale, artworkY(.58)]);
    addLine([-.3 * scale, artworkY(.62)], [-.37 * scale, artworkY(.67)]);
    addLine([.3 * scale, artworkY(.62)], [.37 * scale, artworkY(.67)]);
  } else if (object.subject === 'penny') {
    addLine(...Array.from({ length: 17 }, (_, index) => {
      const angle = index / 16 * Math.PI * 2;
      return [.23 * scale * Math.cos(angle), artworkY(.52 + .38 * Math.sin(angle))];
    }));
    addLine(...Array.from({ length: 17 }, (_, index) => {
      const angle = index / 16 * Math.PI * 2;
      return [.18 * scale * Math.cos(angle), artworkY(.52 + .3 * Math.sin(angle))];
    }));
    addLine([-.035 * scale, artworkY(.3)], [.025 * scale, artworkY(.35)], [.025 * scale, artworkY(.68)], [.095 * scale, artworkY(.68)]);
  } else if (object.subject === 'fish') {
    addLine([-.26 * scale, artworkY(.52)], [-.16 * scale, artworkY(.68)], [.02 * scale, artworkY(.76)], [.2 * scale, artworkY(.66)], [.27 * scale, artworkY(.52)], [.2 * scale, artworkY(.38)], [.02 * scale, artworkY(.28)], [-.16 * scale, artworkY(.36)], [-.26 * scale, artworkY(.52)]);
    addLine([-.25 * scale, artworkY(.52)], [-.37 * scale, artworkY(.7)], [-.35 * scale, artworkY(.52)], [-.37 * scale, artworkY(.34)], [-.25 * scale, artworkY(.52)]);
    addLine([-.02 * scale, artworkY(.72)], [.06 * scale, artworkY(.88)], [.14 * scale, artworkY(.7)]);
    addLine([-.02 * scale, artworkY(.31)], [.06 * scale, artworkY(.15)], [.14 * scale, artworkY(.33)]);
    addLine([.2 * scale, artworkY(.56)], [.08 * scale, artworkY(.52)], [.19 * scale, artworkY(.48)]);
    addLine([.19 * scale, artworkY(.61)], [.21 * scale, artworkY(.61)]);
  } else if (object.subject === 'plant') {
    addLine([-.14 * scale, artworkY(.18)], [.14 * scale, artworkY(.18)], [.18 * scale, artworkY(.38)], [-.18 * scale, artworkY(.38)], [-.14 * scale, artworkY(.18)]);
    addLine([0, artworkY(.38)], [0, artworkY(.62)]);
    addLine([0, artworkY(.58)], [-.06 * scale, artworkY(.74)], [0, artworkY(.94)], [.06 * scale, artworkY(.74)], [0, artworkY(.58)]);
    addLine([-.02 * scale, artworkY(.5)], [-.2 * scale, artworkY(.56)], [-.26 * scale, artworkY(.76)], [-.1 * scale, artworkY(.68)], [-.02 * scale, artworkY(.5)]);
    addLine([.02 * scale, artworkY(.5)], [.2 * scale, artworkY(.56)], [.26 * scale, artworkY(.76)], [.1 * scale, artworkY(.68)], [.02 * scale, artworkY(.5)]);
  } else {
    throw new Error(`Unsupported wall picture subject: ${object.subject}`);
  }
  return {
    type: 'picture', subject: object.subject, lines, side: object.side, x, y, w: object.w, h: object.h,
    building: building.name, room: Number(building.grid[object.row][object.col])
  };
}