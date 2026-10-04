import { CELL_FT } from './world.js';

export function createPlayer(start) {
  return { ...start };
}

export function attachPlayerControls(player, canvas) {
  const keysDown = new Set();
  const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
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

  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  addEventListener('keydown', onEscape);
  canvas.addEventListener('click', () => canvas.requestPointerLock?.());

  return {
    update(dt, world) {
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
    }
  };
}
