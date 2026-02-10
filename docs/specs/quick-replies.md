# Spec: Quick Replies voor beperkte antwoordopties in chat

## Status
- Datum: 2026-02-10
- Branch: `feature/chat-ui-quick-replies-spec`
- Auteur: Codex (voorstel)

## Probleem
In de huidige chatflow moet een gebruiker altijd typen, ook wanneer een vervolgvraag een beperkt aantal geldige antwoorden heeft (bijvoorbeeld `Ja`/`Nee`).

Dat veroorzaakt:
- extra frictie op mobiel en desktop;
- variatie in input (`ja`, `J`, `yes`, typfouten) die backend-normalisatie moeilijker maakt;
- tragere afronding van feedback- of besluitfases.

## Doel
Voeg klikbare "quick replies" toe boven het invoerveld, zodat gebruikers bij beperkte opties direct kunnen klikken in plaats van typen.

## Niet-doelen
- Geen volledige redesign van het chatvenster.
- Geen vervanging van vrij tekstinvoer; typen blijft altijd mogelijk.
- Geen automatische inferentie in de UI op basis van vraagtekst alleen (de backend levert opties expliciet aan).

## Gewenste gebruikerservaring
1. Assistent stelt een vraag met beperkte antwoordopties.
2. Boven het invoerveld verschijnen knopjes (chips), bv. `Ja`, `Nee`.
3. Bij klik op een optie:
- de gekozen waarde wordt direct als gebruikersbericht verzonden;
- de chips verdwijnen voor die beurt;
- de volgende assistant-response wordt normaal getoond.
4. De gebruiker kan desgewenst nog altijd zelf typen.

## Functionele vereisten
- `text` van de assistant wordt altijd getoond (zoals vandaag).
- Als quick replies beschikbaar zijn en gesprek niet afgerond is, toon ze boven de composer.
- Quick replies worden alleen getoond voor de meest recente assistant-turn.
- Maximaal 6 opties tonen; extra opties negeren.
- Lege/whitespace opties worden genegeerd.
- Dubbele opties (case-insensitive) worden gededupliceerd, eerste blijft.
- Tijdens `loading` zijn quick reply-knoppen disabled.
- Bij `isComplete === true` worden quick replies niet getoond.
- Foutmeldingen laten quick replies verdwijnen tot volgende geldige assistant-response.

## API-contract (voorkeur)
### Genormaliseerd responsecontract uit chat-proxy
```json
{
  "type": "answer",
  "text": "Wil je dat ik doorga?",
  "quick_replies": [
    { "label": "Ja", "value": "Ja" },
    { "label": "Nee", "value": "Nee" }
  ],
  "conversation_id": "...",
  "state": { "feedback_requested": "true" }
}
```

### Ondersteunde vormen voor robuustheid
De proxy normaliseert onderstaande backend-vormen naar `quick_replies`:
- lijst strings: `["Ja", "Nee"]`
- lijst objecten: `[{"label":"Ja","value":"Ja"}]`
- alternatieve keys in upstream payload/state:
- `quick_replies`
- `quickReplies`
- `choices`
- `options`
- `suggested_answers`

### Validatie in proxy
- Alleen strings voor `label`/`value`.
- Trim op `label`/`value`.
- Max 6 items.
- Dedupe op `value` (fallback `label`), case-insensitive.

## Frontend ontwerp
## Datatypes
- `ChatApiResponse` uitbreiden met:
- `quick_replies?: Array<string | { label: string; value?: string }> | null`
- parser output uitbreiden met:
- `quickReplies: Array<{ label: string; value: string }>`

## State-management
In `useChat`:
- houd `activeQuickReplies` bij als aparte state voor de composer;
- update deze state bij elke assistant-response;
- reset naar leeg bij:
- user-send (typ of klik)
- error
- reset
- complete gesprek

## Rendering
In `ChatWindow`:
- nieuwe prop `quickReplies` en handler `onQuickReplySelect(value: string)`.
- render `<div className="quick-replies">` direct boven `<form className="composer">`.
- elke optie als `<button type="button">`.

## Interactie
- Klik op quick reply roept `onQuickReplySelect(value)` op.
- `onQuickReplySelect` gebruikt dezelfde send-flow als handmatig typen.
- Keyboard toegankelijkheid:
- tab-focus op elke knop
- enter/space activeert knop (native button gedrag)

## Accessibility en UX
- Voldoende contrast volgens WCAG AA.
- Focus-ring zichtbaar op quick reply knoppen.
- `aria-label` op container: `Snelle antwoordopties`.
- Layout responsive:
- desktop: inline wrap
- mobiel: wrap met voldoende tap target (min 40px hoogte)

## Telemetrie (optioneel maar aanbevolen)
Voeg event hooks toe (indien analytics aanwezig):
- `quick_reply_shown` (aantal opties)
- `quick_reply_clicked` (label/value, positie)
- `quick_reply_fallback_typed` (wanneer opties getoond waren maar user typt)

## Teststrategie (verplicht voor implementatie)
Omdat dit impactvol is, implementatie enkel mergen als onderstaande tests groen zijn.

## 1. Unit tests frontend parser (`vitest`)
Cases:
- parse van string-array en object-array
- trim/lege opties/dedupe/max 6
- geen quick replies bij complete state
- coexistence met `summary` + `follow_up_question`

## 2. Component tests (`@testing-library/react`)
`ChatWindow`:
- quick replies renderen boven composer
- click triggert handler met juiste value
- disabled tijdens loading
- hidden bij `isComplete`

## 3. Hook tests (`useChat`)
- assistant-response zet `activeQuickReplies`
- klik verstuurt meteen user message en leegt quick replies
- manual typing werkt ongewijzigd

## 4. Proxy tests (`pytest`)
Voor `_normalize_chat_response`:
- quick replies worden uit verschillende inputvormen correct genormaliseerd
- validatie (lege waarden, max, dedupe)
- combinatie met summary/follow_up_question blijft behouden

## 5. E2E smoke test (Playwright of equivalent)
- scenario met `Ja/Nee` vraag
- quick replies zichtbaar
- klik op `Ja` verzendt bericht
- volgende turn toont verwachte assistant-response

## Acceptatiecriteria
- Gebruiker kan met 1 klik antwoorden op beperkte-vraag scenario's.
- Vrije tekstinvoer blijft werken.
- Geen regressie in bestaande flow voor summary/follow_up_question.
- Geen regressie in compose/scroll/loading gedrag.
- Alle verplichte tests groen in CI.

## Rollout plan
1. Implementatie achter feature flag:
- `CHAT_UI_QUICK_REPLIES_ENABLED` (default `false` in eerste release).
2. Test in staging met informer/questioner scenario's.
3. Na validatie flag naar `true` voor geselecteerde klant(en).
4. Daarna default `true` maken en flag optioneel verwijderen in latere cleanup.

## Risico's en mitigatie
- Risico: backend stuurt inconsistente optieformaten.
- Mitigatie: strikte proxy-normalisatie.

- Risico: visuele clutter bij veel opties.
- Mitigatie: max 6 + wrap layout.

- Risico: dubbel verzenden door snelle multi-click.
- Mitigatie: disable knoppen zodra request start.

## Open vragen
- Moet klik direct verzenden (huidig voorstel) of eerst input prefillen?
- Moeten label en value apart ondersteund worden voor analytics/business logic?
- Willen we quick replies ook tonen bij eerste welkomstvraag, of enkel in feedback/follow-up fase?
