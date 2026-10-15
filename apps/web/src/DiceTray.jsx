import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import Button from './Button.jsx';
import { dice3dThemes } from '@dndharness/dice-3d/theme';
import { reportedValues } from '@dndharness/dice-3d/results';

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
  const [sides, setSides] = useState(20); const [count, setCount] = useState(1); const [modifier, setModifier] = useState(0);
  const [rolling, setRolling] = useState(false); const [result, setResult] = useState(null); const [history, setHistory] = useState([]);
  const [preferences, setPreferences] = useState(() => ({ theme: document.documentElement.dataset.theme ?? 'light', motion: document.documentElement.dataset.motion ?? 'full' }));
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [sceneRoll, setSceneRoll] = useState(null);
  const pending = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const use3d = preferences.motion !== 'reduce' && !sceneFailed;
  function finish() {
    const next = pending.current;
    if (!next) return;
    pending.current = null; clearTimeout(timer.current);
    setResult(next); setHistory((current) => [next, ...current].slice(0, 5)); setRolling(false);
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
    const observer = new MutationObserver(() => {
      // Clear the old throw before mounting a replacement scene. Otherwise
      // enabling motion can replay it while the next roll is already starting.
      finish();
      setSceneReady(false);
      setSceneRoll(null);
      setPreferences({ theme: document.documentElement.dataset.theme ?? 'light', motion: document.documentElement.dataset.motion ?? 'full' });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-motion'] });
    return () => observer.disconnect();
  }, []);
  function roll() {
    if (pending.current) return;
    const values = Array.from({ length: count }, () => randomDie(sides));
    const next = { id: crypto.randomUUID(), sides, values, modifier, total: values.reduce((a, b) => a + b, modifier) };
    pending.current = next;
    if (!use3d) finish();
    else { setRolling(true); setSceneRoll(next); timer.current = setTimeout(failScene, 15000); }
  }
  return <section className={`dice-tray${welcoming ? ' welcoming-dice' : ''}`} aria-labelledby="dice-heading">
    <div className="section-heading"><div><p className="eyebrow">{welcoming ? 'Dice roller · No account needed' : 'A little chance'}</p><h2 id="dice-heading">{welcoming ? 'Try your luck.' : 'Dice roller'}</h2></div><span className="quiet-badge">Only visible to you</span></div>
    <p className="form-note">Die type · d20 = 20 sides</p>
    <div className="dice-types" aria-label="Die type">{[4, 6, 8, 10, 12, 20, 100].map((value) => <Button key={value} className={`die-choice secondary ${sides === value ? 'selected' : ''}`} aria-pressed={sides === value} disabled={rolling} onClick={() => setSides(value)}>d{value}</Button>)}</div>
    <div className={`dice-workbench${use3d ? ' has-3d' : ''}`}>
      {use3d ? <div className="dice-scene-frame"><SceneBoundary onError={failScene}><Suspense fallback={null}><DiceScene key={preferences.theme} roll={sceneRoll} theme={dice3dThemes[preferences.theme]} onReady={() => setSceneReady(true)} onSettled={settled} onError={failScene} /></Suspense></SceneBoundary>{!sceneReady && <p className="scene-placeholder" role="status">Preparing 3D dice…</p>}{sceneReady && !sceneRoll && <p className="scene-placeholder">Choose your dice, then roll.</p>}</div> : <div className="dice-display" aria-hidden="true"><span>{result?.total ?? '20'}</span><small>{result ? `${result.values.length}d${result.sides}` : 'Ready when you are'}</small></div>}
      <div className="dice-controls"><div className="form-grid"><label>Number of dice<input type="number" min="1" max="10" value={count} disabled={rolling} onChange={(event) => setCount(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} /></label><label>Modifier<input type="number" min="-100" max="100" value={modifier} aria-describedby="modifier-hint" disabled={rolling} onChange={(event) => setModifier(Math.max(-100, Math.min(100, Number(event.target.value) || 0)))} /><span id="modifier-hint" className="field-hint">Added to the total. Use 0 for none.</span></label></div><Button onClick={roll} disabled={rolling}>{rolling ? 'Rolling…' : `Roll ${count}d${sides}`} <span aria-hidden="true">↗</span></Button>
        <p className="roll-result" role="status" aria-live="polite">{rolling ? 'Rolling the dice…' : result ? `${result.values.join(' + ')}${result.modifier ? ` ${result.modifier > 0 ? '+' : '−'} ${Math.abs(result.modifier)}` : ''} = ${result.total}` : 'Your result will appear here.'}</p>
      </div></div>
    {sceneFailed && <p className="form-note" role="status">3D visuals are unavailable. You can still roll dice and read the results.</p>}
    {history.length > 0 && <div className="roll-history"><span>Recent rolls</span>{history.map((roll) => <span className="roll-chip" key={roll.id} title={`${roll.values.join(', ')}; modifier ${roll.modifier}`}>{roll.values.length}d{roll.sides} <strong>{roll.total}</strong></span>)}</div>}
    <p className="form-note">Rolls are not shared with the group or saved to a campaign. Recent rolls clear when you leave this view or reload.</p>
  </section>;
}
