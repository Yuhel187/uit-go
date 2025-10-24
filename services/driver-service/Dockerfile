# -----------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci
# -----------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# -----------------------------
FROM node:20-alpine
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY .env ./

EXPOSE 3001
CMD ["node", "dist/index.js"]
