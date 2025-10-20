FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["sh", "-c", "node scripts/inject-runtime-config.mjs && npm run preview -- --host 0.0.0.0 --port 3000"]
