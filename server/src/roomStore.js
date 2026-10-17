// Persists room definitions in MongoDB, or in memory when MongoDB is unavailable.
import crypto from 'crypto';
import mongoose from 'mongoose';
import Room from './models/Room.js';

let useMongo = false;
const memory = new Map();

function serialize(doc) {
  return {
    id: String(doc._id ?? doc.id),
    name: doc.name,
    type: doc.type,
    maxParticipants: doc.maxParticipants,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  };
}

export function initRooms(mongoConnected) {
  useMongo = mongoConnected;
}

// Only a hash of the owner token is stored, so a database leak can't be used to delete rooms.
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function getOwnerTokenHash(id) {
  if (useMongo) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Room.findById(id).select('+ownerTokenHash').lean();
    return doc?.ownerTokenHash ?? null;
  }
  return memory.get(id)?.ownerTokenHash ?? null;
}

export async function listRooms() {
  if (useMongo) return (await Room.find().sort({ createdAt: -1 }).lean()).map(serialize);
  return [...memory.values()].sort((a, b) => b.createdAt - a.createdAt).map(serialize);
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
