import express from 'express';
import { redis } from './redis';  

export const app = express();
app.set('trust proxy', true);
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    const pong = await redis.ping();
    return res.json({ ok: true, service: 'driver', redis: pong === 'PONG' ? 'up' : 'down' });
  } catch {
    return res.json({ ok: true, service: 'driver', redis: 'down' });
  }
});
