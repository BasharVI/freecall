// Empty when the API is served from the same origin (dev proxy, Render, ngrok).
// Set VITE_SERVER_URL when the frontend is hosted separately (Vercel/Netlify).
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(`${SERVER_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...headers },
    ...rest,
  });
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const api = {
  listRooms: () => request('/rooms'),
  getRoom: (id) => request(`/rooms/${id}`),
  createRoom: (data) => request('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  deleteRoom: (id, ownerToken) =>
    request(`/rooms/${id}`, { method: 'DELETE', headers: { 'X-Owner-Token': ownerToken } }),
  iceServers: () => request('/ice-servers').then((r) => r.iceServers),
};

// Owner tokens for rooms created in this browser: { [roomId]: token }.
const OWNED_KEY = 'freecall:owned-rooms';
const readOwned = () => {
  try {
    return JSON.parse(localStorage.getItem(OWNED_KEY)) || {};
  } catch {
    return {};
  }
};
export const getOwnerToken = (roomId) => readOwned()[roomId];
export const saveOwnerToken = (roomId, token) =>
  localStorage.setItem(OWNED_KEY, JSON.stringify({ ...readOwned(), [roomId]: token }));
export const forgetOwnerToken = (roomId) => {
  const owned = readOwned();
  delete owned[roomId];
  localStorage.setItem(OWNED_KEY, JSON.stringify(owned));
};

const NAME_KEY = 'freecall:name';
export const getSavedName = () => localStorage.getItem(NAME_KEY) || '';
export const saveName = (name) => localStorage.setItem(NAME_KEY, name.trim());
