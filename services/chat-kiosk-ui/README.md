# Chat Kiosk UI

Deze service is de afgeslankte kioskvariant voor de Cretskens-case. Ze gebruikt geen lokale `chat-proxy` of aparte Python-tussenlaag. Voor containerdeployments draait de browser same-origin tegen `/questioner`, waarna Nginx intern doorproxy't naar `pixie-questioner` op hetzelfde Docker-netwerk.

De UI is bedoeld voor een groot portrait-scherm in de winkel:
- fullscreen en portrait-first
- grote welkomstcopy die van op afstand leesbaar blijft
- chatinteractie geoptimaliseerd voor iemand die vlak voor het scherm staat

## Vereiste env vars

- `VITE_QUESTIONER_API_BASE_URL` - browser-zichtbare basis-URL van de questioner endpoint; aanbevolen voor containers: `/questioner`
- `VITE_QUESTIONER_CASE_ID` - case id, bijvoorbeeld `cretskens`
- `VITE_KIOSK_IDLE_TIMEOUT_MS` - optioneel, standaard `90000`
- `VITE_KIOSK_RESET_DELAY_MS` - optioneel, standaard `10000`
- `VITE_ACTIVE_CLIENT_DISPLAY_NAME` - optioneel, standaard `CRETSKENS`
- `VITE_ACTIVE_CLIENT_PRIMARY_COLOR` - optioneel, standaard `#6A1E2C`
- `VITE_ACTIVE_CLIENT_LOGO_URL` - optioneel, standaard `/branding/cretskens/logo.png`
- `VITE_ACTIVE_CLIENT_LOGO_NO_TEXT_URL` - optioneel, standaard `/branding/cretskens/logo_no_text.png`
- `VITE_ACTIVE_CLIENT_BACKGROUND_IMAGE_URL` - optioneel, standaard `/branding/cretskens/background.png`
- `VITE_ACTIVE_CLIENT_WELCOME_MESSAGE` - optioneel, standaard Cretskens welkomsttekst
- `VITE_ACTIVE_CLIENT_CHAT_HEADER_TITLE` - optioneel, standaard `Cretskens Wijnassistent`
- `VITE_KIOSK_START_LABEL` - optioneel, standaard `Start gesprek`
- `VITE_KIOSK_HELP_TEXT` - optioneel, standaard `Tik op start en laat je stap voor stap begeleiden.`

## Ontwikkelen

```bash
cd services/chat-kiosk-ui
npm install
VITE_QUESTIONER_API_BASE_URL=http://localhost:8000 \
VITE_QUESTIONER_CASE_ID=cretskens \
VITE_ACTIVE_CLIENT_CHAT_HEADER_TITLE="Cretskens Wijnassistent" \
VITE_ACTIVE_CLIENT_WELCOME_MESSAGE="Hallo, ik ben je Cretskens AI-assistent. Ik help je graag om de juiste wijn bij je gerecht te vinden." \
npm run dev
```

Deze `vite`-flow is alleen handig als `pixie-questioner` ook vanaf je browser rechtstreeks bereikbaar is, bijvoorbeeld via `http://localhost:8000`.

## Container-based testen op hetzelfde Docker-netwerk

Wanneer `pixie-questioner` alleen intern op `pixie-network` draait, gebruik dan de kiosk-container zelf:

```bash
cd ../..
export KIOSK_BRANDING_PATH=/pad/naar/PiXie/cases/cretskens/branding
docker compose -f services/chat-kiosk-ui/docker-compose.kiosk.yml up --build
```

Gedrag:
- de browser opent `http://localhost:8080`
- de kiosk-app spreekt `POST /questioner/cases/{case_id}/chat` aan
- Nginx in de kiosk-container proxyt dat intern naar `http://questioner-api:8000`
- `pixie-questioner` hoeft dus niet apart naar de host gepubliceerd te worden
- branding-assets worden gemount onder `/branding/cretskens/*`

Voorwaarden:
- er moet al een `questioner-api` service op `pixie-network` bestaan
- standaard gebruikt de compose-file netwerk `pixie-network`; override kan via `PIXIE_DOCKER_NETWORK`
- `KIOSK_BRANDING_PATH` moet wijzen naar de echte Cretskens-brandingmap

## Testen

```bash
cd services/chat-kiosk-ui
npm run test:unit
```

## Builden

```bash
cd services/chat-kiosk-ui
VITE_QUESTIONER_API_BASE_URL=/questioner \
VITE_QUESTIONER_CASE_ID=cretskens \
npm run build
```

## Container image

```bash
cd ../..
docker build -f services/chat-kiosk-ui/Dockerfile -t chat-kiosk-ui .
```

Gebruik voor Docker altijd de repository-root als build context, zodat de gedeelde map `shared/` mee in de imagebouw zit. De container serveert de statische build via Nginx op poort `8080`.

## Kioskstart op Jetson

Gebruik `services/chat-kiosk-ui/scripts/start-kiosk.sh` nadat de webserver lokaal bereikbaar is:

```bash
./services/chat-kiosk-ui/scripts/start-kiosk.sh
```
