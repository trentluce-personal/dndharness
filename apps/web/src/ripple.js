// A paint-only effect: actions never wait for the animation to finish.
export function ripple(event) {
  if (document.documentElement.dataset.motion === 'reduce') return;
  if (event.type === 'pointerdown' && event.button !== 0) return;
  const target = event.currentTarget;
  const bounds = target.getBoundingClientRect();
  const pointer = event.type === 'pointerdown';
  const x = pointer ? event.clientX - bounds.left : bounds.width / 2;
  const y = pointer ? event.clientY - bounds.top : bounds.height / 2;
  const radius = Math.hypot(Math.max(x, bounds.width - x), Math.max(y, bounds.height - y));
  const wave = document.createElement('span');
  wave.className = 'interaction-ripple';
  wave.setAttribute('aria-hidden', 'true');
  Object.assign(wave.style, {
    width: `${radius * 2}px`, height: `${radius * 2}px`,
    left: `${x - radius}px`, top: `${y - radius}px`,
  });
  // Bound the number of effects during rapid repeated activation.
  target.querySelectorAll('.interaction-ripple').forEach((previous) => previous.remove());
  target.append(wave);
  const animation = wave.animate([
    { transform: 'scale(0)', opacity: .22 },
    { transform: 'scale(1)', opacity: 0 },
  ], { duration: 580, easing: 'cubic-bezier(.2, .7, .3, 1)' });
  animation.finished.then(() => wave.remove(), () => wave.remove());
}
