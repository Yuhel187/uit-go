import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { findNearbyDrivers } from '../service/search.service';

const querySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().default(5),
  unit: z.enum(['m', 'km', 'mi']).default('km'),
  excludeDriverIds: z.string().optional(),
});

export async function searchDriversCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { lat, lng, radius, unit, excludeDriverIds } = querySchema.parse(req.query);
    const drivers = await findNearbyDrivers(lat, lng, radius, unit, excludeDriverIds);
    res.json({ count: drivers.length, drivers });
  } catch (e) {
    next(e);
  }
}
