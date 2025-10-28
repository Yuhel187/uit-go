import { Request, Response } from 'express';
import healthService from '../services/heath.service';

const checkHealth = (req: Request, res: Response) => {
  const status = healthService.getStatus();
  res.json(status);
};

export default { checkHealth };
