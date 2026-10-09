import { createWorld } from './world.js?v=20261026';

const colors = ['#12302a', '#18302b', '#19352e', '#142a27', '#1a3029', '#172d2a', '#16342e'];
const baySize = 100;
const mapUnitsPerBay = 7;
const unit = baySize / mapUnitsPerBay;
const svgNS = 'http://www.w3.org/2000/svg';
const container = document.querySelector('#buildings');
const status = document.querySelector('#status');

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function palette(roomId) {
  const number = Number(roomId) || 0;
  return colors[number % colors.length];
}

function roomCenter(roomId, grid) {
  const cells = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) if (grid[row][col] === roomId) cells.push({ col, row });
  }
  return {
    x: cells.reduce((sum, cell) => sum + (cell.col + .5) * baySize, 0) / cells.length,
    y: cells.reduce((sum, cell) => sum + (cell.row + .5) * baySize, 0) / cells.length
  };
}

function addWall(svg, x1, y1, x2, y2, doorway = null, isExit = false) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const gapStart = doorway ? doorway.offset * unit : -1;
  const gapEnd = doorway ? gapStart + (doorway.width ?? 1) * unit : -1;
  const addSegment = (start, end, color = '#7edcc7', width = 3) => {
    if (end <= start) return;
    svg.append(svgElement('line', {
      x1: x1 + ux * start, y1: y1 + uy * start,
      x2: x1 + ux * end, y2: y1 + uy * end,
      stroke: color, 'stroke-width': width, 'stroke-linecap': 'square'
    }));
  };
  if (!doorway) {
    addSegment(0, length);
    return;
  }
  addSegment(0, gapStart);
  addSegment(gapEnd, length);
  const marker = isExit ? '#72ffd080' : '#72ffd0';
  svg.append(svgElement('line', {
    x1: x1 + ux * gapStart, y1: y1 + uy * gapStart,
    x2: x1 + ux * gapEnd, y2: y1 + uy * gapEnd,
    stroke: marker, 'stroke-width': 4, 'stroke-linecap': 'butt'
  }));
}

function drawObject(svg, object, plan) {
  if (object.type === 'picture') {
    const width = object.w / mapUnitsPerBay * baySize;
    const offset = object.offset / mapUnitsPerBay * baySize;
    let x1, y1, x2, y2;
    if (object.side === 'north' || object.side === 'south') {
      const y = (object.row + (object.side === 'north' ? 0 : 1)) * baySize;
      x1 = object.col * baySize + offset - width / 2;
      x2 = x1 + width;
      y1 = y2 = y;
    } else {
      const x = (object.col + (object.side === 'west' ? 0 : 1)) * baySize;
      y1 = object.row * baySize + offset - width / 2;
      y2 = y1 + width;
      x1 = x2 = x;
    }
    svg.append(svgElement('line', { x1, y1, x2, y2, stroke: '#ffd166', 'stroke-width': 5, 'stroke-linecap': 'square' }));
    return;
  }
  const x = (object.col + object.x / mapUnitsPerBay) * baySize;
  const y = (object.row + object.y / mapUnitsPerBay) * baySize;
  if (object.type === 'box' || object.type === 'table') {
    const w = object.w / mapUnitsPerBay * baySize;
    const h = object.d / mapUnitsPerBay * baySize;
    svg.append(svgElement('rect', { x: x - w/2, y: y - h/2, width: w, height: h, fill: 'none', stroke: '#72ffd0', 'stroke-width': 2 }));
  } else {
    const r = 4.2;
    svg.append(svgElement('circle', { cx: x, cy: y, r, fill: '#72ffd0' }));
    svg.append(svgElement('path', { d: `M ${x-r*1.3} ${y-r*.2} l ${-r*.6} ${-r} l ${r*1.2} ${r*.5} M ${x+r*1.3} ${y-r*.2} l ${r*.6} ${-r} l ${-r*1.2} ${r*.5}`, fill: 'none', stroke: '#72ffd0', 'stroke-width': 1.5 }));
  }
}

function doorOnBayEdge(plan, orientation, line, segmentStart) {
  const door = plan.doors.find(item => item.orientation === orientation && item.line === line && item.start + item.offset >= segmentStart && item.start + item.offset < segmentStart + mapUnitsPerBay);
  return door ? { offset: door.start + door.offset - segmentStart, width: door.width ?? 1 } : null;
}

function drawBuilding(plan) {
  const margin = 8;
  const svg = svgElement('svg', {
    class: 'plan', role: 'img', 'aria-label': `Building ${plan.name} room and door plan`,
    viewBox: `0 0 ${plan.cols * baySize + margin * 2} ${plan.rows * baySize + margin * 2}`
  });
  const group = svgElement('g', { transform: `translate(${margin} ${margin})` });
  svg.append(group);
  for (let row = 0; row < plan.rows; row++) {
    for (let col = 0; col < plan.cols; col++) {
      group.append(svgElement('rect', {
        x: col * baySize, y: row * baySize, width: baySize, height: baySize,
        fill: palette(plan.grid[row][col])
      }));
    }
  }
  for (let row = 0; row < plan.rows; row++) {
    for (let col = 0; col < plan.cols; col++) {
      const room = plan.grid[row][col];
      if (col + 1 < plan.cols && room !== plan.grid[row][col + 1]) {
        const door = doorOnBayEdge(plan, 'vertical', (col + 1) * mapUnitsPerBay, row * mapUnitsPerBay);
        addWall(group, (col + 1) * baySize, row * baySize, (col + 1) * baySize, (row + 1) * baySize, door);
      }
      if (row + 1 < plan.rows && room !== plan.grid[row + 1][col]) {
        const door = doorOnBayEdge(plan, 'horizontal', (row + 1) * mapUnitsPerBay, col * mapUnitsPerBay);
        addWall(group, col * baySize, (row + 1) * baySize, (col + 1) * baySize, (row + 1) * baySize, door);
      }
      if (col === 0) {
        const door = plan.exits.find(item => item.side === 'west' && item.bay === row);
        addWall(group, col * baySize, row * baySize, col * baySize, (row + 1) * baySize, door ? { offset: door.offset } : null, true);
      }
      if (col === plan.cols - 1) {
        const door = plan.exits.find(item => item.side === 'east' && item.bay === row);
        addWall(group, (col + 1) * baySize, row * baySize, (col + 1) * baySize, (row + 1) * baySize, door ? { offset: door.offset } : null, true);
      }
      if (row === 0) {
        const door = plan.exits.find(item => item.side === 'north' && item.bay === col);
        addWall(group, col * baySize, row * baySize, (col + 1) * baySize, row * baySize, door ? { offset: door.offset } : null, true);
      }
      if (row === plan.rows - 1) {
        const door = plan.exits.find(item => item.side === 'south' && item.bay === col);
        addWall(group, col * baySize, (row + 1) * baySize, (col + 1) * baySize, (row + 1) * baySize, door ? { offset: door.offset } : null, true);
      }
    }
  }
  for (const gate of plan.magicDoors) {
    const x = gate.side === 'west' ? 0 : gate.side === 'east' ? plan.cols * baySize : (gate.bay * mapUnitsPerBay + gate.offset) / mapUnitsPerBay * baySize + baySize / mapUnitsPerBay / 2;
    const y = gate.side === 'north' ? 0 : gate.side === 'south' ? plan.rows * baySize : (gate.bay * mapUnitsPerBay + gate.offset) / mapUnitsPerBay * baySize + baySize / mapUnitsPerBay / 2;
    const horizontal = gate.side === 'north' || gate.side === 'south';
    group.append(svgElement('line', {
      x1: horizontal ? x - baySize / mapUnitsPerBay / 2 : x,
      y1: horizontal ? y : y - baySize / mapUnitsPerBay / 2,
      x2: horizontal ? x + baySize / mapUnitsPerBay / 2 : x,
      y2: horizontal ? y : y + baySize / mapUnitsPerBay / 2,
      stroke: '#e070ff', 'stroke-width': 6, 'stroke-linecap': 'square'
    }));
  }
  for (const roomId of [...new Set(plan.grid.flat())]) {
    const center = roomCenter(roomId, plan.grid);
    const label = svgElement('text', {
      x: center.x, y: center.y + 5, fill: '#d8f2ed', 'font-size': 18,
      'font-family': 'ui-monospace, monospace', 'text-anchor': 'middle'
    });
    label.textContent = roomId;
    group.append(label);
  }
  for (const object of plan.objects) drawObject(group, object, plan);
  return svg;
}

try {
  const world = await createWorld();
  status.textContent = 'Rooms repeat across bays with the same ID. Green marks are doors.';
  for (const plan of world.buildingPlans) {
    const card = document.createElement('article');
    card.className = 'building-card';
    const heading = document.createElement('div');
    heading.className = 'card-heading';
    const title = document.createElement('h2');
    title.textContent = `Building ${plan.name}`;
    const detail = document.createElement('span');
    detail.textContent = `${plan.roomCount} rooms · ${plan.cols} × ${plan.rows} bays`;
    heading.append(title, detail);
    card.append(heading, drawBuilding(plan));
    container.append(card);
  }
} catch (error) {
  status.textContent = `Could not load the map: ${error.message}`;
  console.error(error);
}
