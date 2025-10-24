import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { updateLocationService } from '../service/driver.service';

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({
  lat: z.coerce.number(),  
  lng: z.coerce.number(),
  status: z.enum(['ONLINE', 'OFFLINE']),
});

export async function putLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = paramsSchema.parse(req.params);
    const { lat, lng, status } = bodySchema.parse(req.body);

    const result = await updateLocationService(id, lat, lng, status);
    res.json(result);
  } catch (e) {
    next(e);
  }
}
