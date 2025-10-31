import { searchDrivers } from './repo';

export async function findNearbyDrivers(
  lat: number, 
  lng: number, 
  radius: number, 
  unit = 'km',
  excludeDriverIds?: string 
) {
  const results = await searchDrivers(lat, lng, radius, unit);

  const exclusionSet = new Set(excludeDriverIds ? excludeDriverIds.split(',') : []);

  return (results || [])
    .map((r: any) => {
      const id = r?.[0];
      const dist_val = r?.[1] ? parseFloat(r[1]) : null;
      const coords_val = r?.[2] ?? [null, null];

      return {
        id,
        coord: {
          lat: coords_val[1] != null ? parseFloat(coords_val[1]) : null,
          lng: coords_val[0] != null ? parseFloat(coords_val[0]) : null
        },
        distance: dist_val
      };
    })
    .filter((driver: any) => {
      return !exclusionSet.has(driver.id);
    });
}