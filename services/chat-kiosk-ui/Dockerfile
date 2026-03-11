FROM node:20-alpine AS build
WORKDIR /app
COPY services/chat-kiosk-ui/package.json services/chat-kiosk-ui/package-lock.json ./services/chat-kiosk-ui/
WORKDIR /app/services/chat-kiosk-ui
RUN npm ci
WORKDIR /app
COPY shared ./shared
COPY services/chat-kiosk-ui ./services/chat-kiosk-ui
WORKDIR /app/services/chat-kiosk-ui
ARG VITE_QUESTIONER_API_BASE_URL=/questioner
ARG VITE_QUESTIONER_CASE_ID=cretskens
ARG VITE_KIOSK_IDLE_TIMEOUT_MS=90000
ARG VITE_KIOSK_RESET_DELAY_MS=10000
ARG VITE_ACTIVE_CLIENT_DISPLAY_NAME=CRETSKENS
ARG VITE_ACTIVE_CLIENT_PRIMARY_COLOR=#6A1E2C
ARG VITE_ACTIVE_CLIENT_LOGO_URL=/branding/cretskens/logo.png
ARG VITE_ACTIVE_CLIENT_LOGO_NO_TEXT_URL=/branding/cretskens/logo_no_text.png
ARG VITE_ACTIVE_CLIENT_BACKGROUND_IMAGE_URL=/branding/cretskens/background.png
ARG VITE_ACTIVE_CLIENT_WELCOME_MESSAGE="Hallo, ik ben je Cretskens AI-assistent. Ik help je graag om de juiste wijn bij je gerecht te vinden. Vertel me wat je gaat eten, dan maak ik een duidelijke samenvatting voor gericht advies in de winkel."
ARG VITE_ACTIVE_CLIENT_CHAT_HEADER_TITLE="Cretskens Wijnassistent"
ARG VITE_KIOSK_START_LABEL="Start gesprek"
ARG VITE_KIOSK_HELP_TEXT="Tik op start en laat je stap voor stap begeleiden."
ENV VITE_QUESTIONER_API_BASE_URL=$VITE_QUESTIONER_API_BASE_URL
ENV VITE_QUESTIONER_CASE_ID=$VITE_QUESTIONER_CASE_ID
ENV VITE_KIOSK_IDLE_TIMEOUT_MS=$VITE_KIOSK_IDLE_TIMEOUT_MS
ENV VITE_KIOSK_RESET_DELAY_MS=$VITE_KIOSK_RESET_DELAY_MS
ENV VITE_ACTIVE_CLIENT_DISPLAY_NAME=$VITE_ACTIVE_CLIENT_DISPLAY_NAME
ENV VITE_ACTIVE_CLIENT_PRIMARY_COLOR=$VITE_ACTIVE_CLIENT_PRIMARY_COLOR
ENV VITE_ACTIVE_CLIENT_LOGO_URL=$VITE_ACTIVE_CLIENT_LOGO_URL
ENV VITE_ACTIVE_CLIENT_LOGO_NO_TEXT_URL=$VITE_ACTIVE_CLIENT_LOGO_NO_TEXT_URL
ENV VITE_ACTIVE_CLIENT_BACKGROUND_IMAGE_URL=$VITE_ACTIVE_CLIENT_BACKGROUND_IMAGE_URL
ENV VITE_ACTIVE_CLIENT_WELCOME_MESSAGE=$VITE_ACTIVE_CLIENT_WELCOME_MESSAGE
ENV VITE_ACTIVE_CLIENT_CHAT_HEADER_TITLE=$VITE_ACTIVE_CLIENT_CHAT_HEADER_TITLE
ENV VITE_KIOSK_START_LABEL=$VITE_KIOSK_START_LABEL
ENV VITE_KIOSK_HELP_TEXT=$VITE_KIOSK_HELP_TEXT
RUN npm run build

FROM nginx:alpine
COPY services/chat-kiosk-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/services/chat-kiosk-ui/dist /usr/share/nginx/html
COPY services/chat-kiosk-ui/scripts/inject-runtime-config.sh /docker-entrypoint.d/40-inject-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-inject-runtime-config.sh
