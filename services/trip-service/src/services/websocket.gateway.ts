import { Server as HttpServer } from 'http';
import { Server as SocketIoServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { appEmitter, EmitterEvents } from '../lib/emitter'; 
import { Trip } from '@prisma/client';

interface JwtPayload {
  sub: number; 
  role: string;
}

export class WebSocketGateway {
  private io: SocketIoServer;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIoServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });
  }

  public initialize() {
    this.io.use((socket: Socket, next) => {
      const token = socket.handshake.auth.token;
      const secret = process.env.JWT_SECRET;

      if (!token || !secret) {
        return next(new Error('Authentication error'));
      }
      try {
        const payload = jwt.verify(token, secret) as unknown as JwtPayload;

        if (!payload.sub || !payload.role) {
          return next(new Error('Invalid token payload'));
        }

        (socket as any).user = {
          id: Number(payload.sub),
          role: payload.role,
        };
        next();
      } catch (err) {
        return next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = (socket as any).user;
      console.log(`[WebSocket] User connected: id=${user.id}, role=${user.role}`);

      socket.join(`user_${user.id}`); 

      socket.on('disconnect', () => {
        console.log(`[WebSocket] User disconnected: id=${user.id}`);
      });
    });

    this.listenToAppEvents();
  }

  // Lắng nghe sự kiện từ service
  private listenToAppEvents() {
    appEmitter.on(EmitterEvents.NOTIFY_DRIVER, (driverId: number, trip: Trip) => {
      const room = `user_${driverId}`;
      console.log(`[WebSocket] Emitting 'trip:request' to room: ${room}`);
      this.io.to(room).emit('trip:request', trip);
    });

    appEmitter.on(EmitterEvents.NOTIFY_PASSENGER, (passengerId: number, trip: Trip) => {
      const room = `user_${passengerId}`;
      console.log(`[WebSocket] Emitting 'trip:update' to room: ${room}`);
      this.io.to(room).emit('trip:update', trip);
    });
  }
}