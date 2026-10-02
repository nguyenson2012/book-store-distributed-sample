# Stage 1: Build React Vite app
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build argument cho API URL (sẽ được CI/CD inject vào lúc build Vite)
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# Stage 2: Production Nginx image (nhẹ ~25MB)
FROM nginx:alpine

# Copy cấu hình Nginx lắng nghe port 8080 và fallback SPA router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets sau khi build
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
