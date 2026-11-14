import { CELL_FT } from './world.js?v=20261117';
import { OBJECT_METADATA } from './object-types.js?v=20261108';
import { hasClearFootprint } from './placement.js?v=20261038';
import { createRobber, stashTicket, stealInventoryObjects, updateRobber } from './robber.js?v=20261114';

let soundContext;
let robberDrone;

function updateRobberProximitySound(distanceMeters) {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    soundContext ??= new AudioContextClass();
  } catch {
    return;
  }

  const start = soundContext.currentTime;
  const intensity = Math.max(0, Math.min(1, (5 - distanceMeters) / 5));
  if (!intensity) {
    if (robberDrone) {
      robberDrone.gain.gain.setTargetAtTime(.0001, start, .18);
    }
    return;
  }
  if (soundContext.state === 'suspended') soundContext.resume().catch(() => {});
  if (!robberDrone) {
    const low = soundContext.createOscillator();
    const high = soundContext.createOscillator();
    const gain = soundContext.createGain();
    const filter = soundContext.createBiquadFilter();
    low.type = 'sawtooth';
    high.type = 'triangle';
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    low.frequency.value = 42;
    high.frequency.value = 56;
    gain.gain.value = .0001;
    low.connect(filter);
    high.connect(filter);
    filter.connect(gain);
    gain.connect(soundContext.destination);
    low.start();
    high.start();
    robberDrone = { low, high, gain, filter };
  }
  const { low, high, gain, filter } = robberDrone;
  low.frequency.setTargetAtTime(38 + intensity * 22, start, .25);
  high.frequency.setTargetAtTime(53 + intensity * 39, start, .25);
  filter.frequency.setTargetAtTime(260 + intensity * 1100, start, .3);
  gain.gain.setTargetAtTime(.004 + intensity * .0225, start, .3);
}

function playActionSound(kind) {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    soundContext ??= new AudioContextClass();
  } catch {
    return;
  }
  if (soundContext.state === 'suspended') soundContext.resume().catch(() => {});

  const start = soundContext.currentTime;
  if (kind === 'pickup') {
    const oscillator = soundContext.createOscillator();
    const gain = soundContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(360, start);
    oscillator.frequency.exponentialRampToValueAtTime(620, start + .11);
    oscillator.frequency.exponentialRampToValueAtTime(470, start + .19);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.12, start + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, start + .21);
    oscillator.connect(gain);
    gain.connect(soundContext.destination);
    oscillator.start(start);
    oscillator.stop(start + .22);
    return;
  }

  if (kind === 'robbed') {
    for (const [frequency, endFrequency] of [[260, 175], [370, 245]]) {
      const oscillator = soundContext.createOscillator();
      const gain = soundContext.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + .32);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.055, start + .015);
      gain.gain.setValueAtTime(.045, start + .16);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .34);
      oscillator.connect(gain);
      gain.connect(soundContext.destination);
      oscillator.start(start);
      oscillator.stop(start + .35);
    }
    return;
  }

  for (const [index, frequency] of [523.25, 659.25, 783.99, 1046.5].entries()) {
    const noteStart = start + index * .075;
    const oscillator = soundContext.createOscillator();
    const gain = soundContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(index === 3 ? .11 : .085, noteStart + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, noteStart + .34);
    oscillator.connect(gain);
    gain.connect(soundContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + .35);
  }
}

export function createPlayer(start) {
  return { ...start, credits: 0, creditFlashId: 0, inventoryFlashId: 0, inventory: Array(10).fill(null), selectedInventorySlot: 0 };
}

export function attachPlayerControls(player, canvas, world) {
  world.robber = createRobber(world);
  const keysDown = new Set();
  const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  const touchMove = { x: 0, y: 0 };
  let touchTurn = 0;
  let walkTarget = null;
  const VIEW_FOV = Math.PI / 3; // must match renderer FOV
  const TAP_WALK_CELLS_PER_WIDTH = 16;
  const ROCKET_INTERACTION_RANGE = 2.2;
  function hasTicket() {
    return player.inventory.some(object => object?.type === 'ticket');
  }

  function purchaseTicket() {
    if (!world.ticketSeller || Math.hypot(player.x - world.ticketSeller.x, player.y - world.ticketSeller.y) >= 2.2) return false;
    const ticketCost = world.ticketSeller.price;
    if (hasTicket()) {
      setMessage('You already have a flight ticket');
      return true;
    }
    if (player.credits < ticketCost) {
      setMessage(`Ticket ${ticketCost} credits · you have ${player.credits}`);
      return true;
    }
    const slot = player.inventory.indexOf(null);
    if (slot < 0) {
      setMessage('Inventory full · make room for the flight ticket');
      return true;
    }
    player.credits -= ticketCost;
    player.creditFlashId += 1;
    player.inventory[slot] = { type: 'ticket', value: 0, held: true };
    player.selectedInventorySlot = slot;
    player.inventoryFlashId += 1;
    setMessage('Flight ticket purchased · keep it safe');
    return true;
  }

  function setMessage(message) {
    player.actionMessage = message;
    player.actionMessageTimer = 2;
  }

  function objectName(object) {
    return OBJECT_METADATA[object.type]?.name ?? object.type;
  }

  function boardRocket() {
    if (!world.rocket || Math.hypot(player.x - world.rocket.entranceX, player.y - world.rocket.entranceY) >= ROCKET_INTERACTION_RANGE) return false;
    keysDown.clear();
    walkTarget = null;
    player.launching = { elapsed: 0, cameraX: player.x, cameraY: player.y, cameraAngle: player.a };
    player.actionMessageTimer = 0;
    return true;
  }

  function objectRadius(object) {
    return object.type === 'box' || object.type === 'table'
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
      const x = player.x + dx * amount;
      const y = player.y + dy * amount;
      if (world.isWall(Math.floor(x), Math.floor(y)) || !world.canMove(player.x + dx * (step - 1) / steps, player.y + dy * (step - 1) / steps, x, y)) return false;
    }
    return true;
  }

  function pickUpObject() {
    if (player.launching || player.gameComplete || purchaseTicket() || boardRocket()) return;
    const slot = player.inventory.indexOf(null);
    if (slot < 0) {
      setMessage('Inventory full · 10 of 10 objects');
      return;
    }
    let object = null;
    let nearestDistance = 1.6;
    for (const candidate of world.pickups) {
      if (candidate.held) continue;
      const dx = candidate.x - player.x;
      const dy = candidate.y - player.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > nearestDistance * nearestDistance) continue;
      const distance = Math.sqrt(distanceSquared);
      if (hasLineOfSight(candidate)) {
        object = candidate;
        nearestDistance = distance;
      }
    }
    if (!object) {
      setMessage('No object close enough to pick up');
      return;
    }
    let pickupMessage = `Picked up ${objectName(object)} · slot ${slot === 9 ? 0 : slot + 1}`;
    if (object.paired) {
      const picture = object.pairedPicture;
      player.credits -= object.value;
      player.creditFlashId += 1;
      object.paired = false;
      object.pairedPicture = null;
      object.flashUntil = performance.now() + 700;
      if (picture) {
        picture.paired = world.pickups.some(candidate => candidate !== object && candidate.pairedPicture === picture);
        picture.flashUntil = object.flashUntil;
      }
      pickupMessage = `Picked up ${objectName(object)} · −${object.value} credits · balance ${player.credits}`;
    }
    object.held = true;
    player.inventory[slot] = object;
    player.selectedInventorySlot = slot;
    playActionSound('pickup');
    setMessage(pickupMessage);
  }

  function canDropAt(object, x, y) {
    if (!hasClearFootprint(world, object, x, y)) return false;
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
    if (object.type === 'ticket') {
      setMessage('Keep the flight ticket in your inventory');
      return;
    }
    const distances = [1.25, 1, .75, 1.5, 1.75, 2, 2.25, 2.5];
    const matchingPicture = OBJECT_METADATA[object.type]?.pictureSubject;
    for (const distance of distances) {
      const x = player.x + Math.cos(player.a) * distance;
      const y = player.y + Math.sin(player.a) * distance;
      if (!canDropAt(object, x, y)) continue;
      const room = world.getRoomAt(x, y);
      const salePicture = room && world.pictures.find(picture =>
        picture.building === room.building && picture.room === room.room && picture.subject === matchingPicture
      );
      if (salePicture) {
        world.moveObject(object, x, y);
        object.held = false;
        object.paired = true;
        object.pairedPicture = salePicture;
        object.flashUntil = performance.now() + 1100;
        salePicture.paired = true;
        salePicture.flashUntil = object.flashUntil;
        player.credits += object.value;
        player.creditFlashId += 1;
        player.inventory[slot] = null;
        const nextSlot = player.inventory.findIndex(item => item !== null);
        if (nextSlot >= 0) player.selectedInventorySlot = nextSlot;
        playActionSound('reward');
        setMessage(`Paired ${objectName(object)} · +${object.value} credits · balance ${player.credits}`);
        return;
      }
      world.moveObject(object, x, y);
      object.held = false;
      player.inventory[slot] = null;
      const nextSlot = player.inventory.findIndex(item => item !== null);
      if (nextSlot >= 0) player.selectedInventorySlot = nextSlot;
      setMessage(`Dropped ${objectName(object)}`);
      return;
    }
    setMessage('No clear space to drop the object here');
  }

  function teleportAtMagicDoor() {
    const playerBuilding = world.getRoomAt(player.x, player.y)?.building;
    const portal = world.magicDoors.find(door => door.building === playerBuilding && Math.hypot(player.x - door.x, player.y - door.y) < .62);
    if (!portal) return;
    const destination = portal.target;
    if (portal.requiredItem && !player.inventory.some(object => object?.type === portal.requiredItem)) {
      const awayX = player.x - portal.x;
      const awayY = player.y - portal.y;
      const away = Math.hypot(awayX, awayY) || 1;
      player.x = portal.x + awayX / away * .7;
      player.y = portal.y + awayY / away * .7;
      setMessage(`A flight ticket is required · Price is ${world.ticketSeller.price} credits`);
      return;
    }
    let tollMessage = '';
    if (portal.toll && !portal.toll.paid) {
      const { amount } = portal.toll;
      if (player.credits < amount) {
        // Push the player back out of the trigger zone so they cannot slip through the doorway.
        const awayX = player.x - portal.x;
        const awayY = player.y - portal.y;
        const away = Math.hypot(awayX, awayY) || 1;
        player.x = portal.x + awayX / away * .7;
        player.y = portal.y + awayY / away * .7;
        setMessage(`This magic door needs a toll of ${amount} credits · you have ${player.credits}`);
        return;
      }
      player.credits -= amount;
      player.creditFlashId += 1;
      portal.toll.paid = true;
      tollMessage = `Toll paid · −${amount} credits · balance ${player.credits} · `;
    }
    player.x = destination.landingX;
    player.y = destination.landingY;
    player.a = destination.arrivalAngle;
    player.teleportFlash = .35;
    setMessage(`${tollMessage}Magic door · Building ${destination.building} Room ${destination.roomId}`);
  }

  function selectSlot(slot) {
    player.selectedInventorySlot = slot;
    const object = player.inventory[slot];
    setMessage(object ? `Selected ${objectName(object)} · G to drop` : `Inventory slot ${slot === 9 ? 0 : slot + 1} is empty`);
  }

  function onKeyDown(event) {
    const key = (event.key ?? '').toLowerCase();
    if (player.launching || player.gameComplete) {
      event.preventDefault();
      return;
    }
    if (!event.repeat && (key === 'e' || event.code === 'KeyE')) {
      event.preventDefault();
      if (purchaseTicket()) return;
      if (boardRocket()) return;
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
      selectSlot(slot);
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
  document.addEventListener('keydown', onKeyDown, true);
  addEventListener('keyup', onKeyUp);

  return {
    update(dt, world) {
      if (player.gameComplete) return;
      if (player.launching) {
        player.launching.elapsed += dt;
        if (player.launching.elapsed >= 12.75) player.gameComplete = true;
        return;
      }
      player.actionMessageTimer = Math.max(0, (player.actionMessageTimer ?? 0) - dt);
      player.teleportFlash = Math.max(0, (player.teleportFlash ?? 0) - dt);
      player.rocketNearby = Boolean(world.rocket && Math.hypot(player.x - world.rocket.entranceX, player.y - world.rocket.entranceY) < ROCKET_INTERACTION_RANGE);
      player.ticketSellerNearby = Boolean(world.ticketSeller && Math.hypot(player.x - world.ticketSeller.x, player.y - world.ticketSeller.y) < 2.2);
      const turn = (keysDown.has('arrowright') ? 1 : 0) - (keysDown.has('arrowleft') ? 1 : 0);
      player.a += (turn + touchTurn) * dt * 2.1;
      let forward = (keysDown.has('w') || keysDown.has('arrowup') ? 1 : 0) - (keysDown.has('s') || keysDown.has('arrowdown') ? 1 : 0) + touchMove.y;
      let side = (keysDown.has('d') ? 1 : 0) - (keysDown.has('a') ? 1 : 0) + touchMove.x;
      const magnitude = Math.max(1, Math.hypot(forward, side));
      forward /= magnitude;
      side /= magnitude;
      const speed = dt * (4.43 / CELL_FT);
      let dx = (Math.cos(player.a) * forward - Math.sin(player.a) * side) * speed;
      let dy = (Math.sin(player.a) * forward + Math.cos(player.a) * side) * speed;
      if (walkTarget) {
        const toX = walkTarget.x - player.x;
        const toY = walkTarget.y - player.y;
        const remaining = Math.hypot(toX, toY);
        if (remaining < .08 || forward || side) {
          walkTarget = null;
        } else {
          const step = Math.min(speed, remaining);
          dx = toX / remaining * step;
          dy = toY / remaining * step;
        }
      }
      const radius = .19;
      const beforeX = player.x;
      const beforeY = player.y;
      if (!world.isWall(Math.floor(player.x + dx + Math.sign(dx) * radius), Math.floor(player.y)) && world.canMove(player.x, player.y, player.x + dx, player.y, radius)) player.x += dx;
      if (!world.isWall(Math.floor(player.x), Math.floor(player.y + dy + Math.sign(dy) * radius)) && world.canMove(player.x, player.y, player.x, player.y + dy, radius)) player.y += dy;
      if (walkTarget && Math.hypot(player.x - beforeX, player.y - beforeY) < speed * .25) walkTarget = null;
      teleportAtMagicDoor();
      updateRobber(world.robber, world, player, dt, () => {
        const ticketSlot = player.inventory.findIndex(object => object?.type === 'ticket');
        if (ticketSlot >= 0) {
          const ticket = player.inventory[ticketSlot];
          if (!stashTicket(world, ticket)) return false;
          player.inventory[ticketSlot] = null;
          player.selectedInventorySlot = player.inventory.findIndex(Boolean);
          if (player.selectedInventorySlot < 0) player.selectedInventorySlot = 0;
          player.inventoryFlashId += 1;
          playActionSound('robbed');
          setMessage('The robber stole your flight ticket and hid it somewhere in Buildings A–D');
          return true;
        }
        const stolenCount = stealInventoryObjects(world, player);
        if (!stolenCount) {
          player.gameComplete = true;
          player.gameOutcome = 'robbed';
          playActionSound('robbed');
          return false;
        }
        player.inventoryFlashId += 1;
        playActionSound('robbed');
        const itemWord = stolenCount === 1 ? 'item' : 'items';
        setMessage(`The robber stole all ${stolenCount} ${itemWord} and scattered them through Buildings A–D`);
        return stolenCount;
      });
      const robberDistanceMeters = Math.hypot(player.x - world.robber.x, player.y - world.robber.y) * (10 / 7) * 0.3048;
      updateRobberProximitySound(robberDistanceMeters);
    },
    walkToScreenPoint(offsetX, offsetY) {
      // Offsets are from the tap split line (a quarter up from the bottom), in canvas widths. Above it walks forward, below walks back, in proportion to the offset.
      const focal = 1 / (2 * Math.tan(VIEW_FOV / 2));
      const bearing = player.a + Math.atan(offsetX / focal);
      const direction = offsetY < 0 ? 1 : -1;
      const dirX = Math.cos(bearing) * direction;
      const dirY = Math.sin(bearing) * direction;
      const distance = Math.abs(offsetY) * TAP_WALK_CELLS_PER_WIDTH;
      let reach = 0;
      while (reach < distance) {
        const nextX = player.x + dirX * (reach + .05);
        const nextY = player.y + dirY * (reach + .05);
        if (world.isWall(Math.floor(nextX), Math.floor(nextY)) || !world.canMove(player.x + dirX * reach, player.y + dirY * reach, nextX, nextY, .19)) break;
        reach += .05;
      }
      reach = Math.min(reach, distance);
      if (reach < distance) reach -= .3;
      walkTarget = reach > .15 ? { x: player.x + dirX * reach, y: player.y + dirY * reach } : null;
    },
    pickUpObject,
    dropObject,
    selectSlot,
    setTouchMove(x, y) {
      touchMove.x = x;
      touchMove.y = y;
    },
    setTouchTurn(direction) {
      touchTurn = direction;
    }
  };
}
