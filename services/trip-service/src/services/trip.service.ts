import { Prisma, Trip, TripStatus } from '@prisma/client';
import { prisma } from './prisma.client';
import { findClosestDriver } from './driver.service';
import { appEmitter, EmitterEvents } from '../lib/emitter';

export interface AuthUser {
  id: number;
  role: 'PASSENGER' | 'DRIVER';
}

type TripWithRating = Prisma.TripGetPayload<{
  include: { rating: true }
}>

class TripService {

  // ---- [HK2] Yêu cầu chuyến đi ----
  async createTrip(
    passenger: AuthUser,
    payload: { from_lat: number, from_lng: number, to_lat: number, to_lng: number }
  ) {
    // 1. [LUẬT] Kiểm tra nghiệp vụ
    if (passenger.role !== 'PASSENGER') {
      throw new Error('Chỉ hành khách mới được tạo chuyến đi');
    }

    const existingTrip = await prisma.trip.findFirst({
    where: {
        passengerId: passenger.id,
        status: { // Tìm các chuyến đi chưa kết thúc hoặc chưa hủy
        notIn: [TripStatus.COMPLETED, TripStatus.CANCELLED]
        }
    }
    });

    if (existingTrip) {
    throw new Error('Bạn đang trong một chuyến đi khác.');
    }

    // 2. [LOGIC] Tính toán (Giả lập)
    const priceEstimate = new Prisma.Decimal(50000.00);

    // 3. [CSDL] Tạo chuyến đi
    const newTrip = await prisma.trip.create({
      data: {
        passengerId: passenger.id,
        fromLocationLat: payload.from_lat,
        fromLocationLng: payload.from_lng,
        toLocationLat: payload.to_lat,
        toLocationLng: payload.to_lng,
        priceEstimate: priceEstimate,
        status: TripStatus.SEARCHING
      }
    });

    // 4. [ĐIỀU PHỐI] Tìm tài xế
    await this.findAndAssignDriver(newTrip);

    return newTrip;
  }

  // ---- [TX3] Chấp nhận chuyến đi ----
  async acceptTrip(driver: AuthUser, tripId: string) {
    // 1. [CSDL] Lấy chuyến đi
    const trip = await this.findTripOrThrow(tripId);

    // 2. [LUẬT] Kiểm tra (State Machine + Quyền)
    if (trip.status !== TripStatus.DRIVER_FOUND) {
      throw new Error('Không thể chấp nhận chuyến đi này');
    }
    if (trip.driverId !== driver.id) {
      throw new Error('Bạn không được gán cho chuyến đi này');
    }

    // 3. [CSDL] Cập nhật trạng thái
    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { status: TripStatus.ACCEPTED }
    });

    // 4. [ĐIỀU PHỐI] Báo cho hành khách
    appEmitter.emit(EmitterEvents.NOTIFY_PASSENGER, updatedTrip.passengerId, updatedTrip);

    return updatedTrip;
  }

  // ---- [TX3] Từ chối chuyến đi ----
  async rejectTrip(driver: AuthUser, tripId: string) {
    const trip = await this.findTripOrThrow(tripId);

    // 2. [LUẬT] Kiểm tra
    if (trip.status !== TripStatus.DRIVER_FOUND || trip.driverId !== driver.id) {
      throw new Error('Không thể từ chối chuyến đi này');
    }
    
    // 3. [CSDL] Reset chuyến đi về trạng thái tìm kiếm
    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        status: TripStatus.SEARCHING,
        driverId: null
      }
    });

    // 4. [ĐIỀU PHỐI] Tìm tài xế MỚI
    // (Nâng cao: nên loại tài xế vừa từ chối ra khỏi vòng tìm kiếm)
    await this.findAndAssignDriver(updatedTrip);

    return updatedTrip;
  }

  // ---- [TX-Sub] Bắt đầu chuyến đi ----
  async startTrip(driver: AuthUser, tripId: string) {
    const trip = await this.findTripOrThrow(tripId);

    // 2. [LUẬT] Kiểm tra
    if (trip.status !== TripStatus.ACCEPTED || trip.driverId !== driver.id) {
      throw new Error('Không thể bắt đầu chuyến đi này');
    }

    // 3. [CSDL] Cập nhật
    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { status: TripStatus.IN_PROGRESS }
    });
    
    // 4. [ĐIỀU PHỐI] Báo cho hành khách
    appEmitter.emit(EmitterEvents.NOTIFY_PASSENGER, updatedTrip.passengerId, updatedTrip);
    return updatedTrip;
  }
  
  // ---- [TX5] Hoàn thành chuyến đi ----
  async completeTrip(driver: AuthUser, tripId: string) {
    const trip = await this.findTripOrThrow(tripId);

    // 2. [LUẬT] Kiểm tra
    if (trip.status !== TripStatus.IN_PROGRESS || trip.driverId !== driver.id) {
      throw new Error('Không thể hoàn thành chuyến đi này');
    }
    
    // 3. [CSDL] Cập nhật
    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { status: TripStatus.COMPLETED }
    });
    
    // 4. [ĐIỀU PHỐI] Báo cho hành khách
    appEmitter.emit(EmitterEvents.NOTIFY_PASSENGER, updatedTrip.passengerId, updatedTrip);
    return updatedTrip;
  }

  // ---- [HK4] Hủy chuyến đi ----
  async cancelTrip(passenger: AuthUser, tripId: string) {
    const trip = await this.findTripOrThrow(tripId);

    // 2. [LUẬT] Kiểm tra
    if (trip.passengerId !== passenger.id) {
      throw new Error('Bạn không có quyền hủy chuyến đi này');
    }
    // Chỉ cho phép hủy khi chuyến đi chưa diễn ra hoặc chưa hoàn thành
    if (trip.status === TripStatus.IN_PROGRESS || trip.status === TripStatus.COMPLETED) {
      throw new Error('Không thể hủy chuyến đi đã bắt đầu hoặc đã hoàn thành');
    }

    // 3. [CSDL] Cập nhật
    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { status: TripStatus.CANCELLED }
    });
    
    // 4. [ĐIỀU PHỐI] Báo cho tài xế (nếu có)
    if (updatedTrip.driverId) {
       appEmitter.emit(EmitterEvents.NOTIFY_DRIVER, updatedTrip.driverId, updatedTrip);
    }
    return updatedTrip;
  }
  
  // ---- [HK5] Đánh giá chuyến đi ----
  async rateTrip(
    passenger: AuthUser,
    tripId: string,
    payload: { rating: number, comment?: string }
  ) {
    const trip: TripWithRating = await this.findTripOrThrow(tripId, { rating: true });

    // 2. [LUẬT] Kiểm tra
    if (trip.passengerId !== passenger.id) {
      throw new Error('Bạn không có quyền đánh giá chuyến đi này');
    }
    if (trip.status !== TripStatus.COMPLETED) {
      throw new Error('Chỉ có thể đánh giá chuyến đi đã hoàn thành');
    }
    if (trip.rating) {
      throw new Error('Chuyến đi này đã được đánh giá');
    }
    if (payload.rating < 1 || payload.rating > 5) {
      throw new Error('Rating phải từ 1 đến 5');
    }

    // 3. [CSDL] Tạo record Rating
    const newRating = await prisma.rating.create({
      data: {
        tripId: tripId,
        passengerId: passenger.id,
        driverId: trip.driverId!, 
        rating: payload.rating,
        comment: payload.comment
      }
    });

    return newRating;
  }

  // ---- [Chung] Lấy thông tin chuyến đi ----
  async getTripById(user: AuthUser, tripId: string) {
    const trip = await this.findTripOrThrow(tripId, { rating: true });

    // 2. [LUẬT] Kiểm tra
    if (user.role === 'PASSENGER' && trip.passengerId !== user.id) {
      throw new Error('Bạn không có quyền xem chuyến đi này');
    }
    if (user.role === 'DRIVER' && trip.driverId !== user.id) {
      throw new Error('Bạn không có quyền xem chuyến đi này');
    }

    return trip;
  }


  // HÀM NỘI BỘ (Internal)

  /**
   * (Nội bộ) Hàm điều phối tìm và gán tài xế
   */
  private async findAndAssignDriver(trip: Trip) {
    // 1. [ĐIỀU PHỐI]
    const driver = await findClosestDriver(
      trip.fromLocationLat,
      trip.fromLocationLng
    );

    if (driver) {
      // 2. [CSDL] Gán tài xế
      const updatedTrip = await prisma.trip.update({
        where: { id: trip.id },
        data: {
          driverId: Number(driver.id),
          status: TripStatus.DRIVER_FOUND
        }
      });
      
      // 3. [ĐIỀU PHỐI] Báo cho tài xế
      appEmitter.emit(EmitterEvents.NOTIFY_DRIVER, updatedTrip.driverId, updatedTrip);
    } else {
      console.log(`Không tìm thấy tài xế cho chuyến ${trip.id}`);
    }
  }

  /**
   * (Nội bộ) Hàm tiện ích để lấy Trip, nếu không thấy thì báo lỗi
   */
  private async findTripOrThrow<T extends Prisma.TripInclude>(
    tripId: string,
    include?: T
  ): Promise<Prisma.TripGetPayload<{ include: T }>> { 
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: include
    });
    if (!trip) {
      throw new Error('Không tìm thấy chuyến đi');
    }
    return trip as Prisma.TripGetPayload<{ include: T }>;
  }
}
async function handleTripTimeout(tripId: string, expectedDriverId: number) {
  console.log(`[Timeout] Checking trip ${tripId} for driver ${expectedDriverId}`);

  // 1. Lấy trạng thái MỚI NHẤT của chuyến đi
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
  });

  // 2. Kiểm tra xem có cần tự động từ chối không
  if (
    trip &&
    trip.status === TripStatus.DRIVER_FOUND &&
    trip.driverId === expectedDriverId
  ) {
    // Tài xế đã không làm gì cả trong 15s.
    // Coi như tài xế vừa bấm "Từ chối" và tìm người mới.
    console.log(`[Timeout] Driver ${expectedDriverId} timed out. Rematching trip ${tripId}.`);
    
    await rematchDriver(trip);
    
  } else {
    console.log(`[Timeout] No action needed for trip ${tripId}. (Current status: ${trip?.status})`);
  }
}
/**
 * Tìm và gán tài xế cho một chuyến đi.
 * @param trip Chuyến đi đang ở trạng thái 'SEARCHING'.
 * @returns Chuyến đi đã được cập nhật (có thể vẫn là 'SEARCHING' nếu không tìm thấy tài xế).
 */
export async function findAndAssignDriver(trip: Trip): Promise<Trip> {
  // 1.Lấy danh sách TẤT CẢ tài xế đã từ chối chuyến
  const rejectedRecords = await prisma.tripRejectedDriver.findMany({
    where: { tripId: trip.id },
    select: { driverId: true }
  });
  const excludeDriverIds = rejectedRecords.map((r: { driverId: number }) => r.driverId);

  console.log(`[Matching] Trip ${trip.id} needs to exclude drivers: ${excludeDriverIds}`);

  // 2. Gọi DriverService với danh sách loại trừ
  const driver = await findClosestDriver(
    trip.fromLocationLat, 
    trip.fromLocationLng, 
    excludeDriverIds 
  );

  if (!driver) {
    console.log(`[Matching] No driver found for trip ${trip.id}`);
    return trip;
  }

  // 3. Tìm thấy -> Gán tài xế
  console.log(`[Matching] Found driver ${driver.id} for trip ${trip.id}`);
  
  const driverId = Number(driver.id);

  const updatedTrip = await prisma.trip.update({
    where: { id: trip.id },
    data: {
      driverId: driverId, 
      status: 'DRIVER_FOUND',
    },
  });

  // 4. Notify driver
  appEmitter.emit(EmitterEvents.NOTIFY_DRIVER, updatedTrip.driverId, updatedTrip);
  //Tạm thời để 1 phút để dễ test
  //Todo : chỉnh lại 15s trong production
  const TIMEOUT_MS = 60000;
  setTimeout(() => {
    handleTripTimeout(updatedTrip.id, driverId).catch(err => { // ⭐️ Dùng biến driverId
      console.error(`[Timeout] Error handling timeout for trip ${updatedTrip.id}:`, err);
    });
  }, TIMEOUT_MS);
  
  console.log(`[Matching] Notified driver ${driverId}. Set 15s timeout.`);

  return updatedTrip;
}
/**
 * Xử lý khi tài xế từ chối và tìm tài xế mới.
 * @param trip Chuyến đi bị từ chối.
 * @returns Chuyến đi đã được cập nhật (SEARCHING hoặc DRIVER_FOUND với tài xế mới).
 */
export async function rematchDriver(trip: Trip): Promise<Trip> {
  console.log(`[Matching] Driver ${trip.driverId} rejected trip ${trip.id}. Rematching...`);

  // 1. [MỚI] Ghi nhận việc từ chối vào DB
  if (trip.driverId) {
    await prisma.tripRejectedDriver.create({
      data: {
        tripId: trip.id,
        driverId: trip.driverId
      }
    }).catch((err: unknown) => {
      // Bắt lỗi nếu record đã tồn tại (do unique constraint) để không crash app
      console.warn('[Matching] Driver already rejected this trip before.');
    });
  }

  // 2. Reset chuyến đi & tìm người mới
  const tripToSearch = await prisma.trip.update({
    where: { id: trip.id },
    data: { driverId: null, status: 'SEARCHING' },
  });

  return await findAndAssignDriver(tripToSearch);
}

export const tripService = new TripService();