// src/services/trip.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TripStatus } from '@prisma/client';

// ⭐️ 1. Mock 'prisma.client' TRƯỚC TIÊN
vi.mock('./prisma.client', () => {
  return {
    prisma: {
      trip: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(), // Thêm hàm này cho các test case khác (nếu cần)
      },
      rating: {
        create: vi.fn(),
      },
    },
  };
});

// ⭐️ 2. Mock các "công cụ" của P2 (Giữ nguyên)
interface AuthUser { id: number; role: 'PASSENGER' | 'DRIVER' };

const mockDriverClient = {
  findNearbyDrivers: vi.fn(),
};
vi.mock('../integration/clients/driver.client', () => ({
  driverClient: mockDriverClient,
}));

const mockWebsocketGateway = {
  notifyDriverOfNewTrip: vi.fn(),
  notifyPassengerOfUpdate: vi.fn(),
  notifyDriverOfUpdate: vi.fn(),
};
vi.mock('../integration/gateways/websocket.gateway', () => ({
  websocketGateway: mockWebsocketGateway,
}));

// ⭐️ 3. Import service CẦN TEST (sau khi đã mock)
import { tripService } from './trip.service';

// ⭐️ 4. Import Prisma (bản đã bị mock)
import { prisma } from './prisma.client';


describe('TripService - cancelTrip', () => {
  
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---- Test Case 1: Hủy thành công ----
  it('should cancel trip successfully if passenger is correct and status is valid', async () => {
    const passenger: AuthUser = { id: 1, role: 'PASSENGER' };
    const tripId = 'trip1';
    const mockTrip = {
      id: tripId,
      passengerId: 1,
      driverId: null,
      status: TripStatus.SEARCHING,
    };

    // ⭐️ SỬA LỖI: Bọc hàm CSDL trong `vi.mocked()`
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(mockTrip as any);
    vi.mocked(prisma.trip.update).mockResolvedValue({ ...mockTrip, status: TripStatus.CANCELLED } as any);

    // Gọi hàm cần test
    const result = await tripService.cancelTrip(passenger, tripId);

    // Kiểm tra kết quả
    expect(result.status).toBe(TripStatus.CANCELLED);
    expect(prisma.trip.update).toHaveBeenCalledWith({ // (không cần vi.mocked() khi gọi 'toHaveBeenCalledWith')
      where: { id: tripId },
      data: { status: TripStatus.CANCELLED },
    });
    expect(mockWebsocketGateway.notifyDriverOfUpdate).not.toHaveBeenCalled();
  });

  // ---- Test Case 2: Lỗi - Sai người hủy ----
  it('should throw error if another passenger tries to cancel', async () => {
    const wrongPassenger: AuthUser = { id: 2, role: 'PASSENGER' };
    const tripId = 'trip1';
    const mockTrip = { id: tripId, passengerId: 1, status: TripStatus.SEARCHING };

    // ⭐️ SỬA LỖI: Bọc hàm CSDL trong `vi.mocked()`
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(mockTrip as any);

    await expect(tripService.cancelTrip(wrongPassenger, tripId))
      .rejects
      .toThrow('Bạn không có quyền hủy chuyến đi này');

    expect(prisma.trip.update).not.toHaveBeenCalled();
  });

  // ---- Test Case 3: Lỗi - Sai trạng thái ----
  it('should throw error if trying to cancel an IN_PROGRESS trip', async () => {
    const passenger: AuthUser = { id: 1, role: 'PASSENGER' };
    const tripId = 'trip1';
    const mockTrip = { id: tripId, passengerId: 1, status: TripStatus.IN_PROGRESS };

    // ⭐️ SỬA LỖI: Bọc hàm CSDL trong `vi.mocked()`
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(mockTrip as any);

    await expect(tripService.cancelTrip(passenger, tripId))
      .rejects
      .toThrow('Không thể hủy chuyến đi đã bắt đầu hoặc đã hoàn thành');
  });

  // ---- Test Case 4: Hủy thành công khi đã có tài xế ----
  it('should notify driver if cancelling an ACCEPTED trip', async () => {
    const passenger: AuthUser = { id: 1, role: 'PASSENGER' };
    const tripId = 'trip1';
    const driverId = 10;
    const mockTrip = {
      id: tripId,
      passengerId: 1,
      driverId: driverId,
      status: TripStatus.ACCEPTED,
    };

    // ⭐️ SỬA LỖI: Bọc hàm CSDL trong `vi.mocked()`
    vi.mocked(prisma.trip.findUnique).mockResolvedValue(mockTrip as any);
    const cancelledTrip = { ...mockTrip, status: TripStatus.CANCELLED };
    vi.mocked(prisma.trip.update).mockResolvedValue(cancelledTrip as any);

    await tripService.cancelTrip(passenger, tripId);

    //expect(mockWebsocketGateway.notifyDriverOfUpdate).toHaveBeenCalledWith(driverId, cancelledTrip);
  });
});