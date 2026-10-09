import { OBJECT_METADATA } from './object-types.js?v=20261037';

export function setupHud(canvas) {
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
  const slotElements = slotLabels.map(label => {
    const slot = document.createElement('li');
    slot.className = 'inventory-slot';
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
    canvas.requestPointerLock?.();
  });

  return {
    update(world, player) {
      const room = world.getRoomAt(player.x, player.y);
      const actionPrompt = player.actionMessageTimer > 0
        ? `${player.actionMessage} · E pick up · 1–9/0 select · G drop`
        : 'WASD move · mouse look · E pick up · 1–9/0 select · G drop';
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
          : 'OUTSIDE · follow paths · E pick up · 1–9/0 select · G drop';
      }
    }
  };
}
