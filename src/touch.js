export function setupTouchControls(canvas, controls) {
  if (!matchMedia('(pointer: coarse)').matches) return;

  const root = document.createElement('div');
  root.id = 'touch-controls';
  const stick = document.createElement('div');
  stick.id = 'joystick';
  const knob = document.createElement('div');
  knob.id = 'joystick-knob';
  stick.append(knob);
  const makeButton = (id, label) => {
    const button = document.createElement('button');
    button.id = id;
    button.className = 'touch-button';
    button.textContent = label;
    return button;
  };
  const pickUp = makeButton('touch-pick', 'PICK UP');
  const drop = makeButton('touch-drop', 'DROP');
  root.append(stick, pickUp, drop);
  document.body.append(root);

  const stickRadius = 45;
  const deadZone = .15;
  let stickPointer = null;
  function moveStick(event) {
    const rect = stick.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > stickRadius) {
      dx = dx / length * stickRadius;
      dy = dy / length * stickRadius;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const x = dx / stickRadius;
    const y = -dy / stickRadius;
    if (Math.hypot(x, y) < deadZone) controls.setTouchMove(0, 0);
    else controls.setTouchMove(x, y);
  }
  function releaseStick(event) {
    if (event.pointerId !== stickPointer) return;
    stickPointer = null;
    knob.style.transform = '';
    controls.setTouchMove(0, 0);
  }
  stick.addEventListener('pointerdown', event => {
    if (stickPointer !== null) return;
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  stick.addEventListener('pointermove', event => {
    if (event.pointerId === stickPointer) moveStick(event);
  });
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);

  // Dragging anywhere else on the view turns the player.
  let lookPointer = null;
  let lastX = 0;
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || lookPointer !== null) return;
    lookPointer = event.pointerId;
    lastX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== lookPointer) return;
    controls.turnBy((event.clientX - lastX) * .006);
    lastX = event.clientX;
  });
  const endLook = event => {
    if (event.pointerId === lookPointer) lookPointer = null;
  };
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);

  pickUp.addEventListener('pointerdown', event => {
    event.preventDefault();
    controls.pickUpObject();
  });
  drop.addEventListener('pointerdown', event => {
    event.preventDefault();
    controls.dropObject();
  });
}
