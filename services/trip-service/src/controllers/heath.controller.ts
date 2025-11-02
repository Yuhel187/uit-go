import { Request, Response } from 'express';
// import healthService from '../services/heath.service'; // Tạm thời không cần service

const checkHealth = (req: Request, res: Response) => {
  // const status = healthService.getStatus();
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    JWT_SECRET_DEBUG: process.env.JWT_SECRET ? `[ĐÃ SET] - 5 ký tự đầu: ${process.env.JWT_SECRET.substring(0, 5)}` : '[CHƯA SET - BỊ UNDEFINED]'
  });
};

export default { checkHealth };