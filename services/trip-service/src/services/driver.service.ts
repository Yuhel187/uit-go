import { driverServiceApi } from '../lib/axios';

// Định nghĩa kiểu dữ liệu trả về từ DriverService
interface DriverSearchResult {
  id: string; // ID của tài xế
  coord: {
    lat: number;
    lng: number;
  };
  distance: number;
}

interface DriverSearchResponse {
  count: number;
  drivers: DriverSearchResult[];
}

/**
 * Tìm tài xế gần nhất.
 * Gọi API GET /drivers/search của DriverService.
 * @param lat Vĩ độ điểm đón
 * @param lng Kinh độ điểm đón
 * @returns Thông tin tài xế gần nhất hoặc null nếu không tìm thấy.
 */
export async function findClosestDriver(
  lat: number, 
  lng: number, 
  excludeDriverIds: number[] = [] 
): Promise<DriverSearchResult | null> {
  try {
    const params: any = {
      lat,
      lng,
      radius: 5,
      unit: 'km',
    };
    if (excludeDriverIds.length > 0) {
      params.excludeDriverIds = excludeDriverIds.join(',');
    }
    const { data } = await driverServiceApi.get<DriverSearchResponse>('/drivers/search', {
      params: params, 
    });
    if (data.count > 0 && data.drivers[0]) {
      return data.drivers[0];
    }
    
    console.log('[DriverService] No drivers found.');
    return null;
  } catch (error) {
    console.error('Error calling DriverService /drivers/search:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}