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
   // 1. [QUAN TRỌNG] Kiểm tra xem user có đang kẹt trong chuyến khác không
   // const existingTrip = await prisma.trip.findFirst({
   //   where: {
   //     passengerId: passenger.id,
   //     status: {
   //       notIn: [TripStatus.COMPLETED, TripStatus.CANCELLED]
   //     }
   //   }
   // });

   // if (existingTrip) {
   //   throw new Error('Bạn đang trong một chuyến đi khác. Vui lòng hoàn thành hoặc hủy nó trước.');
   // }

    // 2. Tính giá (Mock)
    const priceEstimate = new Prisma.Decimal(50000.00);

    // 3. Tạo chuyến đi
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

    // 4. Gọi hàm tìm tài xế (Internal method)
    return await this.findAndAssignDriver(newTrip);
  }

  // ---- [TX3] Chấp nhận chuyến đi ----
  async acceptTrip(driver: AuthUser, tripId: string) {
    const trip = await this.findTripOrThrow(tripId);
    if (trip.status !== TripStatus.DRIVER_FOUND) {
      throw new Error('Chuyến đi không ở trạng thái chờ tài xế (DRIVER_FOUND).');
    }
    if (trip.driverId !== driver.id) {
      throw new Error('Bạn không phải là tài xế được chỉ định cho chuyến này.');
    }
    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: { status: TripStatus.ACCEPTED }
    });
    appEmitter.emit(EmitterEvents.NOTIFY_PASSENGER, updatedTrip.passengerId, updatedTrip);

    return updatedTrip;
  }
  // ---- [TX3] Từ chối chuyến đi ----
  async rejectTrip(driver: AuthUser, tripId: string) {
    const trip = await this.findTripOrThrow(tripId);
    if (trip.status !== TripStatus.DRIVER_FOUND) {
      throw new Error('Chuyến đi không ở trạng thái chờ tài xế.');
    }
    if (trip.driverId !== driver.id) {
      throw new Error('Bạn không phải là tài xế được chỉ định cho chuyến này.');
    }
    return await this.rematchDriver(trip);
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


  public async findAndAssignDriver(trip: Trip): Promise<Trip> {
    const rejectedRecords = await prisma.tripRejectedDriver.findMany({
      where: { tripId: trip.id },
      select: { driverId: true }
    });
    const excludeDriverIds = rejectedRecords.map((r) => r.driverId);

    console.log(`[Matching] Trip ${trip.id} needs to exclude drivers: ${excludeDriverIds}`);
    const driver = await findClosestDriver(
      trip.fromLocationLat,
      trip.fromLocationLng,
      excludeDriverIds
    );

    if (!driver) {
      console.log(`[Matching] No driver found for trip ${trip.id}`);
      return trip;
    }
    const driverId = Number(driver.id);
    console.log(`[Matching] Found driver ${driverId} for trip ${trip.id}`);

    const updatedTrip = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        driverId: driverId,
        status: TripStatus.ACCEPTED,
      },
    });

    appEmitter.emit(EmitterEvents.NOTIFY_DRIVER, updatedTrip.driverId, updatedTrip);

    //const TIMEOUT_MS = 15000; // Đổi về 15s 
    //setTimeout(() => {
    //  this.handleTripTimeout(updatedTrip.id, driverId).catch(err => {
    //    console.error(`[Timeout] Error handling timeout:`, err);
    //  });
    //}, TIMEOUT_MS);

    return updatedTrip;
  }

  
  public async rematchDriver(trip: Trip): Promise<Trip> {
    console.log(`[Matching] Driver ${trip.driverId} rejected trip ${trip.id}. Rematching...`);
    if (trip.driverId) {
      await prisma.tripRejectedDriver.create({
        data: {
          tripId: trip.id,
          driverId: trip.driverId
        }
      }).catch((err: unknown) => {
        console.warn('[Matching] Driver already rejected this trip before.');
      });
    }
    const tripToSearch = await prisma.trip.update({
      where: { id: trip.id },
      data: { driverId: null, status: 'SEARCHING' },
    });
    return await this.findAndAssignDriver(tripToSearch);
  }
  private async handleTripTimeout(tripId: string, expectedDriverId: number) {
    console.log(`[Timeout] Checking trip ${tripId} for driver ${expectedDriverId}`);

    // 1. Lấy trạng thái MỚI NHẤT
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
    });
    if (
      trip &&
      trip.status === TripStatus.DRIVER_FOUND &&
      trip.driverId === expectedDriverId
    ) {
      console.log(`[Timeout] Driver ${expectedDriverId} timed out. Rematching trip ${tripId}.`);
      
      await this.rematchDriver(trip);
      
    } else {
      console.log(`[Timeout] No action needed for trip ${tripId}. (Current status: ${trip?.status})`);
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

export const tripService = new TripService();
