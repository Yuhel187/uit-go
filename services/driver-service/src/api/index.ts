import { Router } from 'express';
import { health } from '../controller/health.controller';

export const api = Router();
api.get('/health', health);
