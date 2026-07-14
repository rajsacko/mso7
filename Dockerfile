# MSO7 / Maison Edit — always-on Node host for Remotion encode + local data/
FROM node:20-bookworm-slim

# Chromium / compositor deps for @remotion/renderer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    REMOTION_CHROME_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Persist projects, uploads, brand, renders outside the container
RUN mkdir -p /app/data/projects /app/data/uploads /app/data/brand /app/data/renders
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["npm", "start"]
