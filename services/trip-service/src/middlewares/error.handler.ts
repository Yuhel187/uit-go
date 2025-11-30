import { NextFunction, Request, Response } from 'express';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not Found' });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  if (err.message === 'Chuyến đi không ở trạng thái chờ tài xế (DRIVER_FOUND).' || 
      err.message === 'Bạn không phải là tài xế được chỉ định cho chuyến này.') {
      return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal Server Error' });
}
