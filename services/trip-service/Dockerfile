# -----------------------------
# Stage 1: Cài đặt Dependencies
# -----------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# -----------------------------
# Stage 2: Build ứng dụng
# -----------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# === SỬA LỖI: Thêm 2 dòng sau để generate Prisma Client ===
COPY prisma ./prisma
RUN npx prisma generate
# === Kết thúc sửa lỗi ===

RUN npm run build

# -----------------------------
# Stage 3: Chạy ứng dụng
# -----------------------------
FROM node:20-alpine
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Thêm package.json và prisma schema để chạy migration
COPY package*.json ./
COPY prisma ./prisma

# SỬA LỖI: Expose đúng port (3002) cho trip-service
EXPOSE 3002

# SỬA LỖI: Tự động chạy migration khi khởi động
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]