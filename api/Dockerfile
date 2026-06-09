FROM node:20-alpine

WORKDIR /app

COPY api/package.json ./
RUN npm install --omit=dev

COPY api/src/ ./src/
COPY dashboard.declaration.md ./

CMD ["node", "src/server.js"]
