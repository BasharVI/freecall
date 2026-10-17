// WebRTC signaling + room presence. Media never passes through this server:
// peers exchange SDP offers/answers and ICE candidates here, then stream directly to each other.
import {
  addParticipant,
  countParticipants,
  getParticipants,
  hasParticipant,
  removeParticipant,
  updateParticipant,
} from './presence.js';
import { broadcastRooms, cancelCleanup, getRoom, scheduleCleanup } from './lobby.js';

function cleanName(name) {
  return String(name ?? '').trim().slice(0, 30) || 'Guest';
}

async function leaveCurrentRoom(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  socket.data.roomId = null;
  socket.leave(roomId);
  const remaining = removeParticipant(roomId, socket.id);
  socket.to(roomId).emit('peer-left', { id: socket.id });
  if (remaining === 0) {
    const room = await getRoom(roomId);
    if (room) scheduleCleanup(room);
  }
  await broadcastRooms();
}

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    socket.data.roomId = null;

    socket.on('join-room', async ({ roomId, name, audio, video } = {}, ack) => {
      if (typeof ack !== 'function') return;
      try {
        if (socket.data.roomId) await leaveCurrentRoom(socket);

        const room = await getRoom(roomId);
        if (!room) return ack({ error: 'This room no longer exists.' });
        if (countParticipants(room.id) >= room.maxParticipants) {
          return ack({ error: `This room is full (${room.maxParticipants}/${room.maxParticipants}).` });
        }

        const participant = { id: socket.id, name: cleanName(name), audio: !!audio, video: !!video, screen: false };
        const peers = getParticipants(room.id);

        addParticipant(room.id, participant);
        socket.data.roomId = room.id;
        socket.join(room.id);
        cancelCleanup(room.id);

        // The newcomer initiates a peer connection to each existing peer.
        ack({ room, self: participant, peers });
        socket.to(room.id).emit('peer-joined', participant);
        await broadcastRooms();
      } catch (err) {
        console.error('join-room failed:', err);
        ack({ error: 'Could not join the room.' });
      }
    });

    // Relay SDP / ICE messages, but only between members of the same room.
    socket.on('signal', ({ to, data } = {}) => {
      const roomId = socket.data.roomId;
      if (!roomId || !hasParticipant(roomId, to) || !data) return;
      io.to(to).emit('signal', { from: socket.id, data });
    });

    socket.on('media-state', ({ audio, video, screen } = {}) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const participant = updateParticipant(roomId, socket.id, {
        audio: !!audio,
        video: !!video,
        screen: !!screen,
      });
      if (participant) socket.to(roomId).emit('peer-updated', participant);
    });

    socket.on('leave-room', () => leaveCurrentRoom(socket));
    socket.on('disconnect', () => leaveCurrentRoom(socket));
  });
}
