import 'dotenv/config';
import { app } from './app';
import { redis } from './redis';

const PORT = Number(process.env.PORT ?? 3001);

async function bootstrap() {
  console.log('[bootstrap] connecting redis:', process.env.REDIS_URL);
  try {
    await redis.connect();
    console.log('[bootstrap] redis connected');
  } catch (err) {
    console.error('[bootstrap] redis connect failed:', err);
    process.exit(1);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Driver Service listening on :${PORT}`);
  });

  server.on('error', (err) => {
    console.error('[server error]', err);
  });

  const shutdown = async () => {
    console.log('Shutting down...');
    try { await redis.quit(); } catch {}
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
