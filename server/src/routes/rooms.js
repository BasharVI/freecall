import crypto from 'crypto';
import { Router } from 'express';
import { createRoom, getOwnerTokenHash, hashToken } from '../roomStore.js';
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS, ROOM_TYPES } from '../models/Room.js';
import { broadcastRooms, getRoom, getRoomsWithPresence, removeRoom, scheduleCleanup, withPresence } from '../lobby.js';

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await getRoomsWithPresence());
});

router.get('/:id', async (req, res) => {
  const room = await getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(withPresence(room));
});

router.post('/', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const type = req.body?.type ?? 'video';
  const maxParticipants = Number(req.body?.maxParticipants ?? 4);
  const createdBy = String(req.body?.createdBy ?? '').trim().slice(0, 30) || 'Anonymous';

  if (!name || name.length > 40) return res.status(400).json({ error: 'Room name must be 1–40 characters' });
  if (!ROOM_TYPES.includes(type)) return res.status(400).json({ error: 'Room type must be "video" or "audio"' });
  if (!Number.isInteger(maxParticipants) || maxParticipants < MIN_PARTICIPANTS || maxParticipants > MAX_PARTICIPANTS) {
    return res.status(400).json({ error: `Max participants must be between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS}` });
  }

  // The creator's browser keeps this token; it's the only way to delete the room later.
  const ownerToken = crypto.randomBytes(24).toString('hex');
  const room = await createRoom({ name, type, maxParticipants, createdBy, ownerTokenHash: hashToken(ownerToken) });
  scheduleCleanup(room); // removed if nobody ever joins
  await broadcastRooms();
  res.status(201).json({ ...withPresence(room), ownerToken });
});

router.delete('/:id', async (req, res) => {
  const storedHash = await getOwnerTokenHash(req.params.id);
  if (!storedHash) return res.status(404).json({ error: 'Room not found' });

  const given = Buffer.from(hashToken(req.get('x-owner-token') ?? ''));
  const expected = Buffer.from(storedHash);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(403).json({ error: 'Only the room creator can delete this room' });
  }

  await removeRoom(req.params.id);
  res.status(204).end();
});

export default router;
