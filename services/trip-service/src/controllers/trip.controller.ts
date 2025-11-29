import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.client';
import { z } from 'zod';
import { tripService } from '../services/trip.service';
import { Trip } from '@prisma/client';
import {  AuthUser } from '../services/trip.service';

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

// Validate body cho POST /api/trips/:id/rating [HK5]
const rateTripSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().optional(),
});
// --- Controller Functions ---

/**
 * [HK2] Yêu cầu chuyến đi
 * POST /api/trips
 * Ai gọi: Passenger
 */
export async function requestTrip(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Lấy thông tin User và Body
    const authUser = req.user as AuthUser;
    const body = createTripSchema.parse(req.body);

    // 2. GỌI SERVICE
    const trip = await tripService.createTrip(authUser, body);

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
    const authUser = req.user as AuthUser;
    const { id: tripId } = tripParamsSchema.parse(req.params);

    // ❌ BỎ CODE CŨ (gọi prisma trực tiếp)
    // ✅ CODE MỚI: Gọi Service
    const updatedTrip = await tripService.acceptTrip(authUser, tripId);

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
    const authUser = req.user as AuthUser;
    const { id: tripId } = tripParamsSchema.parse(req.params);
    const rematchedTrip = await tripService.rejectTrip(authUser, tripId);
    res.json(rematchedTrip);
  } catch (error) {
    next(error);
  }
}

/**
 * [TX-Sub] Bắt đầu chuyến đi
 * POST /api/trips/:id/start
 */
export async function startTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = req.user as AuthUser;
    const { id: tripId } = tripParamsSchema.parse(req.params);

    const updatedTrip = await tripService.startTrip(authUser, tripId);
    res.json(updatedTrip);

  } catch (error) {
    next(error);
  }
}

/**
 * [TX5] Hoàn thành chuyến đi
 * POST /api/trips/:id/complete
 */
export async function completeTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = req.user as AuthUser;
    const { id: tripId } = tripParamsSchema.parse(req.params);

    const updatedTrip = await tripService.completeTrip(authUser, tripId);
    res.json(updatedTrip);

  } catch (error) {
    next(error);
  }
}

/**
 * [HK4] Hủy chuyến đi
 * POST /api/trips/:id/cancel
 */
export async function cancelTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = req.user as AuthUser;
    const { id: tripId } = tripParamsSchema.parse(req.params);

    const updatedTrip = await tripService.cancelTrip(authUser, tripId);
    res.json(updatedTrip);

  } catch (error) {
    next(error);
  }
}

/**
 * [HK5] Đánh giá chuyến đi
 * POST /api/trips/:id/rating
 */
export async function rateTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = req.user as AuthUser;
    const { id: tripId } = tripParamsSchema.parse(req.params);
    const body = rateTripSchema.parse(req.body);

    const newRating = await tripService.rateTrip(authUser, tripId, body);
    res.status(201).json(newRating);

  } catch (error) {
    next(error);
  }
}

/**
 * [Chung] Lấy thông tin chuyến đi
 * GET /api/trips/:id
 */
export async function getTripById(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = req.user as AuthUser;
    const { id: tripId } = tripParamsSchema.parse(req.params);

    const trip = await tripService.getTripById(authUser, tripId);
    res.json(trip);

  } catch (error) {
    next(error);
  }
}