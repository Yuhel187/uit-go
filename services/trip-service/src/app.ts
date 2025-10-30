import express from 'express';
// 1. Sửa import: Trỏ đến file router chính (src/index.ts)
import mainRouter from './index'; 
import { notFound, errorHandler } from './middlewares/error.handler';
import { z } from 'zod'; // Import Zod

const app = express();

app.use(express.json());
app.use('/api', mainRouter);

// --- Error Handling ---

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof z.ZodError) {
    console.warn('Zod Validation Error:', err.issues);
    return res.status(400).json({
      error: 'Invalid input',
      details: err.flatten().fieldErrors,
    });
  }
  next(err);
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3002; 

app.listen(PORT, () => {
  console.log(`[TripService] Server listening on port ${PORT}`);
});