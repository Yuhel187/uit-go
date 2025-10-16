import { redis } from '../redis';

export async function getHealth() {
  try {
    const pong = await redis.ping();
    return { ok: true, service: 'driver', redis: pong === 'PONG' ? 'up' : 'down' };
  } catch {
    return { ok: true, service: 'driver', redis: 'down' };
  }
}
