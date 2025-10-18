import 'dotenv/config';
import express from 'express';
import prisma from './prismaClient.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.get('/_health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;

async function start() {
  const maxRetries = 20;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      await prisma.$connect();
      break;
    } catch (err) {
      attempt++;
      console.log(`Prisma connect attempt ${attempt} failed. retrying in 1s...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  app.listen(port, () => console.log(`UserService listening on ${port}`));
}
start();
