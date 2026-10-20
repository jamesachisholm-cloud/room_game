export function setupTouchControls(controls, canvas) {
  if (!matchMedia('(pointer: coarse)').matches) return;

  const root = document.createElement('div');
  root.id = 'touch-controls';

  const TAP_SLOP = 12;
  const TAP_MS = 400;
  // Taps above this fraction of the view height walk forward and taps below walk back.
  const TAP_SPLIT = 0.75;
  let gesture = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', event => {
    if (gesture) return;
    gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, time: performance.now() };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const { startX, startY, time } = gesture;
    gesture = null;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > TAP_SLOP || performance.now() - time > TAP_MS) return;
    const rect = canvas.getBoundingClientRect();
    controls.walkToScreenPoint(
      (event.clientX - rect.left - rect.width / 2) / rect.width,
      (event.clientY - rect.top - rect.height * TAP_SPLIT) / rect.width
    );
  });
  canvas.addEventListener('pointercancel', event => {
    if (gesture && event.pointerId === gesture.id) gesture = null;
  });

  const makeButton = (id, label) => {
    const button = document.createElement('button');
    button.id = id;
    button.className = 'touch-button';
    button.textContent = label;
    return button;
  };
  const pickUp = makeButton('touch-pick', 'PICK UP');
  const drop = makeButton('touch-drop', 'DROP');
  root.append(pickUp, drop);
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
