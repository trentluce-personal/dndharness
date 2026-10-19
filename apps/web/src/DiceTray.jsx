import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Button from './Button.jsx';
import DiceColorPicker from './DiceColorPicker.jsx';
import { createUiId } from './uiId.js';
import { reportedValues } from '@dndharness/dice-3d/results';
import { appearanceTheme, dicePalettes, readAppearance, saveAppearance } from './diceAppearance.js';
import { normalizeTrayBackground, readTrayBackground, saveTrayBackground, trayBackground, trayBackgrounds } from './diceTrayAppearance.js';

const DiceScene = lazy(() => import('@dndharness/dice-3d').then((module) => ({ default: module.DiceScene })));

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function randomDie(sides) {
  const limit = Math.floor(4294967296 / sides) * sides;
  const data = new Uint32Array(1);
  do { crypto.getRandomValues(data); } while (data[0] >= limit);
  return data[0] % sides + 1;
}
export default function DiceTray({ welcoming = false }) {
  const [sides, setSides] = useState(20); const [count, setCount] = useState(1);
  const [rolling, setRolling] = useState(false); const [result, setResult] = useState(null); const [history, setHistory] = useState([]);
  const [resultVisible, setResultVisible] = useState(false);
  const controls = useRef(null);
  const [preferences, setPreferences] = useState(() => ({ theme: document.documentElement.dataset.theme ?? 'light', motion: document.documentElement.dataset.motion ?? 'full' }));
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [sceneRoll, setSceneRoll] = useState(null);
  const [appearance, setAppearance] = useState(readAppearance);
  const [trayAppearance, setTrayAppearance] = useState(readTrayBackground);
  const customBody = useRef(appearance.id === 'custom' ? appearance.body : null);
  const palette = useMemo(() => appearanceTheme(appearance, preferences.theme), [appearance, preferences.theme]);
  const [thumbnails, setThumbnails] = useState(null);
  const pending = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    let cancelled = false;
    setThumbnails(null);
    import('@dndharness/dice-3d').then(({ diceThumbnails }) => diceThumbnails(palette))
      .then((images) => { if (!cancelled) setThumbnails(images); })
      .catch(() => { /* The visible dN labels remain usable without WebGL. */ });
    return () => { cancelled = true; };
  }, [palette]);
  const use3d = preferences.motion !== 'reduce' && !sceneFailed;
  useEffect(() => { setSceneReady(false); }, [palette, use3d]);
  function finish() {
    const next = pending.current;
    if (!next) return;
    pending.current = null; clearTimeout(timer.current);
    setResult(next); setResultVisible(true); setHistory((current) => [next, ...current].slice(0, 5)); setRolling(false);
  }
  function failScene() { setSceneFailed(true); setSceneReady(false); finish(); }
  function settled(outcome) {
    const next = pending.current;
    if (!next) return;
    const values = reportedValues(next.sides, next.values.length, outcome);
    if (!values || !values.every((value, index) => value === next.values[index])) failScene();
    else finish();
  }
  useEffect(() => {
    const syncPreferences = () => {
      // Clear the old throw before mounting a replacement scene. Otherwise
      // enabling motion can replay it while the next roll is already starting.
      finish();
      setSceneRoll(null);
      setPreferences({ theme: document.documentElement.dataset.theme ?? 'light', motion: document.documentElement.dataset.motion ?? 'full' });
    };
    const observer = new MutationObserver(syncPreferences);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-motion'] });
    syncPreferences();
    return () => observer.disconnect();
  }, []);
  function roll() {
    if (pending.current) return;
    setResultVisible(false);
    const values = Array.from({ length: count }, () => randomDie(sides));
    const next = { id: createUiId(), sides, values, total: values.reduce((a, b) => a + b, 0) };
    pending.current = next;
    if (!use3d) finish();
    else { setRolling(true); setSceneRoll(next); timer.current = setTimeout(failScene, 15000); }
  }
  function selectDice(nextSides, nextCount) {
    if (pending.current) return;
    if (nextSides === sides && nextCount === count) return;
    setSides(nextSides); setCount(nextCount);
    setSceneRoll(null); setResult(null); setResultVisible(false);
  }
  function dismissResult(event) {
    // Only restore focus when dismissal removes the currently focused control.
    if (event.currentTarget.contains(document.activeElement)) controls.current?.querySelector('button')?.focus();
    setResultVisible(false);
  }
  function selectAppearance(next) {
    if (pending.current) return;
    if (next.id === 'custom') customBody.current = next.body;
    setSceneRoll(null);
    setAppearance(next);
    saveAppearance(next);
  }
  function selectTrayBackground(value) {
    if (pending.current) return;
    const next = normalizeTrayBackground(value);
    setTrayAppearance(next);
    saveTrayBackground(next);
  }
  const Heading = welcoming ? 'h2' : 'h1';
  return <section className={`dice-tray${welcoming ? ' welcoming-dice' : ''}`} aria-labelledby="dice-heading" style={{ '--dice-body': palette.background, '--dice-ink': palette.foreground, '--dice-edge': palette.edge }}>
    <div className="section-heading"><div><p className="eyebrow">{welcoming ? 'Dice roller · No account needed' : 'A little chance'}</p><Heading id="dice-heading">{welcoming ? 'Try your luck.' : 'Dice roller'}</Heading></div><span className="quiet-badge">Only visible to you</span></div>
    <div className="dice-setup">
      <div className="dice-setup-heading">
        <div className="dice-appearance">
          <DiceColorPicker value={appearance.id} disabled={rolling}
            choices={[...dicePalettes.map((choice) => ({ ...choice, body: appearanceTheme(choice, preferences.theme).background })), { id: 'custom', label: 'Custom color', body: customBody.current ?? palette.background }]}
            onChange={(id) => selectAppearance(id === 'custom' ? { id, body: customBody.current ?? palette.background } : { id })} />
          {appearance.id === 'custom' && <label className="dice-custom">Custom dice body color<input type="color" value={appearance.body} disabled={rolling} onChange={(event) => selectAppearance({ id: 'custom', body: event.target.value })} /></label>}
          <DiceColorPicker label="Tray background" value={trayAppearance} choices={trayBackgrounds} disabled={rolling} onChange={selectTrayBackground} />
        </div>
      </div>
      <div className="dice-types" role="group" aria-label="Die type">{[4, 6, 8, 10, 12, 20, 100].map((value) => <Button key={value} className={`die-choice secondary ${sides === value ? 'selected' : ''}`} aria-pressed={sides === value} disabled={rolling} onClick={() => selectDice(value, count)}><span className="die-name">D{value}</span><span className="die-thumbnail" aria-hidden="true">{thumbnails?.[value] && <img src={thumbnails[value]} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}</span></Button>)}</div>
    </div>
    <div className="dice-workbench has-tray">
      <div className={`dice-scene-frame${use3d ? '' : ' dice-fallback-frame'}`} style={{ background: trayBackground(trayAppearance) }} onKeyDown={(event) => { if (event.key === 'Escape' && resultVisible) { event.stopPropagation(); dismissResult(event); } }}>
        {use3d ? <><SceneBoundary onError={failScene}><Suspense fallback={null}><DiceScene key={palette.name} roll={sceneRoll} sides={sides} count={count} theme={palette} onReady={() => setSceneReady(true)} onSettled={settled} onError={failScene} /></Suspense></SceneBoundary>{!sceneReady && <p className="scene-placeholder" role="status">Preparing 3D dice…</p>}</> : <div className="dice-display" aria-hidden="true"><span>{result?.total ?? `d${sides}`}</span><small>{result ? `${result.values.length}d${result.sides}` : `${count}d${sides} · Preview`}</small></div>}
        <span className="dice-result-announcement" role="status" aria-live="polite" aria-atomic="true">{resultVisible && result ? `${result.values.length}D${result.sides}. Roll total: ${result.total}.` : ''}</span>
        {resultVisible && result && <div className="dice-result-overlay" key={result.id}>
          <div className="dice-result-backdrop" aria-hidden="true" />
          <div className="dice-result-card">
            <button type="button" className="dice-result-close" aria-label="Close result" onClick={dismissResult}><span aria-hidden="true">×</span></button>
            <p className="dice-result-label">Roll total</p>
            <strong className="dice-result-total">{result.total}</strong>
            <p className="dice-result-notation">{result.values.length}D{result.sides}</p>
            {result.values.length > 1 && <p className="dice-result-values"><span>Dice: </span>{result.values.join(' · ')}</p>}
          </div>
        </div>}
      </div>
      <div className="dice-controls" ref={controls}><label>Number of dice<input type="number" min="1" max="10" value={count} disabled={rolling} onChange={(event) => selectDice(sides, Math.max(1, Math.min(10, Math.trunc(Number(event.target.value)) || 1)))} /></label><Button onClick={roll} disabled={rolling}>{rolling ? 'Rolling…' : `Roll ${count}d${sides}`} <span aria-hidden="true">↗</span></Button>
      </div></div>
    {sceneFailed && <p className="form-note" role="status">3D visuals are unavailable. You can still roll dice and read the results.</p>}
    {history.length > 0 && <div className="roll-history"><span>Recent rolls</span>{history.map((roll) => <span className="roll-chip" key={roll.id} title={roll.values.join(', ')}>{roll.values.length}d{roll.sides} <strong>{roll.total}</strong></span>)}</div>}
    <p className="form-note dice-history-note">Recent rolls clear when you leave or reload. Dice color and tray background are saved in this browser.</p>
  </section>;
}
