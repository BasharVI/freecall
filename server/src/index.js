import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { connectDB } from './db.js';
import { initRooms } from './roomStore.js';
import { initLobby, scheduleCleanupForEmptyRooms } from './lobby.js';
import { registerSocketHandlers } from './socket.js';
import roomsRouter from './routes/rooms.js';

const PORT = process.env.PORT || 5000;
// Comma-separated list of frontends allowed to call the API (e.g. your Vercel/Netlify URL).
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ICE servers handed to browsers. STUN discovers public addresses; TURN relays media
// when a direct peer-to-peer path is impossible (symmetric NATs, corporate firewalls).
app.get('/api/ice-servers', (_req, res) => {
  const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL.split(',').map((u) => u.trim()),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }
  res.json({ iceServers });
});

app.use('/api/rooms', roomsRouter);

// Serve the built React app in production.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });

const mongoConnected = await connectDB();
await initRooms(mongoConnected);
initLobby(io);
registerSocketHandlers(io);
await scheduleCleanupForEmptyRooms();

server.listen(PORT, () => console.log(`FreeCall server listening on http://localhost:${PORT}`));
