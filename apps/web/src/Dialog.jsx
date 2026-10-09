import { useEffect, useRef } from 'react';
import Button from './Button.jsx';

export default function Dialog({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="app-dialog" aria-labelledby="dialog-title" onCancel={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <header className="dialog-header"><div><p className="eyebrow">Your story, your way</p><h2 id="dialog-title">{title}</h2></div><Button className="icon-close secondary" aria-label="Close dialog" onClick={onClose}>×</Button></header>
    {children}
  </dialog>;
}
