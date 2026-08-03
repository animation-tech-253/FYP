import 'dotenv/config';
import mongoose from 'mongoose';
import app from '../src/app.js';

let connected = false;

app.use(async (req, res, next) => {
  if (!connected) {
    await mongoose.connect(process.env.MONGODB_URL);
    connected = true;
  }
  next();
});

export default app;
