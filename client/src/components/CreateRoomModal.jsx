import { useState } from 'react';
import Icon from './Icon.jsx';

export default function CreateRoomModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('video');
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Give your room a name');
    setBusy(true);
    setError('');
    try {
      await onCreate({ name: name.trim(), type, maxParticipants });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <header className="modal__head">
          <h2>Create a room</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>

        <label className="field">
          <span>Room name</span>
          <input autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday standup" />
        </label>

        <div className="field">
          <span>Call type</span>
          <div className="segmented">
            {['video', 'audio'].map((t) => (
              <button type="button" key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
                <Icon name={t === 'video' ? 'video' : 'headphones'} size={16} />
                {t === 'video' ? 'Video' : 'Audio only'}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Max participants: <strong>{maxParticipants}</strong></span>
          <input type="range" min={2} max={8} value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} />
          <small className="muted">Calls are peer-to-peer, so rooms are capped at 8 people for good quality.</small>
        </label>

        {error && <p className="error">{error}</p>}

        <footer className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Creating…' : 'Create & join'}</button>
        </footer>
      </form>
    </div>
  );
}
