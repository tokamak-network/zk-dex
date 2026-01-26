# ============================================
# ZK-DEX Frontend (Vue.js + Vite)
# Build context should be project root (../)
# ============================================

# Development stage
FROM node:20-bookworm-slim AS development

WORKDIR /app

# Install dependencies first (for caching)
COPY vapp/package*.json ./
RUN npm install

# Copy vapp source
COPY vapp/ .

# Copy contract artifacts (needed for TypeScript compilation)
COPY build/contracts/ ../build/contracts/

EXPOSE 8080

# Vite dev server with host binding for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ============================================
# Production build stage
# ============================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY vapp/package*.json ./
RUN npm install

# Copy vapp source
COPY vapp/ .

# Copy contract artifacts (needed for TypeScript compilation)
COPY build/contracts/ ../build/contracts/

RUN npm run build

# ============================================
# Production stage (nginx)
# ============================================
FROM nginx:alpine AS production

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY vapp/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
