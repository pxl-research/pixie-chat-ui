FROM node:22-alpine
WORKDIR /app/services/chat-ui
COPY services/chat-ui/package.json services/chat-ui/package-lock.json ./
RUN npm ci
COPY shared/ /app/shared/
COPY services/chat-ui/ .
RUN npm run build
CMD ["sh", "-c", "node scripts/inject-runtime-config.mjs && npm run preview -- --host 0.0.0.0 --port 3000"]
