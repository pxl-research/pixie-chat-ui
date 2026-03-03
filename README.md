# Pixie Chat Experience

Dit onderdeel van het PiXie-platform levert de merkbare chatervaring waarin klanten met hun digitale assistent praten. De repository bundelt twee lichte services:

- **Chat Proxy** – vormt de schakel tussen de chatinterface en Pixie Core. Hij ontvangt de vraag van de gebruiker, stuurt die door naar de juiste Pixie-service en bezorgt het antwoord terug aan de UI.
- **Chat UI** – is de webinterface die het gesprek toont. Je personaliseert hem met de kleuren, logo’s en begroeting van jouw klant zodat de beleving naadloos in het merk past.

## Hoe dit past in PiXie

Binnen de bredere PiXie-architectuur werkt deze chatervaring samen met andere microservices:

- De chatinterface bepaalt of de gebruiker informatie zoekt of een aanbeveling wil.
- Informatieve vragen lopen naar de `pixie-informer` service, die documentfragmenten ophaalt uit de RAG-database en er een helder antwoord van maakt.
- Keuze- of aanbevelingsvragen gaan naar de `pixie-recommender`, die tabulaire gegevens raadpleegt en – indien nodig – bijkomende vragen stelt.
- Uploads en documentverrijking gebeuren in afzonderlijke services (`upload_ui`, `pixie-preprocessing`, `pixie-rag-db`, `pixie-tabular-db`). De chat profiteert van de kennis die daar wordt opgebouwd.

Zo vormt deze repository de zichtbare voorkant van een groter geheel: gebruikers stellen hun vraag in de UI, de proxy orchestreert het verkeer, en Pixie Core levert intelligente antwoorden gebaseerd op de beschikbare documenten en data.

## Wat je als beheerder doet

Je configureert de chat volledig via omgevingsvariabelen: kies de klant, stel kleur en logo in, voeg een welkomstboodschap toe en start de services. Daarna is de chat onmiddellijk beschikbaar en integreert hij vanzelf met de andere PiXie-componenten binnen je omgeving.

### Routeren tussen recommender, informer en questioner

Standaard stuurt de chat-proxy naar de recommender. Wil je tijdelijk de informer of questioner aanspreken, zet dan in `.env.dev`:

```
PIXIE_BACKEND_TARGET=informer
PIXIE_BACKEND_TARGET=questioner
```

De basis-URLs voor recommender, informer en questioner stel je via env vars in: `PIXIE_CORE_API_BASE_URL`, `PIXIE_INFORMER_API_BASE_URL` en `PIXIE_QUESTIONER_API_BASE_URL` (in Docker Compose alvast ingesteld in `infra/docker/docker-compose.dev.yml`). Standaard wijzen ze naar `http://recommender-api:8000`, `http://informer-api:8000` en `http://questioner-api:8000`. In beide gevallen gebruikt de UI automatisch de gesprekshistoriek en sessie-id zodat vervolgvragen hun context behouden.

Voor misbruikpreventie in de proxy kun je harde limieten instellen via env vars:
`MAX_CHAT_INPUT_CHARS`, `MAX_CHAT_STATE_BYTES`, `MAX_CHAT_HISTORY_ITEMS`,
`MAX_CHAT_HISTORY_ENTRY_CHARS`, `RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_PER_HOUR`,
`RATE_LIMIT_BLOCK_SECONDS`, `SESSION_IDLE_TIMEOUT_SECONDS`.

Wanneer `PIXIE_BACKEND_TARGET=questioner` controleert de proxy ook de contractversie via header `X-Pixie-Chat-Contract`. Standaard verwacht de proxy `chat-v2.0.0` (`PIXIE_CHAT_CONTRACT_VERSION`) en weigert hij mismatches (`STRICT_QUESTIONER_CHAT_CONTRACT=true`).

Voor de UI-types staat een gegenereerd contractbestand in `services/chat-ui/src/api/generated/chatContract.ts`. Regenereren kan met:

```
cd services/chat-ui
npm run generate:chat-contract
```

Vanaf `chat-v2.0.0` ondersteunt het contract ook optionele `quick_replies` op answer-responses. De UI toont die als klikbare antwoordchips boven het invoerveld.

### Debugmodus (beslisuitleg)

Voor de questioner-flow kun je in de UI een debugtoggle tonen die `state.debug_mode=true`
meestuurt. De backend kan dan een compacte trace teruggeven in `state.debug.trace`
(geen verborgen chain-of-thought).

- `ACTIVE_CLIENT_DEBUG_TOGGLE_ENABLED=true` toont de debugtoggle in de chatheader.
- `ACTIVE_CLIENT_DEBUG_DEFAULT_ENABLED=true` zet die toggle standaard aan.

Aan backendzijde kun je debug hard uitzetten met:

- `WINE_ADVISOR_DEBUG_ENABLED=false` (in `pixie-questioner`).

Als backend-debug uit staat, heeft de UI-toggle geen effect op de response.

### Ontwikkelen met Docker Compose

Gebruik het env-bestand `.env.dev` in de projectroot (kopieer `.env.example` indien nodig) en de compose-file `infra/docker/docker-compose.dev.yml`:

```
docker compose -f infra/docker/docker-compose.dev.yml up --build
```

De compose-file start een gateway (Caddy) op `http://localhost:3000` die UI en proxy onder dezelfde origin zet. De UI spreekt de API aan via `/api`, waardoor CORS niet nodig is zolang je via de gateway werkt. Voor mobiel/LAN volstaat het om de QR-code te richten op `http://<host-ip>:3000`.

### Landing page copy en startkeuzes

De UI toont eerst een landing page met een korte toelichting en een startknop. Je kunt de teksten en eventuele preset-knoppen via env vars aanpassen:

- `LANDING_TITLE` – kop bovenaan de landing page.
- `LANDING_RESEARCH_NOTE` – tekst over de TETRA-onderzoekcontext en experimentele antwoorden.
- `LANDING_PRIVACY_NOTE` – tekst over privacy/GDPR en het ontbreken van persoonsgegevens.
- `LANDING_START_LABEL` – label voor de hoofdknop (default: "Start assistent").
- `LANDING_PRESETS` – optionele preset-knoppen, pipe-gescheiden. Formaat `Label` of `Label=prefill`. Voorbeeld: `LANDING_PRESETS=Man|Vrouw|Rode wijn=Ik zoek een rode wijn|Witte wijn=Ik zoek een frisse witte wijn`. Ontbreekt deze variabele, dan verschijnt alleen de hoofdknop.

### Klantlocatie via URL-parameter

De chat-UI ondersteunt optioneel een locatiecontext via query-parameter in de URL. Ondersteunde key:

- `location`

Voorbeeld:

```
http://localhost:3000/?location=Antwerpen
```

Wanneer aanwezig, stuurt de UI deze waarde mee in de chat `state` als `location` bij elke beurt in de conversatie.

Om locatie te beperken tot een vaste lijst, configureer in de proxy:

- `ACTIVE_CLIENT_ALLOWED_LOCATIONS=Antwerpen|Gent|Hasselt`

Gedrag:

- matching is case-insensitive;
- de proxy normaliseert de `location`-waarde naar de geconfigureerde schrijfwijze;
- als `location` ontbreekt of niet in de allowlist zit, weigert `/chat` de request met `400`;
- de UI blokkeert ook meteen bij opstart als `?location=` ontbreekt of ongeldig is.
