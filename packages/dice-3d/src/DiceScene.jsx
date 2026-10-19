import { useEffect, useId, useRef } from 'react';
import DiceBox from '@3d-dice/dice-box-threejs';
import { showPreview } from './preview.js';
import { disposeBox } from './dispose.js';

// Keep physics independent of the CSS viewport so resizing cannot change a
// predetermined throw. The camera fits this whole area on smaller screens.
const WORLD_SIZE = { x: 500, y: 350 };

function notationFor(sides, values) {
  if (sides === 100) {
    const tens = values.map((value) => (value === 100 ? 0 : Math.floor(value / 10)));
    const units = values.map((value) => value % 10);
    return `${values.length}d100+${values.length}d10@${tens.join(',')},${units.join(',')}`;
  }
  return `${values.length}d${sides}@${values.join(',')}`;
}

export default function DiceScene({ roll, sides = 20, count = 1, theme, onSettled, onReady, onError, className = 'dice-scene' }) {
  const reactId = useId();
  const sceneId = `dice-scene-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const containerRef = useRef(null);
  const readyRef = useRef(null);
  const resizeRef = useRef(null);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let destroyed = false;
    let resizeFrame = null;
    let resizePending = false;
    let resizeObserver;
    let canvas;
    let box;
    try { box = new DiceBox(`#${sceneId}`, {
      sounds: false,
      theme_surface: 'default',
      theme_material: 'plastic',
      theme_customColorset: theme ?? null,
    }); } catch (error) { onErrorRef.current?.(error); return; }
    box.dimensions = WORLD_SIZE;
    const resize = () => {
      if (destroyed || !resizePending || box.rolling) return;
      if (box.container.clientWidth && box.container.clientHeight) {
        resizePending = false;
        box.setDimensions(WORLD_SIZE);
      }
    };
    resizeRef.current = resize;
    const onResize = () => {
      if (destroyed) return;
      resizePending = true;
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        resize();
      });
    };
    // The upstream resize listener has no teardown and changes the physics
    // world mid-throw. Observe the actual tray and apply updates after settling.
    box.resizeWorld = () => {};
    for (const name of ['animateThrow', 'animateAfterThrow']) {
      const original = box[name];
      box[name] = function (...args) { if (!destroyed) return original.apply(this, args); };
    }
    const onContextLost = () => { if (!destroyed) onErrorRef.current?.(new Error('WebGL context lost')); };
    const ready = box.initialize().then(() => {
      if (destroyed) throw new Error('DiceScene unmounted during initialization');
      const swapD4 = box.swapDiceFace_D4.bind(box);
      box.swapDiceFace_D4 = (die, target) => {
        swapD4(die, target);
        die.result = [];
      };
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(box.container);
      return box;
    });
    canvas = box.renderer?.domElement;
    canvas?.addEventListener('webglcontextlost', onContextLost);
    if (box.renderer) {
      const render = box.renderer.render.bind(box.renderer);
      box.renderer.render = (...args) => { if (!destroyed) render(...args); };
    }
    ready.catch(() => { disposeBox(box); });
    readyRef.current = ready;
    ready.then((instance) => {
      if (!destroyed) onReadyRef.current?.(instance);
    }).catch((error) => { if (!destroyed) onErrorRef.current?.(error); });
    return () => {
      destroyed = true;
      resizeObserver?.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      canvas?.removeEventListener('webglcontextlost', onContextLost);
      readyRef.current = null;
      resizeRef.current = null;
      // Initialization may still be loading textures. Its continuation owns
      // disposal in that case, after the factory has finished creating assets.
      if (box.initialized) disposeBox(box);
    };
  }, [sceneId, theme]);

  useEffect(() => {
    let cancelled = false;
    let clearPreview;
    readyRef.current?.then((box) => {
        if (cancelled) return null;
        if (!roll?.id) {
          box.clearDice();
          clearPreview = showPreview(box, sides, count);
          return null;
        }
        const outcome = box.roll(notationFor(roll.sides, roll.values));
        return outcome?.then ? outcome : Promise.resolve(null);
      })
      .then((results) => {
        if (!cancelled && roll?.id) {
          resizeRef.current?.();
          onSettledRef.current?.(results ?? null);
        }
      })
      .catch((error) => {
        if (!cancelled) onErrorRef.current?.(error);
        if (!cancelled && roll?.id) onSettledRef.current?.(null);
      });
    return () => { cancelled = true; clearPreview?.(); };
  }, [roll, sides, count, sceneId, theme]);

  return <div id={sceneId} ref={containerRef} className={className} aria-hidden="true" />;
}
