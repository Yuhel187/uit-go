import { redis } from '../redis';

const ONLINE_PREFIX = 'online:driver:';  // 1:online 0:offline 
const DRIVER_PREFIX = 'driver:';         // Hash: last_seen, last_lat, last_lng

export async function setOnlinePresence(id: string, ttlSeconds: number) {
  await redis.set(`${ONLINE_PREFIX}${id}`, '1', 'EX', ttlSeconds);
}

export async function clearOnlinePresence(id: string) {
  await redis.del(`${ONLINE_PREFIX}${id}`);
}

export async function setLastSeen(id: string) {
  await redis.hset(`${DRIVER_PREFIX}${id}`, { last_seen: Date.now().toString() });
}

export async function setLastLocation(id: string, lat: number, lng: number) {
  await redis.hset(`${DRIVER_PREFIX}${id}`, { last_lat: String(lat), last_lng: String(lng) });
}
