FROM node:20-alpine

WORKDIR /app

# copy package.json và package-lock.json
COPY package*.json ./

# cài dependencies
RUN npm ci

# copy toàn bộ code
COPY . .

# generate prisma client (nếu có Prisma)
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
