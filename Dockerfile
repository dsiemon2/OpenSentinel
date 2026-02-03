# Moltbot Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build
FROM oven/bun:1 as builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build web frontend
RUN cd src/web && bun install && bun run build

# Stage 2: Production
FROM oven/bun:1-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    # For Playwright/browser automation
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    # For screenshots (Linux)
    scrot \
    # For OCR
    tesseract-ocr \
    # For audio (PulseAudio)
    pulseaudio \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Copy from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/drizzle ./drizzle

# Create data directories
RUN mkdir -p /app/data /app/logs

# Environment
ENV NODE_ENV=production
ENV PORT=8030

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8030/health || exit 1

# Expose port
EXPOSE 8030

# Run
CMD ["bun", "run", "src/index.ts"]
