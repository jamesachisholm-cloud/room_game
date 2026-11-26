import { OBJECT_METADATA } from './object-types.js?v=20261108';

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
  const ending = document.querySelector('#ending');
  const endingKicker = document.querySelector('#ending-kicker');
  const endingTitle = document.querySelector('#ending-title');
  const endingMessage = document.querySelector('#ending-message');
  const restartButton = document.querySelector('#restart');
  const startButton = document.querySelector('#start');
  const creditsLabel = document.querySelector('#credits');
  const creditsIndicator = document.querySelector('#credits-card');
  const robberDistanceLabel = document.querySelector('#robber-distance');
  const robberIndicator = document.querySelector('#robber-card');
  let lastCreditFlashId = 0;
  let lastInventoryFlashId = 0;
  const lastText = new WeakMap();
  const setText = (element, value) => {
    if (lastText.get(element) !== value) {
      element.textContent = value;
      lastText.set(element, value);
    }
  };
  let endingShown = false;
  const help = document.querySelector('#help');
  const boardingPrompt = document.querySelector('#boarding-prompt');
  const boardingKey = document.querySelector('#boarding-key');
  const boardingLabel = document.querySelector('#boarding-label');
  const inventoryCount = document.querySelector('#inventory-count');
  const inventorySlots = document.querySelector('#inventory-slots');
  restartButton.addEventListener('click', () => location.reload());
  let escapePortal;
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
    }
  });

  return {
    update(world, player) {
      escapePortal ??= world.magicDoors.find(door => door.building === 'E' && door.target?.building === 'F');
      // Map north is -y and player.a is measured from east, so north is a = -90°.
      const bearing = (((player.a * 180 / Math.PI + 90) % 360) + 360) % 360;
      const compassTransform = `translateX(${compass.clientWidth / 2 - (bearing + 360) * COMPASS_PX_PER_DEGREE}px)`;
      if (compassTape.style.transform !== compassTransform) compassTape.style.transform = compassTransform;
      const room = world.getRoomAt(player.x, player.y);
      const ticketPrice = world.ticketSeller?.price ?? 250;
      const ownsTicket = player.inventory.some(object => object?.type === 'ticket');
      const ticketSellerPrompt = ownsTicket
        ? 'FLIGHT TICKET IN INVENTORY'
        : player.credits >= ticketPrice
          ? touchMode ? 'TAP PICK UP TO BUY TICKET' : 'PRESS E TO BUY TICKET'
          : `TICKET COSTS ${ticketPrice} CREDITS · YOU HAVE ${player.credits}`;
      const actionPrompt = player.ticketSellerNearby && !player.launching
        ? ticketSellerPrompt
        : player.rocketNearby && !player.launching
        ? touchMode ? 'PICK UP to board the rocket' : 'E · BOARD THE ROCKET'
        : player.launching ? 'THE ROCKET IS LIFTING OFF…'
          : player.actionMessageTimer > 0
        ? player.actionMessage
        : '';
      if (player.launching) document.body.classList.add('rocket-flight');
      boardingPrompt.classList.toggle('visible', (player.rocketNearby || player.ticketSellerNearby) && !player.launching);
      boardingKey.hidden = touchMode;
      setText(boardingLabel, player.ticketSellerNearby && !player.launching
        ? ticketSellerPrompt
        : touchMode ? 'TAP PICK UP TO BOARD' : 'PRESS E TO BOARD');
      if (player.gameComplete) {
        document.body.classList.add('game-ended');
        if (!endingShown) {
          endingShown = true;
          ending.classList.add('visible');
          const robbed = player.gameOutcome === 'robbed' || player.gameOutcome === 'ticket-stolen';
          ending.classList.toggle('rocket-ending', !robbed);
          setText(endingKicker, robbed ? 'CAUGHT BY THE ROBBER' : 'MISSION COMPLETE');
          setText(endingTitle, robbed ? 'THE ROBBER GOT YOU' : '');
          endingMessage.innerHTML = player.gameOutcome === 'ticket-stolen'
            ? 'The robber stole your flight ticket.<br>Your escape is over.'
            : robbed
              ? 'The robber found your pockets empty.<br>Try again and protect your loot.'
            : 'You made it out of Tzargarrot.<br>The next adventure is yours to choose.';
          setText(restartButton, robbed ? 'TRY AGAIN' : 'PLAY AGAIN');
        }
      }
      let carriedCount = 0;
      for (const object of player.inventory) if (object) carriedCount++;
      const robber = world.robber;
      if (robber) {
        const distanceMeters = Math.hypot(player.x - robber.x, player.y - robber.y) * (10 / 7) * 0.3048;
        setText(robberDistanceLabel, `${Math.round(distanceMeters)} m`);
        robberIndicator.classList.toggle('robber-near', distanceMeters < 5);
      } else {
        setText(robberDistanceLabel, '—');
        robberIndicator.classList.remove('robber-near');
      }
      setText(creditsLabel, String(player.credits));
      creditsIndicator.classList.toggle('credits-ready', player.credits >= ticketPrice);
      if (player.creditFlashId !== lastCreditFlashId) {
        lastCreditFlashId = player.creditFlashId;
        creditsIndicator.classList.remove('credits-flashes');
        void creditsIndicator.offsetWidth;
        creditsIndicator.classList.add('credits-flashes');
      }
      if (player.inventoryFlashId !== lastInventoryFlashId) {
        lastInventoryFlashId = player.inventoryFlashId;
        inventorySlots.classList.remove('inventory-flashes');
        void inventorySlots.offsetWidth;
        inventorySlots.classList.add('inventory-flashes');
      }
      setText(inventoryCount, `${carriedCount} / 10`);
      slotElements.forEach(({ slot, item }, index) => {
        const object = player.inventory[index];
        slot.classList.toggle('selected', index === player.selectedInventorySlot);
        slot.classList.toggle('occupied', Boolean(object));
        setText(item, object ? (OBJECT_METADATA[object.type]?.inventoryName ?? object.type) : '—');
      });
      if (room) {
        setText(help, actionPrompt);
      } else {
        setText(help, player.actionMessageTimer > 0 ? actionPrompt : 'OUTSIDE · follow paths');
      }
    }
  };
}
