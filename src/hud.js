export function setupHud(canvas) {
  const intro = document.querySelector('#intro');
  const startButton = document.querySelector('#start');
  const roomLabel = document.querySelector('#room');
  const roomCount = document.querySelector('#room-count');
  const buildingLabel = document.querySelector('#building');
  const outsideLabel = document.querySelector('#outside');
  const help = document.querySelector('#help');

  startButton.addEventListener('click', () => {
    intro.classList.add('hidden');
    canvas.requestPointerLock?.();
  });

  return {
    update(world, player) {
      const room = world.getRoomAt(player.x, player.y);
      if (room) {
        buildingLabel.textContent = room.building;
        roomLabel.textContent = String(room.room).padStart(2, '0');
        roomCount.textContent = String(room.roomCount);
        outsideLabel.textContent = 'INSIDE';
        help.textContent = 'WASD move · mouse look · arrows turn · click to capture mouse';
      } else {
        buildingLabel.textContent = '—';
        roomLabel.textContent = 'OUT';
        roomCount.textContent = '—';
        outsideLabel.textContent = 'OUTSIDE · OPEN GROUNDS';
        help.textContent = 'OUTSIDE · follow the paths around the building ring';
      }
    }
  };
}
