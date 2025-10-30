import axios from 'axios';

export const driverServiceApi = axios.create({
  baseURL: process.env.DRIVER_SERVICE_URL || 'http://driver-service:3001',
  timeout: 5000, 
});