import { PrismaClient } from '@prisma/client';
import { readReplicas } from '@prisma/extension-read-replicas';

export const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
}).$extends(
  readReplicas({
    url: process.env.DATABASE_URL_REPLICA as string,
  })
);
