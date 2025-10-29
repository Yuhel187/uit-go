import { searchDrivers } from './repo';

export async function findNearbyDrivers(lat: number, lng: number, radius: number, unit = 'km') {
  const results = await searchDrivers(lat, lng, radius, unit);

  return (results || []).map((r: any) => {
    const id = r?.[0];
    
    const dist_val = r?.[1] ? parseFloat(r[1]) : null; // Lấy distance từ r[1]
    const coords_val = r?.[2] ?? [null, null];       // Lấy coords từ r[2]

    return {
      id,
      coord: {
        // SỬA LỖI: Kiểm tra '!= null' để xử lý trường hợp tọa độ là 0
        lat: coords_val[1] != null ? parseFloat(coords_val[1]) : null,
        lng: coords_val[0] != null ? parseFloat(coords_val[0]) : null
      },
      distance: dist_val // Gán distance đúng
    };
  });
}