# Dagritme

Persoonlijke dashboard-app: agenda, gym-tracker, taken, werk-locatieherinnering en game-nieuws.

## 1. Lokaal uitproberen (optioneel, maar aan te raden vóór je pusht)

Je hebt [Node.js](https://nodejs.org) nodig (18 of hoger).

```bash
npm install
npm run dev
```

Open de URL die in je terminal verschijnt (meestal `http://localhost:5173`).

## 2. Op GitHub zetten

1. Maak een gratis account op [github.com](https://github.com) als je die nog niet hebt.
2. Klik rechtsboven op **+** → **New repository**. Geef 'm een naam, bijv. `dagritme`. Laat 'm gerust **Public** of **Private**, dat maakt voor de volgende stappen niet uit.
3. Volg daarna op de nieuwe, lege repo-pagina de instructies onder **"…or push an existing repository from the command line"**. Dat komt neer op, vanuit deze projectmap in je terminal:

```bash
git init
git add .
git commit -m "Eerste versie van Dagritme"
git branch -M main
git remote add origin https://github.com/JOUW-GEBRUIKERSNAAM/dagritme.git
git push -u origin main
```

(Geen `git` op je computer? Installeer het via [git-scm.com](https://git-scm.com), of upload de bestanden via de "Add file → Upload files"-knop op de GitHub-repopagina — dan heb je geen terminal nodig.)

## 3. Gratis live zetten (met een echte URL)

Zodra de code op GitHub staat, is de makkelijkste weg naar een werkende website:

1. Ga naar [vercel.com](https://vercel.com) en log in met je GitHub-account.
2. Klik **Add New → Project**, kies je `dagritme`-repo.
3. Laat de standaardinstellingen staan (Vercel herkent Vite automatisch) en klik **Deploy**.
4. Na een paar tientallen seconden krijg je een echte URL, bijv. `dagritme.vercel.app`.

Elke keer dat je daarna naar `main` pusht, wordt de site automatisch bijgewerkt.

*(Netlify of GitHub Pages werken ook, maar Vercel heeft voor een Vite-project geen extra configuratie nodig.)*

## 4. Google Agenda-koppeling laten werken

De Google-koppeling in de Agenda-tab heeft een eigen, gratis Google Client ID nodig, gekoppeld aan **exact** de URL waar de app draait:

- Voor lokaal testen: `http://localhost:5173`
- Voor de live site: de URL die Vercel je geeft, bijv. `https://dagritme.vercel.app`

Stap-voor-stap uitleg om die Client ID aan te maken staat gewoon in de app zelf, onder Agenda → "Google Agenda koppelen".

## Wat wel en niet werkt

- **Opslag**: gebruikt de browser (`localStorage`), dus blijft bewaard op het toestel/de browser waarin je de app opent — niet automatisch gesynchroniseerd tussen meerdere apparaten.
- **Werk-locatieherinnering**: werkt alleen zolang deze pagina open staat in je browser (geen achtergrondservice zoals een native app).
- **Systeemmeldingen**: vereisen dat je toestemming geeft in de browser; werken het betrouwbaarst met de pagina open of net op de achtergrond.
