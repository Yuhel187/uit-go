import { Router } from 'express';
import { health } from '../controller/health.controller';
import { driverRouter } from './driver.routes';

export const api = Router();
api.use('/health', health);
api.use('/', driverRouter);