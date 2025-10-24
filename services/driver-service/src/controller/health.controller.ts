import { Request, Response } from 'express';
import { getHealth } from '../service/health.service';

export function health(_req: Request, res: Response) {
  return res.json(getHealth());
}
