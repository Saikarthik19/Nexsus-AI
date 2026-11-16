import mongoose from 'mongoose';
import logger from '../utils/logger';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;

const connectDB = async () => {
  let mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.warn('MONGODB_URI not defined, starting in-memory MongoDB');
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
  }
  try {
    await mongoose.connect(mongoUri);
    logger.info('✅ Connected to MongoDB');
  } catch (err) {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

export const closeDB = async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
};

export default connectDB;

