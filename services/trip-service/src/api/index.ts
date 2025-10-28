import { Router } from 'express';
import healthController from '../controllers/heath.controller';

const router = Router();

router.get('/health', healthController.checkHealth);

export default router;
