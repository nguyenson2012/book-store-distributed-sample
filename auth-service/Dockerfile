FROM node:20-alpine

WORKDIR /app

# Cài đặt production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy mã nguồn
COPY . .

# Biến môi trường mặc định (Cloud Run tự inject PORT=8080)
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

CMD ["node", "src/index.js"]
