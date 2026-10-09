import { ripple } from './ripple.js';

export default function Button({ children, className = '', ...props }) {
  return <button type="button" {...props} className={`action-button ${className}`} onPointerDown={ripple}
    onKeyDown={(event) => { if (!event.repeat && ['Enter', ' '].includes(event.key)) ripple(event); }}>{children}</button>;
}
