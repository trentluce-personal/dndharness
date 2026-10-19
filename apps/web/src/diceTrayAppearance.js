export const trayAppearanceStorageKey = 'dndharness.dice-tray-background';

// Fixed CSS-pixel grain scale on both desktop and mobile. The same static local
// surfaces are used by swatches and the tray, without touching the WebGL scene.
const materialLight = 'radial-gradient(ellipse at 38% 32%, transparent 25%, #00000026 100%), linear-gradient(145deg, #ffffff09, transparent 55%, #0000000c)';
const feltTexture = 'url("/textures/tray-felt.svg") center / 768px 768px';
const leatherTexture = 'url("/textures/tray-leather.svg") center / 768px 768px';
const stoneTexture = 'url("/textures/tray-stone.svg") center / 768px 768px';
export const trayBackgrounds = [
  { id: 'theme', label: 'Theme default', background: 'radial-gradient(ellipse at center, var(--glow), transparent), var(--control)' },
  { id: 'green', label: 'Green felt', background: `${materialLight}, ${feltTexture}, #294436` },
  { id: 'burgundy', label: 'Burgundy felt', background: `${materialLight}, ${feltTexture}, #54303a` },
  { id: 'midnight', label: 'Midnight felt', background: `${materialLight}, ${feltTexture}, #293544` },
  { id: 'brown', label: 'Brown leather', background: `${materialLight}, ${leatherTexture}, #533a29` },
  { id: 'stone', label: 'Stone tiles', background: `${materialLight}, ${stoneTexture}, #777e82` },
];

export function normalizeTrayBackground(value) {
  return trayBackgrounds.some(({ id }) => id === value) ? value : 'theme';
}

export function trayBackground(value) {
  return trayBackgrounds.find(({ id }) => id === normalizeTrayBackground(value)).background;
}

export function readTrayBackground(storage) {
  try { return normalizeTrayBackground(JSON.parse((storage ?? window.localStorage).getItem(trayAppearanceStorageKey))); }
  catch { return 'theme'; }
}

export function saveTrayBackground(value, storage) {
  try { (storage ?? window.localStorage).setItem(trayAppearanceStorageKey, JSON.stringify(normalizeTrayBackground(value))); }
  catch { /* Keep the current page usable when storage is unavailable. */ }
}
