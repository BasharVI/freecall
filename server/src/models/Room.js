import mongoose from 'mongoose';

export const ROOM_TYPES = ['video', 'audio'];
export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 8; // mesh topology: every peer connects to every other peer

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: ROOM_TYPES, default: 'video' },
    maxParticipants: { type: Number, min: MIN_PARTICIPANTS, max: MAX_PARTICIPANTS, default: 4 },
    permanent: { type: Boolean, default: false },
    createdBy: { type: String, trim: true, maxlength: 30, default: 'Anonymous' },
  },
  { timestamps: true },
);

export default mongoose.model('Room', roomSchema);
