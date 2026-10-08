import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

let isConnecting = false;

export const connectDB = async (retryCount = 0): Promise<typeof mongoose | null> => {
  if (mongoose.connection.readyState === 1) {
    logger.info('MongoDB is already connected');
    return mongoose;
  }

  if (isConnecting) return null;
  isConnecting = true;

  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB connected successfully: ${conn.connection.host}`);
    isConnecting = false;
    return conn;
  } catch (error) {
    isConnecting = false;
    logger.error({ err: error }, `MongoDB connection failed (Attempt ${retryCount + 1}/${MAX_RETRIES})`);

    if (retryCount < MAX_RETRIES - 1) {
      logger.info(`Retrying MongoDB connection in ${RETRY_INTERVAL_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      return connectDB(retryCount + 1);
    } else {
      logger.warn('Could not establish initial MongoDB connection after maximum retries. Continuing in degraded mode.');
      return null;
    }
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully');
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected successfully');
});
