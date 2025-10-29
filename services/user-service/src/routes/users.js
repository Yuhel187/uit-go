import express from 'express';
import auth from '../middlewares/auth.js';
import {
  getMe,
  addVehicle,
  updateVehicle
} from '../controllers/user.controller.js';

const router = express.Router();

router.get('/me', auth, getMe);
router.post('/me/vehicle', auth, addVehicle);
router.put('/me/vehicle', auth, updateVehicle);

export default router;