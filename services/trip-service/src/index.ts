import { Router } from 'express';
import healthController from './controllers/heath.controller';
import { auth, isPassenger, isDriver } from './middlewares/auth.middleware';
import { 
  requestTrip, 
  acceptTrip, 
  rejectTrip 
} from './controllers/trip.controller';

const router = Router();

// Endpoint kiểm tra sức khỏe
router.get('/health', healthController.checkHealth);

// --- API cho Hành khách (Passenger) ---

// [HK2] Yêu cầu chuyến đi
// Yêu cầu xác thực (auth), và phải là Passenger (isPassenger)
router.post('/trips', auth, isPassenger, requestTrip);

// TODO: Thêm các API khác cho Passenger (cancel, rating, get trip)


// --- API cho Tài xế (Driver) ---

// [TX3] Chấp nhận chuyến đi
// Yêu cầu xác thực (auth), và phải là Driver (isDriver)
router.post('/trips/:id/accept', auth, isDriver, acceptTrip);

// [TX3] Từ chối chuyến đi
// Yêu cầu xác thực (auth), và phải là Driver (isDriver)
router.post('/trips/:id/reject', auth, isDriver, rejectTrip);

// TODO: Thêm các API khác cho Driver (start, complete)


export default router;