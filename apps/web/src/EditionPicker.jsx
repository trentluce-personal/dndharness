import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ripple } from './ripple.js';

export default function EditionPicker({ editions, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [above, setAbove] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const menuId = useId();
  const selected = editions.find((edition) => edition.id === value);
  const selectedIndex = Math.max(0, editions.findIndex((edition) => edition.id === value));

  useLayoutEffect(() => {
    if (!open) return;
    function positionMenu() {
      const bounds = trigger.current.getBoundingClientRect();
      const height = root.current.querySelector('.edition-menu').offsetHeight;
      setAbove(window.innerHeight - bounds.bottom < height + 16 && bounds.top > height + 16);
    }
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event) {
      if (!root.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const option = document.getElementById(`${menuId}-${activeIndex}`);
    const list = option?.parentElement;
    if (option && list) {
      if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
      else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
      }
    }
  }, [open, activeIndex, menuId]);

  function choose(edition) {
    onChange(edition.id);
    setOpen(false);
    trigger.current.focus();
  }

  function handleKey(event) {
    const { key } = event;
    if (key === 'Escape') {
      if (open) event.preventDefault();
      setOpen(false);
    } else if (key === 'Tab') {
      setOpen(false);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      if (!open) {
        setActiveIndex(key === 'Home' ? 0 : key === 'End' ? editions.length - 1 : selectedIndex);
        setOpen(true);
      } else {
        setActiveIndex((index) => key === 'Home' ? 0 : key === 'End' ? editions.length - 1
          : (index + (key === 'ArrowDown' ? 1 : -1) + editions.length) % editions.length);
      }
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (event.repeat) return;
      ripple(event);
      if (open) choose(editions[activeIndex]);
      else { setActiveIndex(selectedIndex); setOpen(true); }
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const match = editions.findIndex((edition, index) => index > activeIndex && edition.name.toLowerCase().startsWith(key.toLowerCase()));
      const fallback = editions.findIndex((edition) => edition.name.toLowerCase().startsWith(key.toLowerCase()));
      if (match >= 0 || fallback >= 0) {
        event.preventDefault();
        setActiveIndex(match >= 0 ? match : fallback);
        setOpen(true);
      }
    }
  }

  return (
    <div className="edition-picker" ref={root} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label id={`${menuId}-label`} htmlFor="edition">D&amp;D edition</label>
      <button
        id="edition"
        ref={trigger}
        className="edition-trigger"
        type="button"
        role="combobox"
        aria-labelledby={`${menuId}-label`}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${menuId}-${activeIndex}` : undefined}
        disabled={!editions.length}
        onKeyDown={handleKey}
        onPointerDown={ripple}
        onClick={() => { setActiveIndex(selectedIndex); setOpen(!open); }}
      >
        <span>{selected ? `${selected.name}${selected.isDefault ? ' (Default)' : ''}` : 'No editions available'}</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      {open && (
        <div className={`edition-menu${above ? ' opens-above' : ''}`}>
          <p className="menu-heading" aria-hidden="true">Find your ruleset</p>
          <ul id={menuId} role="listbox" aria-labelledby={`${menuId}-label`}>
            {editions.map((edition, index) => (
              <li
                id={`${menuId}-${index}`}
                key={edition.id}
                role="option"
                aria-selected={edition.id === value}
                className={`edition-option${activeIndex === index ? ' is-active' : ''}`}
                onPointerMove={() => setActiveIndex(index)}
                onPointerDown={(event) => { ripple(event); event.preventDefault(); }}
                onClick={() => choose(edition)}
              >
                <span className="option-symbol" aria-hidden="true">{edition.id === value ? '✓' : '✧'}</span>
                <span className="option-copy">
                  <span className="option-title">{edition.name}{edition.isDefault && <span className="default-badge">Default</span>}</span>
                  <span className="option-description">{edition.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
