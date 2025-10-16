import 'dotenv/config';
export const ENV = {
  PORT: Number(process.env.PORT ?? 3001),
};
