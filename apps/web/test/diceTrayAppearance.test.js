import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeTrayBackground, readTrayBackground, saveTrayBackground, trayAppearanceStorageKey, trayBackground, trayBackgrounds } from '../src/diceTrayAppearance.js';
import { appearanceStorageKey, readAppearance, saveAppearance } from '../src/diceAppearance.js';

test('tray IDs are bounded; corrupt, missing and unavailable storage safely use Theme default', () => {
  for (const value of [undefined, null, {}, ['green'], 'unknown', 'custom', '#ffffff', 'toString', '__proto__']) {
    assert.equal(normalizeTrayBackground(value), 'theme');
    assert.equal(trayBackground(value), trayBackground('theme'));
  }
  for (const raw of [null, '{broken', '{}', '"unknown"']) {
    assert.equal(readTrayBackground({ getItem: () => raw }), 'theme');
  }
  const unavailable = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  assert.equal(readTrayBackground(unavailable), 'theme');
  assert.doesNotThrow(() => saveTrayBackground('green', unavailable));
  assert.equal(readTrayBackground(), 'theme'); // No browser global in Node.
  assert.doesNotThrow(() => saveTrayBackground('green'));
});

test('every tray choice persists independently from dice color and app theme', () => {
  const data = new Map([['appTheme', 'dark']]);
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  saveAppearance({ id: 'ruby' }, storage);
  const dicePreference = data.get(appearanceStorageKey);
  for (const { id } of trayBackgrounds) {
    saveTrayBackground(id, storage);
    assert.equal(readTrayBackground(storage), id);
    data.set('appTheme', 'light');
    assert.equal(readTrayBackground(storage), id);
    assert.equal(data.get(appearanceStorageKey), dicePreference);
    saveAppearance({ id: 'emerald' }, storage);
    assert.equal(readTrayBackground(storage), id);
    saveAppearance({ id: 'ruby' }, storage);
  }
  saveTrayBackground('injected CSS', storage);
  assert.equal(data.get(trayAppearanceStorageKey), '"theme"');
  assert.deepEqual(readAppearance(storage), { id: 'ruby' });
});

test('swatches and tray share bounded CSS surfaces; only Theme default uses theme tokens', () => {
  assert.equal(trayBackground('theme'), 'radial-gradient(ellipse at center, var(--glow), transparent), var(--control)');
  assert.equal(new Set(trayBackgrounds.map(({ background }) => background)).size, 6);
  for (const { id, background } of trayBackgrounds) {
    assert.equal(trayBackground(id), background);
    if (id !== 'theme') {
      assert.doesNotMatch(background, /var\(/);
      assert.doesNotMatch(background, /repeating-.*gradient/);
      const assets = [...background.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]);
      assert.equal(assets.length, 1);
      assert.match(assets[0], /^\/textures\/tray-(felt|leather|stone)\.svg$/);
      const svg = readFileSync(new URL(`../public${assets[0]}`, import.meta.url), 'utf8');
      assert.match(svg, /<feTurbulence[^>]+seed="\d+"/);
      assert.doesNotMatch(svg, /<animate|<script|href=/);
      assert.match(background, /768px 768px/); // Material scale is independent of viewport.
    }
  }
});

test('Stone tiles is an accepted, stored and restored local textured finish', () => {
  assert.equal(normalizeTrayBackground('stone'), 'stone');
  assert.equal(trayBackgrounds.find(({ id }) => id === 'stone').label, 'Stone tiles');
  assert.match(trayBackground('stone'), /url\("\/textures\/tray-stone\.svg"\) center \/ 768px 768px/);
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  saveTrayBackground('stone', storage);
  assert.equal(data.get(trayAppearanceStorageKey), '"stone"');
  assert.equal(readTrayBackground(storage), 'stone');
});
