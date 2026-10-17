import Icon from './Icon.jsx';

export default function RoomCard({ room, onJoin, onDelete, onShare }) {
  const full = room.participantCount >= room.maxParticipants;
  const fillPct = (room.participantCount / room.maxParticipants) * 100;

  return (
    <article className="room-card">
      <header className="room-card__head">
        <span className={`badge badge--${room.type}`}>
          <Icon name={room.type === 'video' ? 'video' : 'headphones'} size={14} />
          {room.type === 'video' ? 'Video' : 'Audio'}
        </span>
        {onDelete && <span className="badge badge--muted">Your room</span>}
        <div className="room-card__actions">
          <button className="icon-btn" onClick={() => onShare(room)} title="Share room link" aria-label="Share room link">
            <Icon name="share" size={18} />
          </button>
          {onDelete && (
            <button className="icon-btn icon-btn--danger" onClick={() => onDelete(room)} title="Delete room" aria-label="Delete room">
              <Icon name="trash" size={18} />
            </button>
          )}
        </div>
      </header>

      <h3 className="room-card__title">{room.name}</h3>
      <p className="room-card__meta">by {room.createdBy}</p>

      <div className="capacity" aria-label={`${room.participantCount} of ${room.maxParticipants} people`}>
        <div className="capacity__bar"><span style={{ width: `${fillPct}%` }} /></div>
        <span className="capacity__label"><Icon name="users" size={14} /> {room.participantCount}/{room.maxParticipants}</span>
      </div>

      <div className="room-card__people">
        {room.participants.length === 0 ? (
          <span className="muted">Nobody here yet</span>
        ) : (
          room.participants.slice(0, 5).map((p) => (
            <span key={p.id} className="avatar avatar--xs" title={p.name}>{p.name[0]?.toUpperCase()}</span>
          ))
        )}
        {room.participants.length > 5 && <span className="muted">+{room.participants.length - 5}</span>}
      </div>

      <button className="btn btn--primary btn--block" disabled={full} onClick={() => onJoin(room)}>
        {full ? 'Room full' : 'Join room'}
      </button>
    </article>
  );
}
