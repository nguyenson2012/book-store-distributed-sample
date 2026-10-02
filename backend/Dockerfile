FROM node:20-alpine

WORKDIR /app

# Cài đặt production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy toàn bộ mã nguồn
COPY . .

# Biến môi trường mặc định (Cloud Run tự inject PORT=8080)
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
