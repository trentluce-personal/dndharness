import test from 'node:test';
import assert from 'node:assert/strict';
import { showPreview } from '../../../packages/dice-3d/src/preview.js';

function previewBox() {
  const meshes = new Set();
  const vector = () => ({ z: -1, set() { return this; }, clone: vector, fromArray() { return this; }, normalize() { return this; }, applyQuaternion() { return this; } });
  return {
    meshes,
    scene: { add: (mesh) => meshes.add(mesh), remove: (mesh) => meshes.delete(mesh) },
    renderer: { render() {} },
    DiceFactory: { create(type) {
      return {
        type, position: vector(), quaternion: { setFromUnitVectors() {} }, rotateOnWorldAxis() {},
        geometry: { groups: [{ materialIndex: 1, start: 0 }], getAttribute: () => ({ array: [0, 0, 1] }), dispose() { assert.fail('Shared geometry must survive preview cleanup'); } },
        material: [{ dispose() { this.disposed = true; } }],
      };
    } },
    // Selection must not invoke the roll pipeline or produce physics bodies/results.
    roll() { assert.fail('Preview cannot roll'); },
    world: { addBody() { assert.fail('Preview cannot start physics'); } },
  };
}

test('all die previews replace cleanly, including ten percentile pairs, without rolling', () => {
  const box = previewBox();
  for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
    for (const count of [1, 3, 10]) {
      const clear = showPreview(box, sides, count);
      const meshes = [...box.meshes];
      assert.deepEqual(meshes.map((mesh) => mesh.type), Array.from({ length: count }, () => sides === 100 ? ['d100', 'd10'] : [`d${sides}`]).flat());
      clear();
      clear();
      assert.equal(box.meshes.size, 0);
      assert.ok(meshes.every((mesh) => mesh.material[0].disposed));
    }
  }
});

test('partial preview creation failure releases previously created meshes', () => {
  const box = previewBox();
  const create = box.DiceFactory.create;
  let calls = 0;
  box.DiceFactory.create = (type) => ++calls === 2 ? null : create(type);
  assert.throws(() => showPreview(box, 100, 1), /Unable to preview d10/);
  assert.equal(box.meshes.size, 0);
});
