import { prisma } from './prisma.client';
import { findClosestDriver } from './driver.service';
import { Trip } from '@prisma/client';

/**
 * Tìm và gán tài xế cho một chuyến đi.
 * @param trip Chuyến đi đang ở trạng thái 'SEARCHING'.
 * @returns Chuyến đi đã được cập nhật (có thể vẫn là 'SEARCHING' nếu không tìm thấy tài xế).
 */
export async function findAndAssignDriver(trip: Trip): Promise<Trip> {
  // 1. Gọi DriverService để tìm tài xế
  const driver = await findClosestDriver(trip.fromLocationLat, trip.fromLocationLng);

  if (!driver) {
    // Không tìm thấy tài xế, giữ nguyên trạng thái SEARCHING
    console.log(`[MatchingService] No driver found for trip ${trip.id}`);
    return trip;
  }

  // 2. Tìm thấy tài xế -> Cập nhật chuyến đi
  console.log(`[MatchingService] Found driver ${driver.id} for trip ${trip.id}`);
  const updatedTrip = await prisma.trip.update({
    where: { id: trip.id },
    data: {
      driverId: Number(driver.id), // Chuyển đổi ID tài xế (string) sang Int
      status: 'DRIVER_FOUND',
    },
  });

  // 3. Gửi WebSocket 'trip:request' cho tài xế
  // TODO: Emit WebSocket event 'trip:request' to driver (driver.id)
  console.log(`[MatchingService] Notifying driver ${driver.id} via WebSocket...`);

  return updatedTrip;
}

/**
 * Xử lý khi tài xế từ chối và tìm tài xế mới.
 * @param trip Chuyến đi bị từ chối.
 * @returns Chuyến đi đã được cập nhật (SEARCHING hoặc DRIVER_FOUND với tài xế mới).
 */
export async function rematchDriver(trip: Trip): Promise<Trip> {
  console.log(`[MatchingService] Driver ${trip.driverId} rejected trip ${trip.id}. Rematching...`);
  
  // 1. Set chuyến đi về SEARCHING và xóa driverId
  // (Một hệ thống thực tế cần lưu lại tài xế đã từ chối để không tìm lại họ)
  const tripToSearch = await prisma.trip.update({
    where: { id: trip.id },
    data: {
      driverId: null,
      status: 'SEARCHING',
    },
  });

  // 2. Gọi lại hàm tìm tài xế
  return await findAndAssignDriver(tripToSearch);
}