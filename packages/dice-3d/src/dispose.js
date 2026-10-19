// Meshes own materials; the factory owns shared geometry and label textures.
// Dispose each resource once, including geometry cloned by forced roll outcomes.
export function disposeBox(box) {
  if (!box) return;
  box.running = false;
  box.rolling = false;
  const resources = new Set();
  box.scene?.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
    object.shadow?.map?.dispose();
  });
  Object.values(box.DiceFactory?.geometries ?? {}).forEach((geometry) => resources.add(geometry));
  Object.values(box.DiceFactory?.materials_cache ?? {}).forEach(({ composite, bump }) => {
    if (composite) resources.add(composite);
    if (bump) resources.add(bump);
  });
  resources.forEach((resource) => resource.dispose());
  box.scene?.clear();
  box.renderer?.dispose();
  if (!box.renderer?.getContext?.().isContextLost()) box.renderer?.forceContextLoss();
  box.renderer?.domElement.remove();
}
