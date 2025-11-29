import { Request, Response, NextFunction } from 'express';
import { tripService } from '../services/trip.service';
import { z } from 'zod';

const driverFoundSchema = z.object({
  driverId: z.coerce.number(),
});

export async function onDriverFound(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: tripId } = req.params;
    const { driverId } = driverFoundSchema.parse(req.body);

    // Gọi service xử lý
    const result = await tripService.handleDriverFound(tripId, driverId);

    res.json({ success: true, trip: result });
  } catch (error) {
    next(error);
  }
}
export async function onNoDriverFound(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: tripId } = req.params;
    await tripService.handleNoDriverFound(tripId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}