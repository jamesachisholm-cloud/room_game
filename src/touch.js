export function setupTouchControls(controls) {
  if (!matchMedia('(pointer: coarse)').matches) return;

  const root = document.createElement('div');
  root.id = 'touch-controls';
  const joystick = document.createElement('div');
  joystick.id = 'joystick';
  const knob = document.createElement('div');
  knob.id = 'joystick-knob';
  joystick.append(knob);

  const DEADZONE = 0.12;
  // Cubic-ish response: fine control near center, full speed at the rim.
  const shape = value => {
    const magnitude = Math.abs(value);
    if (magnitude < DEADZONE) return 0;
    const scaled = (magnitude - DEADZONE) / (1 - DEADZONE);
    return Math.sign(value) * (0.6 * scaled + 0.4 * scaled * scaled);
  };
  let activePointer = null;
  const update = event => {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width / 2;
    let x = (event.clientX - rect.left - radius) / radius;
    let y = (event.clientY - rect.top - radius) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    knob.style.transform = `translate(${x * radius * 0.6}px, ${y * radius * 0.6}px)`;
    controls.setTouchMove(0, shape(-y));
    controls.setTouchTurn(shape(x));
  };
  const release = event => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    knob.style.transform = '';
    joystick.classList.remove('active');
    controls.setTouchMove(0, 0);
    controls.setTouchTurn(0);
  };
  joystick.addEventListener('pointerdown', event => {
    if (activePointer !== null) return;
    event.preventDefault();
    activePointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    joystick.classList.add('active');
    update(event);
  });
  joystick.addEventListener('pointermove', event => {
    if (event.pointerId === activePointer) update(event);
  });
  joystick.addEventListener('pointerup', release);
  joystick.addEventListener('pointercancel', release);
  joystick.addEventListener('lostpointercapture', release);
  const makeButton = (id, label) => {
    const button = document.createElement('button');
    button.id = id;
    button.className = 'touch-button';
    button.textContent = label;
    return button;
  };
  const pickUp = makeButton('touch-pick', 'PICK UP');
  const drop = makeButton('touch-drop', 'DROP');
  root.append(joystick, pickUp, drop);
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
