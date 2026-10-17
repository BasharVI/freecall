import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/freecall';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log(`MongoDB connected: ${uri}`);
    return true;
  } catch (err) {
    console.warn(`MongoDB unavailable (${err.message}). Falling back to in-memory room store.`);
    return false;
  }
}
