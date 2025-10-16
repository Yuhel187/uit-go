import express from 'express';
import { redis } from '../redis';

export const app = express();
app.set('trust proxy', true);
app.use(express.json());

// Health check: báo trạng thái redis
app.get('/health', async (_req, res) => {
  let redisOk = false;
  try {
    const pong = await Promise.race([
      redis.ping(),                                  
      new Promise((_ , reject) => setTimeout(() => reject(new Error('timeout')), 500))
    ]);
    redisOk = pong === 'PONG';
  } catch {
    redisOk = false;
  }
  res.json({ ok: true, service: 'driver', redis: redisOk ? 'up' : 'down' });
});
