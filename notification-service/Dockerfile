FROM node:20-alpine

WORKDIR /app

# Copy package files trước để tận dụng Docker layer cache
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

ENV PORT=8080
ENV NODE_ENV=production

# Cloud Run cần container expose HTTP để health check
# index.js đã có HTTP server nhỏ cho mục đích này
EXPOSE 8080

CMD ["node", "src/index.js"]
