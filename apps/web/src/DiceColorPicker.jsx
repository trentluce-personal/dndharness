import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ripple } from './ripple.js';

// Select-only combobox behavior follows EditionPicker; exploration is not a change.
export default function DiceColorPicker({ choices, value, onChange, disabled, label = 'Dice color' }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState({ above: false, height: 320 });
  const root = useRef(null);
  const trigger = useRef(null);
  const search = useRef({ text: '', time: 0 });
  const menuId = useId();
  const selectedIndex = Math.max(0, choices.findIndex((choice) => choice.id === value));
  const selected = choices[selectedIndex];
  const expanded = open && !disabled;

  useLayoutEffect(() => {
    if (!expanded) return;
    function positionMenu() {
      const bounds = trigger.current.getBoundingClientRect();
      const below = window.innerHeight - bounds.bottom - 16;
      const above = bounds.top - 16;
      const opensAbove = below < 320 && above > below;
      setPlacement({ above: opensAbove, height: Math.max(44, Math.min(320, opensAbove ? above : below)) });
    }
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    function dismiss(event) {
      if (!root.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const option = document.getElementById(`${menuId}-${activeIndex}`);
    const list = option?.parentElement;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [expanded, activeIndex, menuId, placement.height]);

  function choose(choice) {
    onChange(choice.id);
    setOpen(false);
    trigger.current.focus();
  }

  function handleKey(event) {
    const { key } = event;
    if (key === 'Escape') {
      if (expanded) event.preventDefault();
      setOpen(false);
    } else if (key === 'Tab') {
      setOpen(false);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      search.current.text = '';
      if (!expanded) {
        setActiveIndex(key === 'Home' ? 0 : key === 'End' ? choices.length - 1 : selectedIndex);
        setOpen(true);
      } else {
        setActiveIndex((index) => key === 'Home' ? 0 : key === 'End' ? choices.length - 1
          : (index + (key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length);
      }
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (event.repeat) return;
      ripple(event);
      if (expanded) choose(choices[activeIndex]);
      else { search.current.text = ''; setActiveIndex(selectedIndex); setOpen(true); }
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - search.current.time < 700 ? search.current.text : '') + key.toLowerCase();
      search.current = { text, time: now };
      const prefix = [...text].every((letter) => letter === text[0]) ? text[0] : text;
      const start = expanded ? activeIndex : selectedIndex;
      const match = choices.findIndex((_, offset) => choices[(start + offset + 1) % choices.length].label.toLowerCase().startsWith(prefix));
      if (match >= 0) {
        event.preventDefault();
        setActiveIndex((start + match + 1) % choices.length);
        setOpen(true);
      }
    }
  }

  return <div className="dice-color-picker" ref={root} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label id={`${menuId}-label`} htmlFor={`${menuId}-trigger`}>{label}</label>
    <button id={`${menuId}-trigger`} ref={trigger} className="edition-trigger dice-color-trigger" type="button" role="combobox"
      aria-labelledby={`${menuId}-label`} aria-expanded={expanded} aria-controls={menuId} aria-haspopup="listbox"
      aria-activedescendant={expanded ? `${menuId}-${activeIndex}` : undefined} disabled={disabled}
      onKeyDown={handleKey} onPointerDown={ripple}
      onClick={() => { search.current.text = ''; setActiveIndex(selectedIndex); setOpen(!expanded); }}>
      <span className="dice-color-value"><span className="dice-color-swatch" style={{ background: selected.background ?? selected.body }} aria-hidden="true" />{selected.label}</span>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    </button>
    {expanded && <div className={`edition-menu dice-color-menu${placement.above ? ' opens-above' : ''}`}>
      <ul id={menuId} role="listbox" aria-labelledby={`${menuId}-label`} style={{ maxHeight: placement.height - 18 }}>
        {choices.map((choice, index) => <li id={`${menuId}-${index}`} key={choice.id} role="option" aria-selected={choice.id === value}
          className={`edition-option dice-color-option${activeIndex === index ? ' is-active' : ''}`}
          onPointerMove={() => setActiveIndex(index)} onPointerDown={(event) => { ripple(event); event.preventDefault(); }} onClick={() => choose(choice)}>
          <span className="dice-color-swatch" style={{ background: choice.background ?? choice.body }} aria-hidden="true" />
          <span>{choice.label}</span><span className="dice-color-check" aria-hidden="true">{choice.id === value ? '✓' : ''}</span>
        </li>)}
      </ul>
    </div>}
  </div>;
}
