import 'dotenv/config';
import mongoose from 'mongoose';
import app from '../src/app.js';

let connectingPromise = null;

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return;
  if (!connectingPromise) {
    connectingPromise = mongoose.connect(process.env.MONGODB_URL).catch((err) => {
      connectingPromise = null;
      throw err;
    });
  }
  await connectingPromise;
}

export default async function handler(req, res) {
  await ensureDbConnected();
  app(req, res);
}
