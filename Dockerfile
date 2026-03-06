# Multi-stage build for DeepSeek Code Platform

# ---- Build client ----
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- Build server ----
FROM node:20-alpine AS server-build
WORKDIR /app/server
# node-pty needs build tools
RUN apk add --no-cache python3 make g++
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---- Production image ----
FROM node:20-alpine AS production
WORKDIR /app

# Install runtime build tools for native modules
RUN apk add --no-cache python3 make g++

# Copy server production dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

WORKDIR /app
# Copy built server
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules

# Copy built client (served as static files)
COPY --from=client-build /app/client/dist ./client/dist

WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
