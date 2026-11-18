# Koffein am Limit

Profilseminar-App (Paul und Malte): Koffein-Dosis und Wiederholungen beim Bankdrücken. Eine einzige `index.html`, installierbar als PWA (iPhone, iPad).

## Aufbau
- `src/` Quellcode (`app.js`, `style.css`, `body.html`, `githubdb.js`), `python3 build.py` erzeugt `index.html`.
- `manifest.webmanifest`, `sw.js`, `icons/` machen daraus eine installierbare App mit Offline-Hülle.
- Drei Looks (Hantelscheibe, Ring, Klassik), umschaltbar unter Start › Darstellung.

## Veröffentlichen (GitHub Pages)
Settings › Pages › Source: `main` / `/ (root)`. Adresse: `https://pauldubrownik-code.github.io/koffein-am-limit/`.
Auf dem iPhone/iPad in Safari öffnen › Teilen › „Zum Home-Bildschirm“. Pulsgurt-Verbindung braucht den Browser Bluefy.

## Daten
Keine Messdaten in diesem öffentlichen Repo. Die App speichert in einem **privaten** Repo (`data/<sammlung>/<id>.json`).
Start › „Verbindung zum Datenspeicher“: Repo `besitzer/koffein-daten` und einen Fine-grained Token (nur dieses Repo, Contents: Read and write) eintragen. Der Token bleibt im Browser des Geräts.
