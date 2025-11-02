import { Router } from 'express';
import healthController from './controllers/heath.controller';
import { auth, isPassenger, isDriver } from './middlewares/auth.middleware';

import { 
  requestTrip, 
  acceptTrip, 
  rejectTrip,
  startTrip,      
  completeTrip,   
  cancelTrip,     
  rateTrip,       
  getTripById     
} from './controllers/trip.controller';

const router = Router();

// Endpoint kiểm tra sức khỏe
router.get('/health', healthController.checkHealth);

// --- API cho Hành khách (Passenger) ---

// [HK2] Yêu cầu chuyến đi
router.post('/trips', auth, isPassenger, requestTrip);

// [HK4] Hủy chuyến đi (BỔ SUNG)
router.post('/trips/:id/cancel', auth, isPassenger, cancelTrip);

// [HK5] Đánh giá chuyến đi (BỔ SUNG)
router.post('/trips/:id/rating', auth, isPassenger, rateTrip);


// --- API cho Tài xế (Driver) ---

// [TX3] Chấp nhận chuyến đi
router.post('/trips/:id/accept', auth, isDriver, acceptTrip);

// [TX3] Từ chối chuyến đi
router.post('/trips/:id/reject', auth, isDriver, rejectTrip);

// [TX-Sub] Bắt đầu chuyến đi (BỔ SUNG)
router.post('/trips/:id/start', auth, isDriver, startTrip);

// [TX5] Hoàn thành chuyến đi (BỔ SUNG)
router.post('/trips/:id/complete', auth, isDriver, completeTrip);


// --- API Chung ---

// [Chung] Lấy thông tin chuyến đi (BỔ SUNG)
// API này chỉ cần 'auth', vì cả Passenger và Driver đều có thể gọi
router.get('/trips/:id', auth, getTripById);


export default router;