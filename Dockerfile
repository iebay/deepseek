FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm ci
RUN cd client && npm ci
RUN cd server && npm ci
COPY . .
RUN cd client && npm run build
RUN cd server && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/package*.json ./
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
