# Design: Cretskens Kiosk Chat

## Status
- Datum: 2026-03-10
- Scope: `services/chat-kiosk-ui` (nieuw), beperkte shared contract/client extractie
- Type: nieuwe kiosk-ervaring naast bestaande VM-flow

## Context
Deze repository ondersteunt vandaag een bestaande chatopstelling waarbij meerdere gebruikers tegelijk via hun eigen smartphone met dezelfde deployment verbinden. Die use case draait stabiel op een VM en bevat extra voorzorgsmaatregelen rond multi-user sessies, URL-context, abuse guards en proxy-routing. Die flow blijft ongewijzigd.

Voor de Cretskens-case komt er een tweede use case:
- één fullscreen scherm dat we zelf beheren;
- geen zichtbare URL of deeplinks;
- geen koppeling met smartphones of andere schermen;
- deploy op een Jetson Nano met beperkte RAM;
- rechtstreekse communicatie met `pixie-questioner`;
- blijvende compatibiliteit met `pixie-contracts`.

## Probleem
De huidige stack bevat twee services (`chat-ui` en `chat-proxy`) en sleept voor de kioskflow functionaliteit mee die daar geen waarde heeft:
- multi-user sessiebeveiliging;
- proxy-, CORS- en gateway-opzet;
- URL/location-validatie;
- client-config endpoint;
- smartphone- en linkgedreven states.

Een naïeve vereenvoudiging van de bestaande stack verhoogt het risico op regressies in de stabiele VM-use-case. Een aparte fork in een nieuwe repo verhoogt dan weer het risico op contractdrift en dubbele onderhoudslast.

## Doel
Een aparte, lichte kiosk-app toevoegen voor Cretskens die:
- rechtstreeks met `pixie-questioner` praat;
- het `pixie-contracts` chatcontract blijft respecteren;
- een simpele kiosk-flow biedt: startscherm -> chat -> afronding/reset;
- de bestaande VM-use-case niet destabiliseert.

## Niet-doelen
- Geen wijziging aan de bestaande VM-deployment (`gateway + chat-proxy + chat-ui`).
- Geen herbouw van `chat-proxy` voor kioskgebruik.
- Geen gedeelde runtime-mode in één frontend-app.
- Geen nieuwe repo in de eerste fase.
- Geen multi-user, deeplink-, locatie- of debugflow in de kiosk-v1.

## Beslissing
We houden beide producten in dezelfde repo, maar scheiden ze als twee expliciete deployables:

1. `Use case 1`: bestaande VM-flow blijft bestaan zoals vandaag.
2. `Use case 2`: nieuwe kiosk-app in `services/chat-kiosk-ui`, rechtstreeks gekoppeld aan `pixie-questioner`.

De twee producten delen alleen een minimale contract/clientlaag. Alle kiosk-specifieke UX, state en build-opzet blijven gescheiden van de bestaande smartphone-flow.

## Waarom deze aanpak

### Gekozen optie: aparte kiosk-app in dezelfde repo
Voordelen:
- maximale functionele isolatie voor de stabiele VM-flow;
- minimale kans op contractdrift doordat contractcode in dezelfde repo blijft;
- lichtere Jetson-build omdat de proxy- en multi-userlaag volledig wegvalt;
- eenvoudiger onderhoud dan een aparte fork.

Nadelen:
- twee frontend-apps in dezelfde repo vragen iets meer release- en CI-discipline.

### Verworpen optie: nieuwe repo met minimale fork
Niet gekozen omdat dit contract- en parserlogica zou dupliceren en elke wijziging in `pixie-contracts` op twee plaatsen zou moeten landen.

### Verworpen optie: één app met runtime modes
Niet gekozen omdat dit de bestaande use case structureel in gevaar brengt en historische complexiteit in de kiosk-build houdt.

## Architectuur

### Bestaand product (ongewijzigd)
- `services/chat-ui`
- `services/chat-proxy`
- `infra/docker/docker-compose.dev.yml`

Deze flow blijft verantwoordelijk voor smartphonegebruik, proxy-routing, guards en client-config.

### Nieuw product
- nieuw: `services/chat-kiosk-ui`
- runtime: statische frontend + lichte lokale webserver + Chromium kiosk/fullscreen
- netwerkpad: browser -> `pixie-questioner` (`POST /cases/{case_id}/chat`)

Er draait geen lokale Python proxy meer op de Jetson.

### Gedeelde code
Alleen de volgende delen mogen gedeeld worden:
- contracttypes gegenereerd uit `pixie-contracts`;
- kleine `questioner` API-client/helper;
- response-normalisatie voor questioner-antwoorden;
- eventueel gedeelde branding-assets.

De volgende zaken worden expliciet niet gedeeld:
- proxy-routing;
- abuse guards;
- multi-user sessielogica;
- location/url-validatie;
- client-config endpoint;
- kiosk-UX states.

## Kiosk UX en state machine
De kiosk-app krijgt een kleine, expliciete state machine:
- `attract/start`
- `chatting`
- `completed`
- `timeout-reset`
- `fatal-error/offline`

### Gebruikersflow
1. Startscherm met Cretskens-branding, korte instructie en duidelijke startknop.
2. Chat met één actieve sessie tegelijk, grote touch targets en optionele quick replies.
3. Afronding met duidelijke afsluiter en automatische reset of knop om opnieuw te starten.
4. Inactiviteit reset de volledige sessie terug naar start.

### Sessies
- sessiestate leeft alleen in memory;
- nieuwe sessie bij elke start;
- geen persistence in `localStorage`;
- geen hervatten van vorige chats;
- geen browser-history of deep links.

## Contract en integratie
De kiosk-app moet compatibel blijven met `pixie-questioner` en `pixie-contracts`:
- request-opbouw volgt het bestaande chatcontract;
- contractheadercontrole blijft behouden;
- contract mismatch faalt gesloten met generieke servicemelding;
- response parsing blijft robuust voor antwoorden, follow-up vragen, summary/completion en quick replies.

Belangrijke randvoorwaarde:
- de Jetson-browser moet `pixie-questioner` rechtstreeks kunnen bereiken;
- CORS en eventuele authenticatie moeten browserverkeer expliciet toelaten;
- als een geheime server-side sleutel vereist blijkt, is een lokale tussenlaag alsnog nodig.

## Minimale feature set v1
- startscherm;
- single-session chat;
- quick replies indien teruggestuurd door `pixie-questioner`;
- inactivity timeout + reset;
- completed state + restart;
- duidelijke offline/error state;
- Cretskens-branding.

## Uit scope voor v1
- analytics;
- meertaligheid;
- uitgebreide theming-engine;
- debugtoggle;
- URL/location-context;
- multi-user functionaliteit;
- lokale proxy of telemetryservice op het device.

## Foutafhandeling
- `questioner` onbereikbaar: toon simpele “tijdelijk niet beschikbaar”-state met retry/reset.
- Contract mismatch: generieke foutstate, behandelen als deploymentfout.
- Ongeldige response: generieke foutstate met herstelpad naar start.
- Netwerkverlies: offline-state, nooit in half-afgeronde chat blijven hangen.

Elke fout eindigt in een kleine, duidelijke recovery:
- `Opnieuw proberen`
- of automatische reset naar start

## Teststrategie

### Gedeelde contract/clientlaag
- unit-tests voor request-opbouw;
- unit-tests voor contractheadercontrole;
- unit-tests voor response-normalisatie.

### Kiosk-app
- tests voor `start -> chat -> completed -> reset`;
- tests voor idle-timeout reset;
- tests voor offline/error state;
- tests voor contract mismatch state.

De kiosk krijgt een eigen testsuite. Bestaande tests van `chat-ui` blijven ongewijzigd en bewaken use case 1.

## Build, deploy en operations
- bestaande CI/CD voor `chat-ui` en `chat-proxy` blijft onaangeroerd;
- `chat-kiosk-ui` krijgt eigen build en artifact;
- Jetson-deploy bestaat idealiter uit één lichte static app + lokale server;
- Chromium kiosk-start komt in een apart operationeel script;
- resourcegebruik wordt op de Jetson gemeten vóór productie-uitrol.

## Migratiepad
1. Extraheer de minimale gedeelde contract/clientcode uit de bestaande UI.
2. Bouw `services/chat-kiosk-ui` als nieuwe app in dezelfde repo.
3. Koppel de app end-to-end aan staging van `pixie-questioner` voor de Cretskens-case.
4. Test geheugen- en CPU-verbruik op de Jetson Nano.
5. Laat de bestaande VM-flow volledig ongemoeid tot de kiosk stabiel bewezen is.

## Risico's en mitigatie
- Risico: contractdrift tussen bestaande UI en kiosk.
  Mitigatie: gedeelde contract/clientlaag vanuit dezelfde bron.

- Risico: browser-to-backend connectie faalt door CORS/auth.
  Mitigatie: vroeg valideren in staging vóór kioskbouw afronden.

- Risico: kiosk blijft hangen in fout- of idle-state.
  Mitigatie: expliciete state machine en harde resetpaden.

- Risico: Jetson Nano heeft te weinig resources voor de gekozen toolchain.
  Mitigatie: minimalistische app, eigen artifact, vroeg performantie meten.

## Acceptatiecriteria
1. De bestaande VM-use-case draait ongewijzigd verder.
2. De kiosk-app kan rechtstreeks met `pixie-questioner` praten voor de Cretskens-case.
3. De kiosk volgt het overeengekomen chatcontract en detecteert contractmismatches.
4. De kiosk reset betrouwbaar na afronding of inactiviteit.
5. De kiosk-build bevat geen proxy- of multi-userfunctionaliteit.
