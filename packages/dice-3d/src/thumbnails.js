import DiceBox from '@3d-dice/dice-box-threejs';
import { showPreview } from './preview.js';
import { disposeBox } from './dispose.js';

export const thumbnailSides = [4, 6, 8, 10, 12, 20, 100];
const cache = new Map();
let queue = Promise.resolve();
let nextId = 0;

// One temporary renderer for all seven real factory meshes, never a throw or
// an animation loop. Serialize requests so rapid color changes cannot fan out
// into seven (or more) WebGL contexts. Only finished image strings are cached.
export function diceThumbnails(theme) {
  const key = JSON.stringify(theme);
  if (cache.has(key)) return cache.get(key);
  const job = queue.then(() => captureThumbnails(theme));
  cache.set(key, job);
  queue = job.catch(() => { cache.delete(key); });
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return job;
}

async function captureThumbnails(theme) {
  const host = document.createElement('div');
  host.id = `dice-thumbnails-${++nextId}`;
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:192px;height:144px;pointer-events:none';
  document.body.append(host);
  let box;
  try {
    box = new DiceBox(`#${host.id}`, { sounds: false, shadows: false, theme_material: 'plastic', theme_customColorset: theme });
    box.resizeWorld = () => {};
    await box.initialize();
    box.desk.visible = false;
    return captureFaces(box);
  } finally {
    disposeBox(box);
    host.remove();
  }
}

export function captureFaces(box) {
  const images = {};
  for (const sides of thumbnailSides) {
    const clear = showPreview(box, sides, 1);
    try {
      box.camera.position.set(0, sides === 100 ? -420 : -240, sides === 100 ? 950 : 590);
      box.camera.lookAt(0, 0, 35);
      box.renderer.render(box.scene, box.camera);
      images[sides] = box.renderer.domElement.toDataURL('image/png');
    } finally { clear(); }
  }
  return images;
}
