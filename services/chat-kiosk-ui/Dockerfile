FROM node:20-alpine AS build
WORKDIR /app
COPY services/chat-kiosk-ui/package.json services/chat-kiosk-ui/package-lock.json ./services/chat-kiosk-ui/
WORKDIR /app/services/chat-kiosk-ui
RUN npm ci
WORKDIR /app
COPY shared ./shared
COPY services/chat-kiosk-ui ./services/chat-kiosk-ui
WORKDIR /app/services/chat-kiosk-ui
ARG VITE_QUESTIONER_API_BASE_URL=http://questioner-api:8000
ARG VITE_QUESTIONER_CASE_ID=cretskens
ARG VITE_KIOSK_IDLE_TIMEOUT_MS=90000
ARG VITE_KIOSK_RESET_DELAY_MS=10000
ENV VITE_QUESTIONER_API_BASE_URL=$VITE_QUESTIONER_API_BASE_URL
ENV VITE_QUESTIONER_CASE_ID=$VITE_QUESTIONER_CASE_ID
ENV VITE_KIOSK_IDLE_TIMEOUT_MS=$VITE_KIOSK_IDLE_TIMEOUT_MS
ENV VITE_KIOSK_RESET_DELAY_MS=$VITE_KIOSK_RESET_DELAY_MS
RUN npm run build

FROM nginx:alpine
COPY services/chat-kiosk-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/services/chat-kiosk-ui/dist /usr/share/nginx/html
