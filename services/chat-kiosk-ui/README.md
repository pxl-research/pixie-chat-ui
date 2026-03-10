# Chat Kiosk UI

Deze service is de afgeslankte kioskvariant voor de Cretskens-case. Ze draait rechtstreeks in de browser tegen `pixie-questioner` en gebruikt geen lokale `chat-proxy`.

## Vereiste env vars

- `VITE_QUESTIONER_API_BASE_URL` - basis-URL van `pixie-questioner`
- `VITE_QUESTIONER_CASE_ID` - case id, bijvoorbeeld `cretskens`
- `VITE_KIOSK_IDLE_TIMEOUT_MS` - optioneel, standaard `90000`
- `VITE_KIOSK_RESET_DELAY_MS` - optioneel, standaard `10000`

## Ontwikkelen

```bash
cd services/chat-kiosk-ui
npm install
VITE_QUESTIONER_API_BASE_URL=http://localhost:8000 \
VITE_QUESTIONER_CASE_ID=cretskens \
npm run dev
```

## Testen

```bash
cd services/chat-kiosk-ui
npm run test:unit
```

## Builden

```bash
cd services/chat-kiosk-ui
VITE_QUESTIONER_API_BASE_URL=http://questioner-api:8000 \
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

Gebruik [start-kiosk.sh](/Users/drphil/Documents/Werk/pixie-chat-ui/.worktrees/feat-cretskens-kiosk/services/chat-kiosk-ui/scripts/start-kiosk.sh) nadat de webserver lokaal bereikbaar is:

```bash
./scripts/start-kiosk.sh
```
