import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, forgetOwnerToken, getOwnerToken, getSavedName, saveName, saveOwnerToken } from '../api.js';
import { getSocket } from '../socket.js';
import CreateRoomModal from '../components/CreateRoomModal.jsx';
import RoomCard from '../components/RoomCard.jsx';
import Icon from '../components/Icon.jsx';

const FILTERS = [
  { id: 'all', label: 'All rooms' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
];

export default function Lobby() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [name, setName] = useState(getSavedName);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    api.listRooms()
      .then(setRooms)
      .catch((err) => setError(`Couldn’t load rooms: ${err.message}`))
      .finally(() => setLoading(false));
    // Live updates whenever someone joins/leaves or a room is created/removed.
    socket.on('rooms', setRooms);
    return () => socket.off('rooms', setRooms);
  }, []);

  const visible = useMemo(() => rooms.filter((r) => filter === 'all' || r.type === filter), [rooms, filter]);
  const online = rooms.reduce((n, r) => n + r.participantCount, 0);

  async function createRoom(data) {
    const room = await api.createRoom({ ...data, createdBy: name || 'Anonymous' });
    saveOwnerToken(room.id, room.ownerToken);
    navigate(`/room/${room.id}`);
  }

  async function deleteRoom(room) {
    const people = room.participantCount;
    const warning = people > 0 ? `\n\n${people} ${people === 1 ? 'person is' : 'people are'} in it and will be disconnected.` : '';
    if (!window.confirm(`Delete "${room.name}"?${warning}`)) return;
    try {
      await api.deleteRoom(room.id, getOwnerToken(room.id));
      forgetOwnerToken(room.id);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="lobby">
      <header className="topbar">
        <div className="brand">
          <span className="brand__logo"><Icon name="video" size={18} /></span>
          FreeCall
        </div>
        <label className="name-input">
          <span>Your name</span>
          <input
            value={name}
            maxLength={30}
            placeholder="Enter a display name"
            onChange={(e) => { setName(e.target.value); saveName(e.target.value); }}
          />
        </label>
      </header>

      <section className="hero">
        <div>
          <h1>Jump into a room</h1>
          <p className="muted">
            {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'} · {online} {online === 1 ? 'person' : 'people'} talking right now
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={18} /> Create room
        </button>
      </section>

      <nav className="filters">
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip ${filter === f.id ? 'chip--active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Loading rooms…</p>
      ) : visible.length === 0 ? (
        <div className="empty">
          <p>No rooms yet. Create one and invite your friends.</p>
          <button className="btn btn--ghost" onClick={() => setShowCreate(true)}>Create the first one</button>
        </div>
      ) : (
        <div className="room-grid">
          {visible.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onJoin={(r) => navigate(`/room/${r.id}`)}
              onDelete={getOwnerToken(room.id) ? deleteRoom : undefined}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} onCreate={createRoom} />}
    </div>
  );
}
