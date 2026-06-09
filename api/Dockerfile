FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/
COPY dashboard.declaration.md ./

CMD ["node", "src/server.js"]
