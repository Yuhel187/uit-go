import express from 'express';
import prisma from '../prismaClient.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const SALT_ROUNDS = 10;
const ACCESS_EXPIRES = '15m';        // access token lifetime
const REFRESH_EXPIRES_DAYS = 30;     // refresh token expiry (days)

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

router.post('/register', async (req, res) => {
  const { email, password, name, phone, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already used' });

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, password: hash, name, phone, role: role || 'PASSENGER' }
  });

  const safe = { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role };
  res.status(201).json(safe);
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = await prisma.user.findUnique({ where: { email }});
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

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
});

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
