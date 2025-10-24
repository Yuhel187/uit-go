  // src/routes/auth.js
  import express from 'express';
  import prisma from '../prismaClient.js';
  import bcrypt from 'bcrypt';
  import jwt from 'jsonwebtoken';
  import { v4 as uuidv4 } from 'uuid';
  import redis from '../lib/redis.js';
  import { generateOtp, randomSalt, hashOtp } from '../utils/otp.js';
  import { sendOtpEmail } from '../lib/mailer.js';

  const router = express.Router();

  const SALT_ROUNDS = 10;
  const ACCESS_EXPIRES = '15m';
  const REFRESH_EXPIRES_DAYS = 30;

  function signAccessToken(user) {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
  }

  const OTP_TTL = 60 * 10; // 10 minutes
  const RESEND_COOLDOWN = 60; // seconds
  const MAX_SEND_PER_DAY = 5;
  const MAX_WRONG_ATTEMPTS = 5;

  // --- Register: create user as unverified + send OTP ---
  router.post('/register', async (req, res) => {
    try {
      const { email, password, name, phone, role } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: 'Email already used' });

      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      // create user but isVerified = false
      const user = await prisma.user.create({
        data: { email, password: hash, name, phone, role: role || 'PASSENGER', isVerified: false }
      });

      // rate-limit keys
      const sentCountKey = `otp:count:${email}`;
      const cooldownKey = `otp:cooldown:${email}`;
      const sendCount = parseInt(await redis.get(sentCountKey) || '0', 10);
      if (sendCount >= MAX_SEND_PER_DAY) {
        return res.status(429).json({ error: 'Đã gửi quá nhiều lần trong ngày' });
      }
      if (await redis.exists(cooldownKey)) {
        return res.status(429).json({ error: 'Vừa gửi mã, vui lòng chờ vài giây' });
      }

      // generate OTP and store hashed in redis
      const otp = generateOtp();
      const salt = randomSalt();
      const otpHash = hashOtp(otp, salt);
      const otpKey = `otp:${email}`;

      await redis.set(otpKey, JSON.stringify({ otpHash, salt }), 'EX', OTP_TTL);
      await redis.incr(sentCountKey);
      await redis.expire(sentCountKey, 24 * 3600);
      await redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN);

      // create prisma EmailVerification record for audit
      const tokenId = uuidv4();
      const expiresAt = new Date(Date.now() + OTP_TTL * 1000);
      await prisma.emailVerification.create({
        data: {
          token: tokenId,
          userId: user.id,
          type: 'email_verify',
          used: false,
          expiresAt
        }
      });

      // send email (use App Password)
      await sendOtpEmail(email, otp);

      return res.status(201).json({ message: 'Đăng ký thành công (chưa verify). Mã OTP đã gửi tới email.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Lỗi server' });
    }
  });

  // --- Verify OTP and issue tokens ---
  router.post('/verify-email', async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ error: 'email and otp required' });

      const otpKey = `otp:${email}`;
      const attemptsKey = `otp:attempts:${email}`;
      const recordRaw = await redis.get(otpKey);
      if (!recordRaw) return res.status(400).json({ error: 'Không có mã OTP hoặc đã hết hạn. Vui lòng yêu cầu lại.' });

      const { otpHash, salt } = JSON.parse(recordRaw);
      const attempts = parseInt(await redis.get(attemptsKey) || '0', 10);
      if (attempts >= MAX_WRONG_ATTEMPTS) {
        await redis.del(otpKey);
        await redis.del(attemptsKey);
        return res.status(429).json({ error: 'Quá nhiều lần nhập sai. Vui lòng yêu cầu mã mới.' });
      }

      if (hashOtp(otp, salt) !== otpHash) {
        await redis.incr(attemptsKey);
        await redis.expire(attemptsKey, 30 * 60);
        return res.status(400).json({ error: 'Mã OTP không đúng' });
      }

      // OTP đúng -> mark user verified
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(400).json({ error: 'Không tìm thấy user' });
      if (user.isVerified) {
        await redis.del(otpKey);
        return res.status(400).json({ error: 'Email đã được xác thực trước đó' });
      }

      await prisma.user.update({ where: { id: user.id }, data: { isVerified: true, lastLoginAt: new Date() } });

      // mark latest emailVerification used = true (optional: find by userId and not used)
      await prisma.emailVerification.updateMany({
        where: { userId: user.id, type: 'email_verify', used: false },
        data: { used: true }
      });

      // cleanup redis
      await redis.del(otpKey);
      await redis.del(attemptsKey);
      await redis.del(`otp:cooldown:${email}`);
      await redis.del(`otp:count:${email}`);

      // create refresh token as in login flow
      const accessToken = signAccessToken(user);
      const refreshTokenValue = uuidv4();
      const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 3600 * 1000);
      await prisma.refreshToken.create({
        data: { token: refreshTokenValue, userId: user.id, expiresAt }
      });

      return res.json({ accessToken, refreshToken: refreshTokenValue, expiresIn: ACCESS_EXPIRES });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Lỗi server' });
    }
  });

  // --- Resend OTP ---
  router.post('/resend-otp', async (req, res) => {
    try {
      const { email } = req.body; 
      if (!email) return res.status(400).json({ error: 'email required' });

      const user = await prisma.user.findUnique({ where: { email }});
      if (!user) return res.status(400).json({ error: 'Không tìm thấy user' });
      if (user.isVerified) return res.status(400).json({ error: 'Email đã được xác thực' });

      const sentCountKey = `otp:count:${email}`;
      const cooldownKey = `otp:cooldown:${email}`;
      const sendCount = parseInt(await redis.get(sentCountKey) || '0', 10);

      if (sendCount >= MAX_SEND_PER_DAY) return res.status(429).json({ error: 'Đã gửi quá nhiều lần trong ngày' });
      if (await redis.exists(cooldownKey)) return res.status(429).json({ error: 'Vừa gửi mã, vui lòng chờ vài giây' });

      const otp = generateOtp();
      const salt = randomSalt();
      const otpHash = hashOtp(otp, salt);
      const otpKey = `otp:${email}`;
      await redis.set(otpKey, JSON.stringify({ otpHash, salt }), 'EX', OTP_TTL);
      await redis.incr(sentCountKey); await redis.expire(sentCountKey, 24 * 3600);
      await redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN);

      // optional: create a new emailVerification record for audit
      await prisma.emailVerification.create({
        data: { token: uuidv4(), userId: user.id, type: 'email_verify', used: false, expiresAt: new Date(Date.now() + OTP_TTL*1000) }
      });

      await sendOtpEmail(email, otp);
      return res.json({ message: 'Mã OTP đã được gửi lại' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Lỗi server' });
    }
  });

  // --- existing login: block if not verified ---
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });
      const user = await prisma.user.findUnique({ where: { email }});
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      if (!user.isVerified) return res.status(403).json({ error: 'Email chưa xác thực. Vui lòng kiểm tra email.' });

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      const accessToken = signAccessToken(user);

      const refreshTokenValue = uuidv4();
      const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
      await prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          userId: user.id,
          expiresAt
        }
      });

      res.json({ accessToken, refreshToken: refreshTokenValue, expiresIn: ACCESS_EXPIRES });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi server' });
    }
  });

  // keep token refresh & logout routes as you had them...
  router.post('/token/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

    const record = await prisma.refreshToken.findUnique({ where: { token: refreshToken }, include: { user: true }});
    if (!record || record.revoked) return res.status(401).json({ error: 'Invalid refresh token' });
    if (new Date(record.expiresAt) < new Date()) return res.status(401).json({ error: 'Refresh token expired' });

    const accessToken = signAccessToken(record.user);
    res.json({ accessToken });
  });

  router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
    await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revoked: true }});
    res.json({ ok: true });
  });

  export default router;
