
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app

# Lấy node_modules từ stage 'deps'
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

COPY prisma ./prisma/


RUN npx prisma generate

RUN npm run build


# -----------------------------
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

COPY --from=build /app/prisma ./prisma/

COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3002
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]