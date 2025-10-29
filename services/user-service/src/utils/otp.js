import crypto from 'crypto';

export function generateOtp() {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

export function randomSalt(len = 8) {
  return crypto.randomBytes(len).toString('hex');
}

export function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(salt + otp).digest('hex');
}
