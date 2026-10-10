export function setupTouchControls(controls) {
  if (!matchMedia('(pointer: coarse)').matches) return;

  const root = document.createElement('div');
  root.id = 'touch-controls';
  const dpad = document.createElement('div');
  dpad.id = 'dpad';
  const held = { up: false, down: false, left: false, right: false };
  const applyHeld = () => {
    controls.setTouchMove(0, (held.up ? 1 : 0) - (held.down ? 1 : 0));
    controls.setTouchTurn((held.right ? 1 : 0) - (held.left ? 1 : 0));
  };
  const makeDpadButton = (direction, label) => {
    const button = document.createElement('button');
    button.className = `dpad-button dpad-${direction}`;
    button.textContent = label;
    const release = () => {
      if (!held[direction]) return;
      held[direction] = false;
      button.classList.remove('pressed');
      applyHeld();
    };
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      held[direction] = true;
      button.classList.add('pressed');
      applyHeld();
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    return button;
  };
  dpad.append(
    makeDpadButton('up', '\u25b2'),
    makeDpadButton('left', '\u25c0'),
    makeDpadButton('right', '\u25b6'),
    makeDpadButton('down', '\u25bc')
  );
  const makeButton = (id, label) => {
    const button = document.createElement('button');
    button.id = id;
    button.className = 'touch-button';
    button.textContent = label;
    return button;
  };
  const pickUp = makeButton('touch-pick', 'PICK UP');
  const drop = makeButton('touch-drop', 'DROP');
  root.append(dpad, pickUp, drop);
  document.body.append(root);

  pickUp.addEventListener('pointerdown', event => {
    event.preventDefault();
    controls.pickUpObject();
  });
  drop.addEventListener('pointerdown', event => {
    event.preventDefault();
    controls.dropObject();
  });
}
