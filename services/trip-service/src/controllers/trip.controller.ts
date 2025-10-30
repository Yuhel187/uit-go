import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.client';
import { z } from 'zod';
import { findAndAssignDriver, rematchDriver } from '../services/trip.service';

// --- Zod Schemas để Validate ---

// Validate body cho POST /api/trips
const createTripSchema = z.object({
  from_lat: z.coerce.number().min(-90).max(90),
  from_lng: z.coerce.number().min(-180).max(180),
  to_lat: z.coerce.number().min(-90).max(90),
  to_lng: z.coerce.number().min(-180).max(180),
});

// Validate params cho /api/trips/:id/...
const tripParamsSchema = z.object({
  id: z.string().cuid(), 
});

// --- Controller Functions ---

/**
 * [HK2] Yêu cầu chuyến đi
 * POST /api/trips
 * Ai gọi: Passenger
 */
export async function requestTrip(req: Request, res: Response, next: NextFunction) {
  try {
    // req.user được gán từ middleware auth
    const { id: passengerId } = req.user!;
    const body = createTripSchema.parse(req.body);

    // mock giá ước tính
    const priceEstimate = 50000.00; 

    let trip = await prisma.trip.create({
      data: {
        passengerId: passengerId,
        status: 'SEARCHING',
        fromLocationLat: body.from_lat,
        fromLocationLng: body.from_lng,
        toLocationLat: body.to_lat,
        toLocationLng: body.to_lng,
        priceEstimate: priceEstimate,
      },
    });
    trip = await findAndAssignDriver(trip);

    res.status(201).json(trip);
    
  } catch (error) {
    next(error); 
  }
}

/**
 * [TX3] Chấp nhận chuyến đi
 * POST /api/trips/:id/accept
 * Ai gọi: Driver
 */
export async function acceptTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: driverId } = req.user!;
    const { id: tripId } = tripParamsSchema.parse(req.params);

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.status !== 'DRIVER_FOUND') {
      return res.status(400).json({ 
        error: `Trip is not in DRIVER_FOUND status (current: ${trip.status})` 
      });
    }
    if (trip.driverId !== driverId) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to this trip' });
    }

    const updatedTrip = await prisma.trip.update({
      where: { id: tripId },
      data: {
        status: 'ACCEPTED',
      },
    });

    // Gửi WebSocket 'trip:update' cho hành khách
    // TODO: Emit WebSocket 'trip:update' to passenger (trip.passengerId)
    console.log(`[TripController] Notifying passenger ${trip.passengerId} of trip acceptance...`);

    res.json(updatedTrip);

  } catch (error) {
    next(error);
  }
}

/**
 * [TX3] Từ chối chuyến đi
 * POST /api/trips/:id/reject
 * Ai gọi: Driver
 */
export async function rejectTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: driverId } = req.user!;
    const { id: tripId } = tripParamsSchema.parse(req.params);

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (trip.status !== 'DRIVER_FOUND') {
      return res.status(400).json({ 
        error: `Trip is not in DRIVER_FOUND status (current: ${trip.status})` 
      });
    }
    if (trip.driverId !== driverId) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to this trip' });
    }
    const rematchedTrip = await rematchDriver(trip);
    res.json(rematchedTrip);

  } catch (error) {
    next(error);
  }
}