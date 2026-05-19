# ─────────────────────────────────────────────────────────────
# Frontend Dockerfile — Multi-stage (development + production)
# ─────────────────────────────────────────────────────────────

# ── Development Stage ────────────────────────────────────────
FROM node:18-alpine AS development

LABEL description="Asset Inventory - React Frontend"

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["npm", "start"]

# ── Build Stage ───────────────────────────────────────────────
# FROM node:20-alpine AS builder
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
#RUN npm ci --omit=dev
# RUN npm install --legacy-peer-deps --omit=dev
RUN npm install --legacy-peer-deps
COPY . .

# Build React app
ARG REACT_APP_API_BASE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

RUN npm run build

# ── Production Stage (nginx) ──────────────────────────────────
FROM nginx:1.27-alpine AS production

LABEL description="Asset Inventory - React Frontend (Production)"

# Copy built assets
COPY --from=builder /app/build /usr/share/nginx/html

# Nginx config for React SPA (client-side routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check for ECS
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
