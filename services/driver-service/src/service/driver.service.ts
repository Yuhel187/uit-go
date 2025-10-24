import 'dotenv/config';
import { clearOnlinePresence, setLastLocation, setLastSeen, setOnlinePresence,
         addDriverLocationToGeo, removeDriverFromGeo } from './repo';

const ONLINE_TTL_SECONDS = Number(process.env.ONLINE_TTL_SECONDS ?? 35);

export type DriverStatus = 'ONLINE' | 'OFFLINE';

export async function updateLocationService(
  id: string,
  lat: number,
  lng: number,
  status: DriverStatus
) {
  if (status === 'OFFLINE') {
    await Promise.all([
      clearOnlinePresence(id),
      setLastSeen(id),
      setLastLocation(id, lat, lng),
      removeDriverFromGeo(id)
    ]);
    return { id, status: 'OFFLINE' as const };
  }

  await Promise.all([
    setOnlinePresence(id, ONLINE_TTL_SECONDS),
    setLastSeen(id),
    setLastLocation(id, lat, lng),
    addDriverLocationToGeo(id,lng,lat)
  ]);
  return { id, status: 'ONLINE' as const };
}
