import express from 'express';
import {
  register,
  verifyEmail,
  resendOtp,
  login,
  refreshToken,
  logout
} from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/token/refresh', refreshToken);
router.post('/logout', logout);

export default router;