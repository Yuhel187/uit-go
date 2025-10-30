import { Prisma, Trip, TripStatus } from '@prisma/client';
import { prisma } from './prisma.client';

interface AuthUser {
  id: number;
  role: 'PASSENGER' | 'DRIVER';
}

type TripWithRating = Prisma.TripGetPayload<{
  include: { rating: true }
}>

// P2 sẽ cung cấp công cụ này từ: src/integration/clients/driver.client.ts
const driverClient = {
  findNearbyDrivers: async (lat: number, lng: number): Promise<{ id: number } | null> => {
    console.log(`[P1-Debug] Giả lập gọi API tìm tài xế ở ${lat},${lng}`);
    return { id: 789 }; 
  }
};

// P2 sẽ cung cấp công cụ này từ: src/integration/gateways/websocket.gateway.ts
const websocketGateway = {
  notifyDriverOfNewTrip: async (driverId: number, trip: Trip) => {
    console.log(`[P1-Debug] Giả lập phát WS 'trip:request' cho tài xế ${driverId}`);
  },
  notifyPassengerOfUpdate: async (passengerId: number, trip: Trip) => {
    console.log(`[P1-Debug] Giả lập phát WS 'trip:update' cho hành khách ${passengerId}`);
  }
};


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
    await websocketGateway.notifyPassengerOfUpdate(updatedTrip.passengerId, updatedTrip);

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
    await websocketGateway.notifyPassengerOfUpdate(updatedTrip.passengerId, updatedTrip);
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
    await websocketGateway.notifyPassengerOfUpdate(updatedTrip.passengerId, updatedTrip);
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
      // (Báo cho tài xế qua WebSocket rằng chuyến đã bị hủy)
      // await websocketGateway.notifyDriverOfUpdate(updatedTrip.driverId, updatedTrip);
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
    const driver = await driverClient.findNearbyDrivers(
      trip.fromLocationLat,
      trip.fromLocationLng
    );

    if (driver) {
      // 2. [CSDL] Gán tài xế
      const updatedTrip = await prisma.trip.update({
        where: { id: trip.id },
        data: {
          driverId: driver.id,
          status: TripStatus.DRIVER_FOUND
        }
      });
      
      // 3. [ĐIỀU PHỐI] Báo cho tài xế
      await websocketGateway.notifyDriverOfNewTrip(driver.id, updatedTrip);
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

export const tripService = new TripService();