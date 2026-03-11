# Chat Kiosk UI

Deze service is de afgeslankte kioskvariant voor single-screen questioner deployments. Ze gebruikt geen lokale `chat-proxy` of aparte Python-tussenlaag. Voor containerdeployments draait de browser same-origin tegen `/questioner`, waarna Nginx intern doorproxy't naar `pixie-questioner` op hetzelfde Docker-netwerk.

De UI is bedoeld voor een groot portrait-scherm in de winkel:
- fullscreen en portrait-first
- grote welkomstcopy die van op afstand leesbaar blijft
- chatinteractie geoptimaliseerd voor iemand die vlak voor het scherm staat

## Configuratie

De kiosk leest configuratie in deze volgorde:

1. runtime-config via `window.__ENV__` in `env-config.js`
2. build-time `VITE_*` variabelen
3. ingebakken defaults voor Cretskens

Voor PiXie- en containerdeployments is runtime-config de bedoeling. Gebruik daarvoor:

- `QUESTIONER_API_BASE_URL` - browser-zichtbare basis-URL van de questioner endpoint; aanbevolen voor containers: `/questioner`
- `PIXIE_QUESTIONER_CASE_ID` - case id, bijvoorbeeld `cretskens`
- `KIOSK_IDLE_TIMEOUT_MS` - optioneel, standaard `90000`
- `KIOSK_RESET_DELAY_MS` - optioneel, standaard `10000`
- `ACTIVE_CLIENT_DISPLAY_NAME` - optioneel
- `ACTIVE_CLIENT_PRIMARY_COLOR` - optioneel
- `ACTIVE_CLIENT_LOGO_URL` - optioneel
- `ACTIVE_CLIENT_LOGO_NO_TEXT_URL` - optioneel
- `ACTIVE_CLIENT_BACKGROUND_IMAGE_URL` - optioneel
- `ACTIVE_CLIENT_WELCOME_MESSAGE` - optioneel
- `ACTIVE_CLIENT_CHAT_HEADER_TITLE` - optioneel
- `KIOSK_START_LABEL` - optioneel
- `KIOSK_HELP_TEXT` - optioneel

In PiXie hoort die runtime-config normaal uit `cases/<CASE_ID>/client.env` en `cases/<CASE_ID>/branding` te komen. Voor `vite dev` blijven `VITE_*` variabelen ondersteund.

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
export PIXIE_QUESTIONER_CASE_ID=cretskens
export KIOSK_BRANDING_PATH=/pad/naar/PiXie/cases/cretskens/branding
docker compose \
  --env-file /pad/naar/PiXie/cases/cretskens/client.env \
  -f services/chat-kiosk-ui/docker-compose.kiosk.yml \
  up --build
```

Gedrag:
- de browser opent `http://localhost:8080`
- de kiosk-app spreekt `POST /questioner/cases/{case_id}/chat` aan
- Nginx in de kiosk-container proxyt dat intern naar `http://questioner-api:8000`
- bij containerstart schrijft `inject-runtime-config.sh` een `env-config.js` op basis van runtime env vars
- `pixie-questioner` hoeft dus niet apart naar de host gepubliceerd te worden
- branding-assets worden gemount onder `/branding/<case-id>/*`
- met `--env-file .../client.env` gebruik je dezelfde case-config als in PiXie

Voorwaarden:
- er moet al een `questioner-api` service op `pixie-network` bestaan
- standaard gebruikt de compose-file netwerk `pixie-network`; override kan via `PIXIE_DOCKER_NETWORK`
- `KIOSK_BRANDING_PATH` moet wijzen naar de echte brandingmap van de actieve case

## Testen

```bash
cd services/chat-kiosk-ui
npm run test:unit
```

## Builden

Voor lokale builds kun je nog steeds `VITE_*` gebruiken:

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
