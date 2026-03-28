# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci --only=production

# ── Production stage ────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Install ffmpeg for audio format conversion
RUN apk add --no-cache ffmpeg

# Copy built node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
