import { dice3dThemes } from '@dndharness/dice-3d/theme';

export const appearanceStorageKey = 'dndharness.dice-appearance';
export const dicePalettes = [
  { id: 'theme', label: 'Theme default' },
  { id: 'parchment', label: 'Parchment', body: '#fffcf7' },
  { id: 'obsidian', label: 'Obsidian', body: '#242320' },
  { id: 'ruby', label: 'Ruby', body: '#8b263b' },
  { id: 'emerald', label: 'Emerald', body: '#17634b' },
  { id: 'sapphire', label: 'Sapphire', body: '#254c91' },
];

export function normalizeAppearance(value) {
  if (dicePalettes.some(({ id }) => id === value?.id)) return { id: value.id };
  if (value?.id === 'custom' && /^#[0-9a-f]{6}$/i.test(value.body)) return { id: 'custom', body: value.body.toLowerCase() };
  return { id: 'theme' };
}

export function readAppearance(storage) {
  try { return normalizeAppearance(JSON.parse((storage ?? window.localStorage).getItem(appearanceStorageKey))); }
  catch { return { id: 'theme' }; }
}

export function saveAppearance(value, storage) {
  try { (storage ?? window.localStorage).setItem(appearanceStorageKey, JSON.stringify(normalizeAppearance(value))); }
  catch { /* The current page still supports appearance changes without storage. */ }
}

export function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

export function appearanceTheme(value, theme) {
  const choice = normalizeAppearance(value);
  if (choice.id === 'theme') return dice3dThemes[theme] ?? dice3dThemes.light;
  if (choice.id === 'parchment') return dice3dThemes.light;
  if (choice.id === 'obsidian') return dice3dThemes.dark;
  const background = choice.body ?? dicePalettes.find(({ id }) => id === choice.id).body;
  const light = luminance(background);
  const foreground = (light + 0.05) / 0.05 >= 1.05 / (light + 0.05) ? '#000000' : '#ffffff';
  return {
    name: choice.id === 'custom' ? `custom-${background.slice(1)}` : choice.id,
    category: 'dndharness', background, foreground,
    outline: background, edge: foreground === '#ffffff' ? '#dec496' : '#574534', texture: 'none',
  };
}
