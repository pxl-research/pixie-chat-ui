# Spec: Mobile-First Redesign voor Chat UI

## Status
- Datum: 2026-02-11
- Scope: `services/chat-ui`
- Type: UX/UI + frontend layout refactor (geen API-contractwijziging)

## Probleem
De huidige UI is primair opgebouwd vanuit desktop-patronen en schaalt daarna terug naar mobiel. Hierdoor voelt de ervaring op kleine smartphones (smalle viewport, mobiele toetsenbord-interactie, safe-area) secundair.

Gevolgen:
- minder consistente visual hierarchy op mobiel;
- te veel desktop-afhankelijke spacing en breedtegedrag;
- kans op frictie bij typen/scrollen met open keyboard;
- inconsistentie tussen landing, chat en foutstates op kleine schermen.

## Doel
De chatervaring wordt expliciet **mobile-first**: de basislayout en componentregels zijn ontworpen voor smartphone-portret, met progressive enhancement naar tablet en desktop.

## Niet-doelen
- Geen wijziging van chat-backendcontract of response-types.
- Geen redesign van merkidentiteit (kleur/logo/branding blijven behouden).
- Geen wijzigingen in conversational logic (state machine, summary/follow-up semantics).

## UX-principes
- **Mobile first baseline**: standaard CSS geldt voor smartphone.
- **Touch-first interactie**: minimale touch target 44x44 px.
- **Readability first**: duidelijke hiërarchie, compact maar niet krap.
- **Keyboard-safe composer**: input blijft bruikbaar bij open mobiel toetsenbord.
- **Consistente states**: landing, chat, error en invalid-location delen hetzelfde visuele systeem.

## Target viewports
- Smartphone small: 320x568 (minimum ondersteuning)
- Smartphone common: 360x800, 390x844
- Tablet: 768x1024
- Desktop: >= 1024 breed

## Breakpointstrategie
Mobile default zonder `max-width` hacks, met enkel uitbreidingen:
- `@media (min-width: 768px)` -> tablet
- `@media (min-width: 1024px)` -> desktop

Bestaande mobile-overrides met `max-width` worden herwerkt naar deze structuur.

## Functionele vereisten
1. Op mobiel is de chat full-height en full-width, zonder horizontale scroll.
2. Header blijft compact en consistent zichtbaar.
3. Message list is dominant; composer blijft stabiel onderaan.
4. `scroll-to-bottom` knop blijft bereikbaar en overlapt de composer niet.
5. Landing en invalid-location schermen tonen in één verticale flow met consistente kaartstijl.
6. Error feedback gebruikt dezelfde visuele taal als de rest van de app.
7. Zonder hover blijft alle interactie begrijpelijk en bruikbaar.

## UI/UX vereisten per onderdeel

### 1) App shell (`App.tsx`, `App.css`)
- Gebruik `min-height: 100dvh` voor betere mobile viewport-gedrag.
- Houd rekening met safe area: `padding-bottom: env(safe-area-inset-bottom)` waar relevant.
- Verwijder dubbele of conflicterende responsive regels.

### 2) Header (`Header.tsx`)
- Compacte hoogte op mobiel (visueel licht, niet dominant).
- Actieknop (`Nieuwe conversatie`) blijft touch-vriendelijk.
- Logo schaalt zonder layout shift.

### 3) Landing + Invalid location (`Landing.tsx`, `App.tsx` invalid state)
- Eén-kolom op mobiel.
- Notities in verticale stack (geen desktop-grid als default).
- CTA’s full-width op mobiel waar nuttig.
- Invalid-location state toont geen interne allowlist-details.

### 4) Chatwindow (`ChatWindow.tsx`)
- Message bubbles krijgen mobile-geoptimaliseerde max-breedte (bv. ~92%).
- Role-labels en content spacing geoptimaliseerd voor kleine schermen.
- Composer input en send-knop blijven naast elkaar bruikbaar op 320px.
- Placeholder en knoplabels blijven consistent in taalgebruik.

### 5) Search results carousel
- Cards en controls moeten zonder horizontale scroll werken op kleine schermen.
- Knoppen blijven klikbaar met duim (voldoende spacing).
- Metadataregels mogen wrappen op mobiel.

## Technisch ontwerp

### CSS-architectuur
- Introduceer layout tokens via CSS variabelen (spacing/radius/surface shadow).
- Mobile baseline in root classes.
- Tablet/desktop alleen met `min-width` uitbreidingen.
- Verwijder redundante mediaregels en losse uitzonderingen.

### Viewport + keyboard
- Gebruik `100dvh` i.p.v. enkel `100vh` voor betere keyboard-respons.
- Composer en message viewport testen op iOS Safari en Android Chrome.

### Accessibility
- Contrast conform WCAG AA.
- Focus styles zichtbaar voor keyboard-navigatie.
- Semantiek (`role`, `aria-live`) blijft behouden.

## Impact op code
Verwachte bestanden:
- `services/chat-ui/src/App.css` (hoofdaanpassing)
- `services/chat-ui/src/App.tsx` (state-specifieke layout consistentie)
- `services/chat-ui/src/components/Header.tsx`
- `services/chat-ui/src/components/Landing.tsx`
- `services/chat-ui/src/components/ChatWindow.tsx`
- `services/chat-ui/src/components/SearchResultsCarousel.tsx` (indien nodig voor mobile polish)

## Testplan (verplicht)

### A. Geautomatiseerd
1. `npm run lint`
2. `npm run build`
3. Component tests (toevoegen met Testing Library):
- Landing render op smalle viewport
- ChatWindow composer render met error/loading/complete states
- Invalid-location state render

### B. Responsive regressietests
Gebruik Playwright viewport matrix:
1. 320x568
2. 360x800
3. 390x844
4. 768x1024
5. 1366x768

Scenario’s per viewport:
1. Landing laden
2. Chat starten
3. Meerdere messages uitwisselen
4. Errorstate tonen
5. Invalid-location link openen

### C. Handmatige device tests
- iPhone Safari (portrait)
- Android Chrome (portrait)

Checklist:
- geen horizontale scroll
- composer blijft bruikbaar met open keyboard
- scroll-to-bottom knop overlapt geen cruciale controls
- touch targets comfortabel bedienbaar

## Acceptatiecriteria
1. Mobile viewport (320px breed) is volledig bruikbaar zonder layoutbreuk.
2. Chatflow (landing -> chat -> summary/feedback) is visueel consistent op mobiel.
3. Invalid-location en algemene foutstates passen bij dezelfde design language.
4. Desktoplayout blijft functioneel en visueel coherent na mobile-first refactor.
5. Alle tests uit testplan zijn groen.

## Implementatiefases
1. **Fase 1: CSS basis herstructureren**
- mobile defaults + breakpoints hertekenen
- app shell/header/composer layout stabiel maken

2. **Fase 2: State consistency**
- landing + error + invalid-location uniforme panel-ervaring

3. **Fase 3: Component polish**
- message bubbles, carousel, scroll button, touch targets

4. **Fase 4: QA en regressie**
- automated + responsive + device checks

## Risico’s en mitigatie
- Risico: regressie op desktop spacing.
- Mitigatie: desktop snapshots/viewport tests opnemen.

- Risico: keyboard overlap op bepaalde mobiele browsers.
- Mitigatie: device tests op iOS + Android, `dvh` + safe-area regels.

- Risico: CSS-complexiteit groeit door uitzonderingen.
- Mitigatie: mobile-first defaults en reduceren van ad-hoc media overrides.

## Open keuzes
1. Moet de mobile composer op zeer kleine schermen (<=340px) verticaal stacken?
2. Willen we de desktop card-look volledig behouden of dichter bij mobile full-bleed brengen?
3. Willen we visuele regressietests (snapshot diff) standaard in CI opnemen?
