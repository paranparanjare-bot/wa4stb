FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data/sessions data/media/qris data/media/receipts data/knowledge logs
CMD ["node", "src/index.js"]
