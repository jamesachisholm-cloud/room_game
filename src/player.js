import { CELL_FT } from './world.js?v=20261023';

export function createPlayer(start) {
  return { ...start, inventory: Array(10).fill(null), selectedInventorySlot: 0 };
}

export function attachPlayerControls(player, canvas, world) {
  const keysDown = new Set();
  const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

  function setMessage(message) {
    player.actionMessage = message;
    player.actionMessageTimer = 2;
  }

  function objectRadius(object) {
    return object.type === 'box'
      ? Math.hypot(object.w, object.d) / 2
      : object.scale * 1.3;
  }

  function hasLineOfSight(object) {
    const dx = object.x - player.x;
    const dy = object.y - player.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.ceil(distance / .1);
    for (let step = 1; step < steps; step++) {
      const amount = step / steps;
      if (world.isWall(Math.floor(player.x + dx * amount), Math.floor(player.y + dy * amount))) return false;
    }
    return true;
  }

  function pickUpObject() {
    const slot = player.inventory.indexOf(null);
    if (slot < 0) {
      setMessage('Inventory full · 10 of 10 objects');
      return;
    }
    const object = world.pickups
      .filter(candidate => !candidate.held)
      .map(candidate => ({ candidate, distance: Math.hypot(candidate.x - player.x, candidate.y - player.y) }))
      .filter(item => item.distance <= 1.6 && hasLineOfSight(item.candidate))
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
    if (!object) {
      setMessage('No object close enough to pick up');
      return;
    }
    object.held = true;
    player.inventory[slot] = object;
    player.selectedInventorySlot = slot;
    setMessage(`Picked up ${object.type} · slot ${slot === 9 ? 0 : slot + 1}`);
  }

  function canDropAt(object, x, y) {
    const halfX = object.type === 'box' ? object.w / 2 : object.scale * 1.3;
    const halfY = object.type === 'box' ? object.d / 2 : object.scale * .45;
    const samples = [[x, y], [x - halfX, y], [x + halfX, y], [x, y - halfY], [x, y + halfY]];
    if (samples.some(([px, py]) => world.isWall(Math.floor(px), Math.floor(py)))) return false;
    return world.pickups.every(other => other === object || other.held ||
      Math.hypot(x - other.x, y - other.y) >= objectRadius(object) + objectRadius(other));
  }

  function dropObject() {
    const slot = player.selectedInventorySlot;
    const object = player.inventory[slot];
    if (!object) {
      setMessage(`Inventory slot ${slot === 9 ? 0 : slot + 1} is empty`);
      return;
    }
    const distances = [1.25, 1, .75, 1.5, 1.75, 2, 2.25, 2.5];
    for (const distance of distances) {
      const x = player.x + Math.cos(player.a) * distance;
      const y = player.y + Math.sin(player.a) * distance;
      if (!canDropAt(object, x, y)) continue;
      world.moveObject(object, x, y);
      object.held = false;
      player.inventory[slot] = null;
      const nextSlot = player.inventory.findIndex(item => item !== null);
      if (nextSlot >= 0) player.selectedInventorySlot = nextSlot;
      setMessage(`Dropped ${object.type}`);
      return;
    }
    setMessage('No clear space to drop the object here');
  }

  function teleportAtMagicDoor() {
    const portal = world.magicDoors.find(door => Math.hypot(player.x - door.x, player.y - door.y) < .62);
    if (!portal) return;
    const destination = portal.target;
    player.x = destination.landingX;
    player.y = destination.landingY;
    player.a = destination.arrivalAngle;
    player.teleportFlash = .35;
    setMessage(`Magic door · Building ${destination.building} Room ${destination.roomId}`);
  }

  function onKeyDown(event) {
    const key = (event.key ?? '').toLowerCase();
    if (!event.repeat && (key === 'e' || event.code === 'KeyE')) {
      event.preventDefault();
      pickUpObject();
      return;
    }
    if (!event.repeat && (key === 'g' || event.code === 'KeyG')) {
      event.preventDefault();
      dropObject();
      return;
    }
    const digit = /^Digit([0-9])$/.exec(event.code ?? '')?.[1] ?? (/^[0-9]$/.test(key) ? key : null);
    if (!event.repeat && digit !== null) {
      event.preventDefault();
      const slot = digit === '0' ? 9 : Number(digit) - 1;
      player.selectedInventorySlot = slot;
      const object = player.inventory[slot];
      setMessage(object ? `Selected ${object.type} · G to drop` : `Inventory slot ${digit} is empty`);
      return;
    }
    if (movementKeys.includes(key)) {
      event.preventDefault();
      keysDown.add(key);
    }
  }
  function onKeyUp(event) {
    keysDown.delete(event.key.toLowerCase());
  }
  function onMouseMove(event) {
    if (document.pointerLockElement === canvas) player.a += event.movementX * .0025;
  }
  function onEscape(event) {
    if (event.key === 'Escape' && document.pointerLockElement) document.exitPointerLock();
  }

  document.addEventListener('keydown', onKeyDown, true);
  addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  addEventListener('keydown', onEscape);
  canvas.addEventListener('click', () => canvas.requestPointerLock?.());

  return {
    update(dt, world) {
      player.actionMessageTimer = Math.max(0, (player.actionMessageTimer ?? 0) - dt);
      player.teleportFlash = Math.max(0, (player.teleportFlash ?? 0) - dt);
      const turn = (keysDown.has('arrowright') ? 1 : 0) - (keysDown.has('arrowleft') ? 1 : 0);
      player.a += turn * dt * 2.1;
      let forward = (keysDown.has('w') || keysDown.has('arrowup') ? 1 : 0) - (keysDown.has('s') || keysDown.has('arrowdown') ? 1 : 0);
      let side = (keysDown.has('d') ? 1 : 0) - (keysDown.has('a') ? 1 : 0);
      const magnitude = Math.hypot(forward, side) || 1;
      forward /= magnitude;
      side /= magnitude;
      const speed = dt * (4.43 / CELL_FT);
      const dx = (Math.cos(player.a) * forward - Math.sin(player.a) * side) * speed;
      const dy = (Math.sin(player.a) * forward + Math.cos(player.a) * side) * speed;
      const radius = .19;
      if (!world.isWall(Math.floor(player.x + dx + Math.sign(dx) * radius), Math.floor(player.y))) player.x += dx;
      if (!world.isWall(Math.floor(player.x), Math.floor(player.y + dy + Math.sign(dy) * radius))) player.y += dy;
      teleportAtMagicDoor();
    }
  };
}
