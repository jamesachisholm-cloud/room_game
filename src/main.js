window.__roomLinesModuleLoaded = true;

import { createWorld } from './world.js?v=20261038';
import { createPlayer, attachPlayerControls } from './player.js?v=20261038';
import { createRenderer } from './renderer.js?v=20261050';
import { setupHud } from './hud.js?v=20261038';

async function startGame() {
  const canvas = document.querySelector('#view');
  const world = await createWorld();
  const player = createPlayer(world.start);
  const controls = attachPlayerControls(player, canvas, world);
  const renderer = createRenderer(canvas, world);
  const hud = setupHud(canvas);
  let previousFrame = 0;

  function frame(timestamp) {
    try {
      const dt = Math.min(.05, (timestamp - previousFrame) / 1000 || 0);
      previousFrame = timestamp;
      controls.update(dt, world);
      hud.update(world, player);
      renderer.draw(player);
    } catch (error) {
      console.error('Game frame failed:', error);
      document.querySelector('#help').textContent = `Game frame failed: ${error.message}`;
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__roomLinesStarted = true;
}

window.addEventListener('error', event => {
  const source = event.filename ? ` (${event.filename.split('/').pop()}:${event.lineno})` : '';
  document.querySelector('#help').textContent = `Script error${source}: ${event.message || 'could not load game code'}`;
});
window.addEventListener('unhandledrejection', event => {
  const message = event.reason?.message ?? String(event.reason);
  document.querySelector('#help').textContent = `Game startup failed: ${message}`;
});

startGame().catch(error => {
  console.error(error);
  document.querySelector('#help').textContent = `Unable to load map: ${error.message}`;
});
