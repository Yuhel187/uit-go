import express from 'express';
import auth from '../middlewares/auth.js';
const router = express.Router();

router.get('/me', auth, (req, res) => {
  const { password, ...safe } = req.user;
  res.json(safe);
});

export default router;
