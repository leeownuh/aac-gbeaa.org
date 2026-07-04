FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV SERVE_STATIC=false
ENV DATA_ROOT=/mnt/data

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "node scripts/seedData.js && node src/index.js"]
