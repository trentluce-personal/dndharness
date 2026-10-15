import { useEffect, useId, useRef } from 'react';
import Button from './Button.jsx';

export default function Dialog({ title, onClose, children, className = '', busy = false, initialFocus }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    if (initialFocus) dialog.querySelector(initialFocus)?.focus();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`app-dialog ${className}`} aria-labelledby={titleId} aria-busy={busy || undefined} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (!busy && event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <header className="dialog-header"><div><p className="eyebrow">Your story, your way</p><h2 id={titleId}>{title}</h2></div><Button className="icon-close secondary" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</Button></header>
    {children}
  </dialog>;
}
