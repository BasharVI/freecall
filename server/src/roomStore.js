// Persists room definitions in MongoDB, or in memory when MongoDB is unavailable.
import crypto from 'crypto';
import mongoose from 'mongoose';
import Room from './models/Room.js';

let useMongo = false;
const memory = new Map();

const DEFAULT_ROOMS = [
  { name: 'The Lounge', type: 'video', maxParticipants: 6 },
  { name: 'Study Hall', type: 'audio', maxParticipants: 8 },
  { name: 'One-on-One', type: 'video', maxParticipants: 2 },
  { name: 'Music & Chill', type: 'audio', maxParticipants: 4 },
];

function serialize(doc) {
  return {
    id: String(doc._id ?? doc.id),
    name: doc.name,
    type: doc.type,
    maxParticipants: doc.maxParticipants,
    permanent: doc.permanent,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  };
}

export async function initRooms(mongoConnected) {
  useMongo = mongoConnected;
  const count = useMongo ? await Room.countDocuments({ permanent: true }) : 0;
  if (count === 0) {
    for (const room of DEFAULT_ROOMS) await createRoom({ ...room, permanent: true, createdBy: 'FreeCall' });
  }
}

export async function listRooms() {
  if (useMongo) return (await Room.find().sort({ permanent: -1, createdAt: 1 }).lean()).map(serialize);
  return [...memory.values()]
    .sort((a, b) => b.permanent - a.permanent || a.createdAt - b.createdAt)
    .map(serialize);
}

export async function getRoom(id) {
  if (typeof id !== 'string') return null;
  if (useMongo) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Room.findById(id).lean();
    return doc ? serialize(doc) : null;
  }
  const doc = memory.get(id);
  return doc ? serialize(doc) : null;
}

export async function createRoom(data) {
  if (useMongo) return serialize(await Room.create(data));
  const doc = {
    id: crypto.randomUUID(),
    type: 'video',
    maxParticipants: 4,
    permanent: false,
    createdBy: 'Anonymous',
    ...data,
    createdAt: new Date(),
  };
  memory.set(doc.id, doc);
  return serialize(doc);
}

export async function deleteRoom(id) {
  if (useMongo) return Room.deleteOne({ _id: id });
  memory.delete(id);
}
