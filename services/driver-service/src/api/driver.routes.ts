import { Router } from 'express';
import { putLocation } from '../controller/driver.controller';

export const driverRouter = Router();
driverRouter.put('/drivers/:id/location', putLocation);
