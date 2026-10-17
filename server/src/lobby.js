// Broadcasts the room list to every connected client and removes rooms that stay empty.
import { deleteRoom, getRoom, listRooms } from './roomStore.js';
import { clearRoom, countParticipants, getParticipants } from './presence.js';

const EMPTY_ROOM_TTL_MS = Number(process.env.EMPTY_ROOM_TTL_MINUTES || 5) * 60 * 1000;
const cleanupTimers = new Map();
let io = null;

export function initLobby(socketServer) {
  io = socketServer;
}

export function withPresence(room) {
  const participants = getParticipants(room.id).map(({ id, name }) => ({ id, name }));
  return { ...room, participants, participantCount: participants.length };
}

export async function getRoomsWithPresence() {
  return (await listRooms()).map(withPresence);
}

export async function broadcastRooms() {
  if (!io) return;
  try {
    io.emit('rooms', await getRoomsWithPresence());
  } catch (err) {
    console.error('Failed to broadcast rooms:', err);
  }
}

export function cancelCleanup(roomId) {
  clearTimeout(cleanupTimers.get(roomId));
  cleanupTimers.delete(roomId);
}

export function scheduleCleanup(room) {
  cancelCleanup(room.id);
  const timer = setTimeout(async () => {
    cleanupTimers.delete(room.id);
    if (countParticipants(room.id) > 0) return;
    await deleteRoom(room.id);
    await broadcastRooms();
  }, EMPTY_ROOM_TTL_MS);
  cleanupTimers.set(room.id, timer);
}

export async function scheduleCleanupForEmptyRooms() {
  for (const room of await listRooms()) {
    if (countParticipants(room.id) === 0) scheduleCleanup(room);
  }
}

// Deletes a room and sends anyone still in it back to the lobby.
export async function removeRoom(roomId) {
  cancelCleanup(roomId);
  await deleteRoom(roomId);
  if (io) {
    io.to(roomId).emit('room-deleted', { roomId });
    for (const socket of await io.in(roomId).fetchSockets()) {
      socket.data.roomId = null;
      socket.leave(roomId);
    }
  }
  clearRoom(roomId);
  await broadcastRooms();
}

export { getRoom };
