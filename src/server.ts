import { createApp, logger } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/client.js';

const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, 'Amrutam API listening'));
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');
  const timeout = setTimeout(() => {
    logger.error('Shutdown timed out');
    process.exit(1);
  }, 10_000);
  timeout.unref();
  server.close(async (error) => {
    await prisma.$disconnect();
    clearTimeout(timeout);
    if (error) {
      logger.error({ err: error }, 'HTTP server shutdown failed');
      process.exitCode = 1;
    }
  });
}
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
