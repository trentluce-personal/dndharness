import { useEffect, useRef, useState } from 'react';
import CharacterForm from './CharacterForm.jsx';
import PersonalCharacterSheet from './PersonalCharacterSheet.jsx';

export default function PersonalCharacterPage({ character, editions, navigation, onSave, onDelete }) {
  const [busy, setBusy] = useState(false);
  const state = useRef({ dirty: false, busy: false });
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const editRef = useRef(null);
  const editorRef = useRef(null);
  const focusView = useRef(false);
  useEffect(() => () => navigation.protect({ dirty: false, busy: false }), []);
  useEffect(() => {
    if (editing) editorRef.current?.querySelector('input')?.focus();
    else if (focusView.current) { editRef.current?.focus(); focusView.current = false; }
  }, [editing]);
  function protection(update) {
    state.current = { ...state.current, ...update };
    navigation.protect(state.current);
  }
  function finishEditing() {
    protection({ dirty: false, busy: false });
    focusView.current = true;
    setEditing(false);
  }
  return <article className="personal-character-page" aria-busy={busy || undefined}>
    {editing ? <><header className="dashboard-intro character-page-heading"><p className="eyebrow">Edit personal character</p><h1>{character.name}</h1><p>Changes here update your personal library copy. Campaign sheets and saved checkpoints stay separate.</p></header>
    <section ref={editorRef} className="workspace-panel character-page-editor" aria-label="Edit personal character">
      <CharacterForm page exitLabel="Cancel editing" externalBusy={busy || navigation.actionBusy} character={character} editions={editions} onDirtyChange={(value) => { protection({ dirty: value }); if (value) setMessage(''); }} onBusyChange={(value) => { setBusy(value); protection({ busy: value }); }}
        onCancel={() => navigation.request({ run: finishEditing })}
        onSave={async (body) => { const saved = await onSave(body); setMessage('Character saved.'); finishEditing(); return saved; }}
        onDelete={async () => { setBusy(true); protection({ busy: true }); try { await onDelete(); } finally { setBusy(false); protection({ busy: false }); } }} />
    </section></> : <PersonalCharacterSheet character={character} editions={editions} editRef={editRef} onEdit={() => { setMessage(''); setEditing(true); }} />}
    {message && <p className="form-note" role="status">{message}</p>}
  </article>;
}
