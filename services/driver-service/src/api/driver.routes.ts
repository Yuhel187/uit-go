import { Router } from 'express';
import { putLocation } from '../controller/driver.controller';
import { searchDriversCtrl } from '../controller/search.conller';

export const driverRouter = Router();
driverRouter.put('/drivers/:id/location', putLocation);
driverRouter.get('/drivers/search', searchDriversCtrl);
