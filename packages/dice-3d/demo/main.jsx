import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DiceScene, parchment, obsidian } from '../src/index.js';
import './demo.css';

const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100];

function randomDie(sides) {
  const limit = Math.floor(4294967296 / sides) * sides;
  const data = new Uint32Array(1);
  do { crypto.getRandomValues(data); } while (data[0] >= limit);
  return data[0] % sides + 1;
}

function reportedValues(sides, count, results) {
  if (!results?.sets) return null;
  if (sides === 100) {
    const tensSet = results.sets.find((set) => set.type === 'd100');
    const unitsSet = results.sets.find((set) => set.type === 'd10');
    if (!tensSet || !unitsSet) return null;
    const values = [];
    for (let i = 0; i < count; i++) {
      const rawTens = tensSet.rolls[i]?.value;
      const rawUnits = unitsSet.rolls[i]?.value;
      if (rawTens == null || rawUnits == null) return null;
      const tens = rawTens <= 9 ? rawTens : rawTens === 100 ? 0 : rawTens / 10;
      const units = rawUnits === 10 || rawUnits === 0 ? 0 : rawUnits;
      values.push(tens === 0 && units === 0 ? 100 : tens * 10 + units);
    }
    return values;
  }
  const set = results.sets.find((entry) => entry.type === `d${sides}`);
  if (!set || set.rolls.length !== count) return null;
  return set.rolls.map((entry) => (sides === 10 && entry.value === 0 ? 10 : entry.value));
}

function arraysEqual(a, b) {
  return !!a && !!b && a.length === b.length && a.every((value, index) => value === b[index]);
}

function App() {
  const [sides, setSides] = useState(20);
  const [count, setCount] = useState(2);
  const [dark, setDark] = useState(false);
  const [rollState, setRollState] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [verify, setVerify] = useState(null);
  const [busy, setBusy] = useState(false);
  const settleRef = useRef(null);
  const pendingRef = useRef(null);

  function onSettled(results) {
    const pending = pendingRef.current;
    const reported = pending ? reportedValues(pending.sides, pending.count, results) : null;
    setOutcome(pending ? { ...pending, reported, error: results === null } : null);
    const settle = settleRef.current;
    settleRef.current = null;
    settle?.(results);
  }

  function rollOnce(nextRoll, pending) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        resolve(value);
      };
      settleRef.current = finish;
      pendingRef.current = pending;
      setRollState(nextRoll);
      setTimeout(() => finish(null), 30000);
    });
  }

  async function roll() {
    if (busy) return;
    setBusy(true);
    setVerify(null);
    const values = Array.from({ length: count }, () => randomDie(sides));
    const results = await rollOnce({ id: crypto.randomUUID(), sides, values }, { sides, count, values });
    void results;
    setBusy(false);
  }

  async function verifyRolls(times) {
    if (busy) return;
    setBusy(true);
    let pass = 0;
    const failures = [];
    for (let i = 0; i < times; i++) {
      const values = Array.from({ length: count }, () => randomDie(sides));
      const pending = { sides, count, values };
      const results = await rollOnce({ id: crypto.randomUUID(), sides, values }, pending);
      const reported = reportedValues(sides, count, results);
      if (arraysEqual(values, reported)) pass += 1;
      else failures.push({ values, reported });
    }
    setVerify({ pass, total: times, failures, sides, count });
    setBusy(false);
  }

  function onReady(box) {
    window.__diceBox = box;
  }

  const theme = dark ? obsidian : parchment;

  return (
    <main className={dark ? 'demo-page is-dark' : 'demo-page'}>
      <header className="demo-header">
        <div>
          <p className="demo-eyebrow">@dndharness/dice-3d</p>
          <h1>3D dice spike</h1>
        </div>
        <button type="button" className="demo-ghost" onClick={() => setDark((value) => !value)}>
          {dark ? 'Obsidian theme' : 'Parchment theme'}
        </button>
      </header>
      <p className="demo-note">
        Values come from crypto.getRandomValues with rejection sampling before the animation starts.
        The dice are forced to land on those values; the library result is only read back for verification.
      </p>
      <div className="demo-controls">
        <div className="demo-dice-types" role="group" aria-label="Die type">
          {DIE_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              className={sides === value ? 'demo-die is-selected' : 'demo-die'}
              aria-pressed={sides === value}
              disabled={busy}
              onClick={() => setSides(value)}
            >
              d{value}
            </button>
          ))}
        </div>
        <label className="demo-count">
          Number of dice
          <input
            type="number"
            min="1"
            max="10"
            value={count}
            disabled={busy}
            onChange={(event) => setCount(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
          />
        </label>
        <div className="demo-actions">
          <button type="button" className="demo-primary" onClick={roll} disabled={busy}>
            {busy ? 'Rolling…' : `Roll ${count}d${sides}`}
          </button>
          <button type="button" className="demo-secondary" onClick={() => verifyRolls(10)} disabled={busy}>
            Verify 10 rolls
          </button>
        </div>
      </div>
      <DiceScene roll={rollState} theme={theme} onSettled={onSettled} onReady={onReady} />
      <section className="demo-readout" aria-live="polite">
        {outcome ? (
          <>
            <div className="demo-row">
              <span>Forced</span>
              <strong>{outcome.values.join(' + ')}</strong>
            </div>
            <div className="demo-row">
              <span>Reported</span>
              <strong>{outcome.reported ? outcome.reported.join(' + ') : outcome.error ? 'scene error' : 'unreadable'}</strong>
            </div>
            <div className={`demo-verdict ${arraysEqual(outcome.values, outcome.reported) ? 'is-pass' : 'is-fail'}`}>
              {arraysEqual(outcome.values, outcome.reported)
                ? 'Dice landed on the forced values.'
                : 'Reported values differ from the forced values.'}
            </div>
          </>
        ) : (
          <p>Roll to see the forced and reported values side by side.</p>
        )}
        {verify && (
          <div className={`demo-verdict ${verify.pass === verify.total ? 'is-pass' : 'is-fail'}`}>
            Verification: {verify.pass}/{verify.total} correct for {verify.count}d{verify.sides}.
            {verify.failures.length > 0 && (
              <ul>
                {verify.failures.map((failure, index) => (
                  <li key={index}>forced {failure.values.join(',')} — reported {(failure.reported ?? []).join(',')}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('demo-root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
