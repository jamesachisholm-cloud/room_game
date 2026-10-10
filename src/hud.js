import { OBJECT_METADATA } from './object-types.js?v=20261038';

const COMPASS_LABELS = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
const COMPASS_PX_PER_DEGREE = 3;

export function setupHud(canvas, controls) {
  const touchMode = matchMedia('(pointer: coarse)').matches;
  const compass = document.querySelector('#compass');
  const compassTape = document.querySelector('#compass-tape');
  // Three copies of the dial let the tape wrap smoothly across north.
  for (let degrees = -360; degrees < 720; degrees += 15) {
    const heading = ((degrees % 360) + 360) % 360;
    const mark = document.createElement('span');
    mark.className = heading % 90 === 0 ? 'compass-mark cardinal' : 'compass-mark';
    mark.style.left = `${(degrees + 360) * COMPASS_PX_PER_DEGREE}px`;
    mark.textContent = COMPASS_LABELS[heading] ?? '';
    compassTape.append(mark);
  }
  const intro = document.querySelector('#intro');
  const startButton = document.querySelector('#start');
  const roomLabel = document.querySelector('#room');
  const roomCount = document.querySelector('#room-count');
  const buildingLabel = document.querySelector('#building');
  const creditsLabel = document.querySelector('#credits');
  const creditsIndicator = document.querySelector('#credits-card');
  let lastCreditFlashId = 0;
  const help = document.querySelector('#help');
  const inventoryCount = document.querySelector('#inventory-count');
  const inventorySlots = document.querySelector('#inventory-slots');
  const slotLabels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const slotElements = slotLabels.map((label, index) => {
    const slot = document.createElement('li');
    slot.className = 'inventory-slot';
    slot.addEventListener('pointerdown', event => {
      event.preventDefault();
      controls.selectSlot(index);
    });
    const number = document.createElement('span');
    number.className = 'inventory-key';
    number.textContent = label;
    const item = document.createElement('span');
    item.className = 'inventory-item';
    slot.append(number, item);
    inventorySlots.append(slot);
    return { slot, item };
  });

  startButton.addEventListener('click', () => {
    intro.classList.add('hidden');
    if (touchMode) {
      Promise.resolve(document.documentElement.requestFullscreen?.())
        .then(() => screen.orientation?.lock?.('landscape'))
        .catch(() => {});
    } else {
      canvas.requestPointerLock?.();
    }
  });

  return {
    update(world, player) {
      // Map north is -y and player.a is measured from east, so north is a = -90°.
      const bearing = (((player.a * 180 / Math.PI + 90) % 360) + 360) % 360;
      compassTape.style.transform = `translateX(${compass.clientWidth / 2 - (bearing + 360) * COMPASS_PX_PER_DEGREE}px)`;
      const room = world.getRoomAt(player.x, player.y);
      const actionHint = touchMode ? 'PICK UP / DROP buttons' : 'E pick up · 1–9/0 select · G drop';
      const actionPrompt = player.actionMessageTimer > 0
        ? `${player.actionMessage} · ${actionHint}`
        : touchMode ? 'Joystick move · drag to look · PICK UP / DROP buttons' : 'WASD move · mouse look · E pick up · 1–9/0 select · G drop';
      const carriedCount = player.inventory.filter(Boolean).length;
      creditsLabel.textContent = String(player.credits);
      if (player.creditFlashId !== lastCreditFlashId) {
        lastCreditFlashId = player.creditFlashId;
        creditsIndicator.classList.remove('credits-flashes');
        void creditsIndicator.offsetWidth;
        creditsIndicator.classList.add('credits-flashes');
      }
      inventoryCount.textContent = `${carriedCount} / 10`;
      slotElements.forEach(({ slot, item }, index) => {
        const object = player.inventory[index];
        slot.classList.toggle('selected', index === player.selectedInventorySlot);
        slot.classList.toggle('occupied', Boolean(object));
        item.textContent = object ? (OBJECT_METADATA[object.type]?.inventoryName ?? object.type) : '—';
      });
      if (room) {
        buildingLabel.textContent = room.building;
        roomLabel.textContent = String(room.room).padStart(2, '0');
        roomCount.textContent = String(room.roomCount);
        help.textContent = actionPrompt;
      } else {
        buildingLabel.textContent = '—';
        roomLabel.textContent = 'OUT';
        roomCount.textContent = '—';
        help.textContent = player.actionMessageTimer > 0
          ? actionPrompt
          : `OUTSIDE · follow paths · ${actionHint}`;
      }
    }
  };
}
