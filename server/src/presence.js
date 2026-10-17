// Live, in-memory record of who is currently in each room (keyed by socket id).
const rooms = new Map(); // roomId -> Map<socketId, participant>

export function getParticipants(roomId) {
  return [...(rooms.get(roomId)?.values() ?? [])];
}

export function countParticipants(roomId) {
  return rooms.get(roomId)?.size ?? 0;
}

export function hasParticipant(roomId, socketId) {
  return rooms.get(roomId)?.has(socketId) ?? false;
}

export function addParticipant(roomId, participant) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  rooms.get(roomId).set(participant.id, participant);
}

export function updateParticipant(roomId, socketId, patch) {
  const participant = rooms.get(roomId)?.get(socketId);
  if (participant) Object.assign(participant, patch);
  return participant;
}

export function removeParticipant(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return 0;
  room.delete(socketId);
  if (room.size === 0) rooms.delete(roomId);
  return room.size;
}
