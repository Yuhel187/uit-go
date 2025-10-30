import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mở rộng kiểu Request của Express để chứa thông tin user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Service không thể chạy nếu thiếu JWT_SECRET
  throw new Error('JWT_SECRET environment variable is not set!');
}

/**
 * Middleware xác thực JWT
 * Verifies JWT and attaches user payload (id, role) to req.user
 */
export function auth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    // Payload từ user-service có dạng: { sub: user.id, email: user.email, role: user.role }
    const payload = jwt.verify(token, JWT_SECRET as string) as jwt.JwtPayload;

    if (!payload.sub || !payload.role) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Gán thông tin user vào request
    req.user = {
      id: Number(payload.sub),
      role: payload.role as string,
    };
    
    next();

  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware kiểm tra user có phải là Passenger
 */
export function isPassenger(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'PASSENGER') {
    return res.status(403).json({ error: 'Forbidden: Passengers only' });
  }
  next();
}

/**
 * Middleware kiểm tra user có phải là Driver
 */
export function isDriver(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'DRIVER') {
    return res.status(403).json({ error: 'Forbidden: Drivers only' });
  }
  next();
}