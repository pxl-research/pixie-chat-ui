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
