import { createWorld } from './world.js';
import { createPlayer, attachPlayerControls } from './player.js';
import { createRenderer } from './renderer.js';
import { setupHud } from './hud.js';

const canvas = document.querySelector('#view');
const world = createWorld();
const player = createPlayer(world.start);
const controls = attachPlayerControls(player, canvas);
const renderer = createRenderer(canvas, world);
const hud = setupHud(canvas);
let previousFrame = 0;

function frame(timestamp) {
  const dt = Math.min(.05, (timestamp - previousFrame) / 1000 || 0);
  previousFrame = timestamp;
  controls.update(dt, world);
  hud.update(world, player);
  renderer.draw(player);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
