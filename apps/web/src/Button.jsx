import { ripple } from './ripple.js';

export default function Button({ children, className = '', onPointerDown, onKeyDown, ...props }) {
  const showRipple = (event) => {
    if (!props.disabled && !className.split(/\s+/).includes('text-button')) ripple(event);
  };
  return <button type="button" {...props} className={`action-button ${className}`} onPointerDown={(event) => { showRipple(event); onPointerDown?.(event); }}
    onKeyDown={(event) => { if (!event.repeat && ['Enter', ' '].includes(event.key)) showRipple(event); onKeyDown?.(event); }}><span className="button-label">{children}</span></button>;
}
