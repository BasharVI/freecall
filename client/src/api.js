// Empty when the API is served from the same origin (dev proxy, Render, ngrok).
// Set VITE_SERVER_URL when the frontend is hosted separately (Vercel/Netlify).
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const res = await fetch(`${SERVER_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const api = {
  listRooms: () => request('/rooms'),
  getRoom: (id) => request(`/rooms/${id}`),
  createRoom: (data) => request('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  iceServers: () => request('/ice-servers').then((r) => r.iceServers),
};

const NAME_KEY = 'freecall:name';
export const getSavedName = () => localStorage.getItem(NAME_KEY) || '';
export const saveName = (name) => localStorage.setItem(NAME_KEY, name.trim());
