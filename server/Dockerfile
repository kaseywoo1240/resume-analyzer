FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    chromium \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./

# Install fresh on Linux so native modules compile correctly
RUN npm install

COPY . .
RUN npm run build

RUN mkdir -p data uploads && chmod 777 data uploads

EXPOSE 3001

CMD ["node", "dist/index.js"]
