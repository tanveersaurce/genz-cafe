import { app } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { initSocket } from './config/socket';
import { logger } from './utils/logger';

const server = app.listen(env.PORT, async () => {
  logger.info(`☕ Gen-Z Cafe Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  await connectDB();
  initSocket(server);

  // Safe idempotent migrations & schedulers
  const { tableService } = await import('./modules/tables/table.service');
  const { phoneRetentionService } = await import('./services/phoneRetention.service');
  await tableService.ensureTableQrTokens();
  phoneRetentionService.startScheduler();
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');
    await disconnectDB();
    logger.info('Process terminated cleanly');
    process.exit(0);
  });

  // Force exit if shutdown hangs beyond 10s
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  process.exit(1);
});
