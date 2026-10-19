import test from 'node:test';
import assert from 'node:assert/strict';
import { appearanceTheme, appearanceStorageKey, dicePalettes, luminance, normalizeAppearance, readAppearance, saveAppearance } from '../src/diceAppearance.js';
import { dice3dThemes } from '../../../packages/dice-3d/src/theme.js';
import { captureFaces, thumbnailSides } from '../../../packages/dice-3d/src/thumbnails.js';
import { disposeBox } from '../../../packages/dice-3d/src/dispose.js';
import { Vector3, Quaternion } from 'three';

test('appearance storage validates, normalizes and tolerates unavailable browser storage', () => {
  for (const value of [null, {}, { id: 'unknown' }, { id: 'custom', body: '#fff' }, { id: 'custom', body: 'red' }]) assert.deepEqual(normalizeAppearance(value), { id: 'theme' });
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  saveAppearance({ id: 'custom', body: '#ABCDEF', unrelated: true }, storage);
  assert.deepEqual(readAppearance(storage), { id: 'custom', body: '#abcdef' });
  data.set(appearanceStorageKey, '{broken');
  assert.deepEqual(readAppearance(storage), { id: 'theme' });
  const unavailable = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  assert.deepEqual(readAppearance(unavailable), { id: 'theme' });
  assert.doesNotThrow(() => saveAppearance({ id: 'ruby' }, unavailable));
});

test('only Theme default follows app theme; chosen palettes/custom stay fixed with readable ink', () => {
  assert.equal(appearanceTheme({ id: 'theme' }, 'light'), dice3dThemes.light);
  assert.equal(appearanceTheme({ id: 'theme' }, 'dark'), dice3dThemes.dark);
  const choices = [...dicePalettes.filter(({ id }) => id !== 'theme'), ...['#000000', '#ffffff', '#777777', '#00ff00', '#ff00ff', '#0000ff'].map((body) => ({ id: 'custom', body }))];
  for (const choice of choices) {
    const palette = appearanceTheme(choice, 'light');
    assert.deepEqual(palette, appearanceTheme(choice, 'dark'));
    const values = [luminance(palette.foreground), luminance(palette.background)].sort((a, b) => a - b);
    assert.ok((values[1] + .05) / (values[0] + .05) >= 4.5, `${choice.id}: readable numerals`);
    assert.ok(palette.outline && palette.edge);
  }
});

test('thumbnail capture maps every real factory type, frees mesh materials but reuses geometry/textures', () => {
  const meshes = new Set();
  const created = [];
  const geometry = { groups: [{ materialIndex: 1, start: 0 }], getAttribute: () => ({ array: [0, 0, -1] }), dispose() { assert.fail('geometry belongs to factory'); } };
  const box = {
    scene: { add: (mesh) => meshes.add(mesh), remove: (mesh) => meshes.delete(mesh) },
    camera: { position: new Vector3(), lookAt() {} },
    renderer: { render() {}, domElement: { toDataURL() { return [...meshes].map(({ type }) => type).join('+'); } } },
    DiceFactory: { create(type) {
      const mesh = { type, geometry, material: [{ dispose() { this.disposed = true; } }], position: new Vector3(), quaternion: new Quaternion(), rotateOnWorldAxis() {} };
      created.push(mesh);
      return mesh;
    } },
  };
  const images = captureFaces(box);
  assert.deepEqual(Object.keys(images).map(Number), thumbnailSides);
  assert.equal(images[100], 'd100+d10');
  assert.equal(images[4], 'd4');
  assert.ok(created.every(({ material }) => material[0].disposed));
  assert.equal(meshes.size, 0);
  box.renderer.domElement.toDataURL = () => { throw Error('lost context'); };
  assert.throws(() => captureFaces(box), /lost context/);
  assert.equal(meshes.size, 0);
});

test('final disposal releases shared assets once, including removed previews and forced geometry', () => {
  const counts = new Map();
  const resource = () => ({ dispose() { counts.set(this, (counts.get(this) ?? 0) + 1); } });
  const geometry = resource(); const forcedGeometry = resource(); const texture = { ...resource(), isTexture: true }; const material = { ...resource(), map: texture };
  const renderer = { ...resource(), forceContextLoss() { this.lost = true; }, domElement: { remove() {} } };
  const box = { renderer, scene: { traverse(fn) { fn({ geometry, material }); fn({ geometry: forcedGeometry, material }); }, clear() {} }, DiceFactory: { geometries: { d4: geometry }, materials_cache: { label: { composite: texture } } } };
  disposeBox(box);
  assert.ok([geometry, forcedGeometry, texture, material, renderer].every((item) => counts.get(item) === 1));
  assert.equal(renderer.lost, true);
});
