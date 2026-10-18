import { useLayoutEffect, useId, useRef } from 'react';
import Button from './Button.jsx';

export default function Dialog({ title, onClose, children, className = '', busy = false, initialFocus, eyebrow = 'Your story, your way' }) {
  const ref = useRef(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    // Apply the requested target after native modal autofocus, before paint.
    // Callers returning from an editor can choose a deterministic read action.
    if (initialFocus) dialog.querySelector(initialFocus)?.focus();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`app-dialog ${className}`} aria-labelledby={titleId} aria-busy={busy || undefined} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (!busy && event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <header className="dialog-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div><Button className="icon-close secondary" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</Button></header>
    {children}
  </dialog>;
}
