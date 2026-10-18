FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY dashboard.declaration.md ./

# Runtime-override volume (PUT /api/ai-dashboard/declaration writes here)
RUN mkdir -p /app/data

CMD ["node", "src/server.js"]
