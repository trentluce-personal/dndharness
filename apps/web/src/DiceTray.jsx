import { useEffect, useRef, useState } from 'react';
import Button from './Button.jsx';

function randomDie(sides) {
  const limit = Math.floor(4294967296 / sides) * sides;
  const data = new Uint32Array(1);
  do { crypto.getRandomValues(data); } while (data[0] >= limit);
  return data[0] % sides + 1;
}
export default function DiceTray() {
  const [sides, setSides] = useState(20); const [count, setCount] = useState(1); const [modifier, setModifier] = useState(0);
  const [rolling, setRolling] = useState(false); const [result, setResult] = useState(null); const [history, setHistory] = useState([]);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function roll() {
    const values = Array.from({ length: count }, () => randomDie(sides));
    const next = { id: crypto.randomUUID(), sides, values, modifier, total: values.reduce((a, b) => a + b, modifier) };
    const finish = () => { setResult(next); setHistory((current) => [next, ...current].slice(0, 5)); setRolling(false); };
    if (document.documentElement.dataset.motion === 'reduce') finish();
    else { setRolling(true); timer.current = setTimeout(finish, 650); }
  }
  return <section className="dice-tray" aria-labelledby="dice-heading">
    <div className="section-heading"><div><p className="eyebrow">A little chance</p><h2 id="dice-heading">Let the dice decide.</h2></div><span className="quiet-badge">Local rolls</span></div>
    <div className="dice-types" aria-label="Die type">{[4, 6, 8, 10, 12, 20, 100].map((value) => <Button key={value} className={`die-choice secondary ${sides === value ? 'selected' : ''}`} aria-pressed={sides === value} disabled={rolling} onClick={() => setSides(value)}>d{value}</Button>)}</div>
    <div className="dice-workbench"><div className={`dice-display${rolling ? ' is-rolling' : ''}`} aria-hidden="true"><span>{rolling ? '✧' : result?.total ?? '20'}</span><small>{rolling ? 'Fate is turning' : result ? `${result.values.length}d${result.sides}` : 'Ready when you are'}</small></div>
      <div className="dice-controls"><div className="form-grid"><label>Dice<input type="number" min="1" max="10" value={count} disabled={rolling} onChange={(event) => setCount(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} /></label><label>Modifier<input type="number" min="-100" max="100" value={modifier} disabled={rolling} onChange={(event) => setModifier(Math.max(-100, Math.min(100, Number(event.target.value) || 0)))} /></label></div><Button onClick={roll} disabled={rolling}>{rolling ? 'Rolling…' : `Roll ${count}d${sides}`} <span aria-hidden="true">↗</span></Button>
        <p className="roll-result" role="status" aria-live="polite">{rolling ? 'Rolling the dice…' : result ? `${result.values.join(' + ')}${result.modifier ? ` ${result.modifier > 0 ? '+' : '−'} ${Math.abs(result.modifier)}` : ''} = ${result.total}` : 'A little uncertainty makes a good story.'}</p>
      </div></div>
    {history.length > 0 && <div className="roll-history"><span>Recent rolls</span>{history.map((roll) => <span className="roll-chip" key={roll.id} title={`${roll.values.join(', ')}; modifier ${roll.modifier}`}>{roll.values.length}d{roll.sides} <strong>{roll.total}</strong></span>)}</div>}
    <p className="form-note">Visual rolls, not shared campaign events. History lasts for this page session.</p>
  </section>;
}
