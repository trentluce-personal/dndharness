// Preview meshes never enter the physics world or produce rolled values.
export function showPreview(box, sides, count) {
  const types = Array.from({ length: count }, () => sides === 100 ? ['d100', 'd10'] : [`d${sides}`]).flat();
  const columns = Math.min(5, types.length);
  const rows = Math.ceil(types.length / columns);
  const meshes = [];
  const clear = () => meshes.splice(0).forEach((mesh) => {
    box.scene.remove(mesh);
    // Geometry and label textures belong to the factory cache, not this mesh.
    mesh.material.forEach((material) => material.dispose());
  });
  try {
    types.forEach((type, index) => {
      const mesh = box.DiceFactory.create(type);
      if (!mesh) throw new Error(`Unable to preview ${type}`);
      meshes.push(mesh);
      const row = Math.floor(index / columns);
      const rowCount = Math.min(columns, types.length - row * columns);
      mesh.position.set((index % columns - (rowCount - 1) / 2) * 175, ((rows - 1) / 2 - row) * 160, 100);
      // Rest on a real face, with a fixed yaw rather than a simulated throw.
      const face = mesh.geometry.groups.find((group) => group.materialIndex > 0);
      const normal = mesh.position.clone().fromArray(mesh.geometry.getAttribute('normal').array, face.start * 3).normalize();
      mesh.quaternion.setFromUnitVectors(normal, mesh.position.clone().set(0, 0, -1));
      mesh.rotateOnWorldAxis(mesh.position.clone().set(0, 0, 1), Math.PI / 8);
      const vertices = mesh.geometry.getAttribute('position').array;
      const vertex = mesh.position.clone();
      let bottom = Infinity;
      for (let offset = 0; offset < vertices.length; offset += 3) {
        bottom = Math.min(bottom, vertex.fromArray(vertices, offset).applyQuaternion(mesh.quaternion).z);
      }
      mesh.position.z = -bottom;
      mesh.castShadow = box.shadows;
      box.scene.add(mesh);
    });
    box.renderer.render(box.scene, box.camera);
  } catch (error) {
    clear();
    throw error;
  }
  return clear;
}
