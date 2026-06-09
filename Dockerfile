FROM node:20-alpine AS builder

# Build client
WORKDIR /build/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Build server
FROM node:20-alpine

WORKDIR /app

# Copy server files
COPY server/package*.json ./
RUN npm install --production

COPY server/ ./

# Copy built client app
COPY --from=builder /build/client/dist ./dist

# Create directories for volumes
RUN mkdir -p /app/data /app/uploads

EXPOSE 5296

CMD ["node", "index.js"]
