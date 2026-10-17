// End-to-end smoke test against a running server: REST API, room capacity and WebRTC signaling relay.
// Usage: node scripts/smoke-test.mjs [serverUrl]
import { io } from 'socket.io-client';

const URL = process.argv[2] || 'http://localhost:5000';
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const ok = (msg) => console.log(`✓ ${msg}`);

const json = async (path, options) => {
  const res = await fetch(URL + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  return { status: res.status, body: await res.json() };
};

const health = await json('/api/health');
if (!health.body.ok) fail('health check');
ok('health check');

const rooms = await json('/api/rooms');
if (!Array.isArray(rooms.body)) fail('lists rooms');
ok(`lists ${rooms.body.length} rooms`);

const bad = await json('/api/rooms', { method: 'POST', body: JSON.stringify({ name: '', maxParticipants: 50 }) });
if (bad.status !== 400) fail('rejects invalid room');
ok('rejects invalid room');

const created = await json('/api/rooms', {
  method: 'POST',
  body: JSON.stringify({ name: 'CI room', type: 'audio', maxParticipants: 2, createdBy: 'CI' }),
});
if (created.status !== 201 || !created.body.ownerToken) fail('creates room with owner token');
const room = created.body;
ok('creates room with owner token');

const listed = await json('/api/rooms');
if (JSON.stringify(listed.body).includes('ownerToken') || JSON.stringify(listed.body).includes(room.ownerToken)) {
  fail('room list never exposes owner tokens');
}
ok('room list hides owner tokens');

const connect = () => io(URL, { transports: ['websocket'] });
const join = (s, name) => new Promise((r) => s.emit('join-room', { roomId: room.id, name, audio: true }, r));
const once = (s, event) => new Promise((r) => s.once(event, r));
const a = connect();
const b = connect();
const c = connect();

const ra = await join(a, 'A');
if (ra.error || ra.peers.length !== 0) fail('first user joins empty room');
const peerJoined = once(a, 'peer-joined');
const rb = await join(b, 'B');
if (rb.error || rb.peers[0]?.name !== 'A') fail('second user sees first');
if ((await peerJoined).name !== 'B') fail('first user notified of second');
ok('join + presence');

const signal = once(a, 'signal');
b.emit('signal', { to: ra.self.id, data: { type: 'offer', sdp: { type: 'offer', sdp: 'v=0' } } });
const relayed = await signal;
if (relayed.from !== rb.self.id || relayed.data.type !== 'offer') fail('signal relayed');
ok('signaling relay');

const rc = await join(c, 'C');
if (!rc.error?.includes('full')) fail('capacity enforced');
ok('capacity enforced');

const left = once(a, 'peer-left');
b.disconnect();
if ((await left).id !== rb.self.id) fail('leave propagated');
ok('leave propagated');

const del = (token) => fetch(`${URL}/api/rooms/${room.id}`, { method: 'DELETE', headers: token ? { 'X-Owner-Token': token } : {} });
if ((await del()).status !== 403) fail('delete without token is rejected');
if ((await del('not-the-owner')).status !== 403) fail('delete with wrong token is rejected');
ok('only the creator can delete');

const kicked = once(a, 'room-deleted');
if ((await del(room.ownerToken)).status !== 204) fail('creator deletes room');
await kicked;
if ((await json(`/api/rooms/${room.id}`)).status !== 404) fail('deleted room is gone');
ok('creator deletes room, participants are notified');

a.disconnect();
c.disconnect();
console.log('All smoke tests passed');
process.exit(0);
