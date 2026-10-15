import { useEffect, useRef, useState } from 'react';
import { importCharacterPdf } from './characterImport.js';

export default function CharacterImport({ onImport }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  return <div className="editor-form">
    <p className="form-note">D&amp;D Beyond form-fillable PDF · Up to 10 MB</p>
    <label className="import-file">Character sheet PDF<input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setError(''); setBusy(true);
      event.target.value = '';
      try { const result = await importCharacterPdf(file); if (live.current) onImport(result); }
      catch (error) { if (live.current) setError(error.message); }
      finally { if (live.current) setBusy(false); }
    }} /></label>
    {busy && <p role="status">Reading character sheet…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="form-note">The PDF stays on your device. Review the imported character before saving. Skills, attacks, spells, and features are kept in editable reference sections.</p>
  </div>;
}
