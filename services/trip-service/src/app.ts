import express from 'express';
import { createServer } from 'http';
import { WebSocketGateway } from './services/websocket.gateway';
import mainRouter from './index'; 
import { notFound, errorHandler } from './middlewares/error.handler';
import { z } from 'zod'; 

const app = express();
const httpServer = createServer(app);

const wsGateway = new WebSocketGateway(httpServer);
wsGateway.initialize();

app.use(express.json());
app.use(mainRouter);

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

httpServer.listen(PORT, () => {
  console.log(`[TripService] Server (HTTP + WebSocket) listening on port ${PORT}`);
});