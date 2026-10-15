import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button.jsx';
import Dialog from './Dialog.jsx';

export default function DeleteCharacter({ name, disabled, onDelete, compact = false }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const deleting = useRef(false);
  function cancel() { if (!deleting.current) setConfirm(false); }
  return <div className={`character-delete${compact ? ' character-delete-compact' : ''}`}>
    <Button className={`text-button${compact ? ' small' : ''}`} disabled={disabled || busy} onClick={() => { setError(''); setConfirm(true); }}>Delete character</Button>
    {confirm && createPortal(<Dialog title="Are you sure you want to delete?" busy={busy} initialFocus=".delete-cancel" onClose={cancel}>
      <p>Remove <strong>{name}</strong> from your personal character library? You won’t be able to edit this personal sheet or use it to join another campaign.</p>
      <p>Existing campaign copies, party membership, and saved checkpoints are preserved. This cannot be undone in the app.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><Button className="secondary delete-cancel" disabled={busy} onClick={cancel}>Cancel</Button><Button disabled={busy} onClick={async () => {
        if (deleting.current) return;
        deleting.current = true; setBusy(true); setError('');
        try { await onDelete(); setConfirm(false); } catch (error) { setError(error.message); }
        finally { deleting.current = false; setBusy(false); }
      }}>{busy ? 'Deleting…' : 'Delete character'}</Button></div>
    </Dialog>, document.body)}
  </div>;
}
