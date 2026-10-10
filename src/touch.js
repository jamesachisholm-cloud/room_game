export function setupTouchControls(controls, canvas) {
  if (!matchMedia('(pointer: coarse)').matches) return;

  const root = document.createElement('div');
  root.id = 'touch-controls';

  const TAP_SLOP = 12;
  const TAP_MS = 400;
  const LOOK_RADIANS_PER_PX = 0.006;
  let gesture = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', event => {
    if (gesture) return;
    gesture = { id: event.pointerId, x: event.clientX, startX: event.clientX, startY: event.clientY, time: performance.now(), dragging: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.dragging && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > TAP_SLOP) gesture.dragging = true;
    if (!gesture.dragging) return;
    controls.lookBy((event.clientX - gesture.x) * LOOK_RADIANS_PER_PX);
    gesture.x = event.clientX;
  });
  canvas.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const { dragging, time } = gesture;
    gesture = null;
    if (dragging || performance.now() - time > TAP_MS) return;
    const rect = canvas.getBoundingClientRect();
    controls.walkToScreenPoint(
      (event.clientX - rect.left - rect.width / 2) / rect.width,
      (event.clientY - rect.top - rect.height / 2) / rect.width
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
