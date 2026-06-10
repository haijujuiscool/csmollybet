# csmolly.bet - Project Documentation

Diese Dokumentation fasst den aktuellen Stand des Projekts zusammen, damit in einem neuen Chat nahtlos weitergearbeitet werden kann.

## 🛠 Technologie-Stack
- **Frontend:** React (gebaut mit Vite), React Router DOM, Axios, Socket.io-Client, canvas-confetti.
- **Backend:** Node.js (>=22), Express.js, Socket.io, SQLite3 (lokale Datei `database.sqlite`), Multer (Bild-Upload).
- **Authentifizierung:** JWT (JSON Web Tokens) + Steam OAuth.

## 📂 Dateistruktur (Wichtigste Dateien)
- `frontend/src/App.jsx`: Main Routing & Layout (Navbar, Chat-Sidebar).
- `frontend/src/contexts/AuthContext.jsx`: Verwaltet User-Session, Token und das optimistische Balance-Update (`setUser`).
- `frontend/src/utils/sounds.js`: Web Audio API Modul für alle Soundeffekte (Karten, Explosionen, Ticks).
- `frontend/src/components/Chat.jsx`: Chat-Sidebar mit Live Chat und **Live Game Feed** (Toggle zwischen beiden Views).
- `frontend/src/components/RouletteSpinner.jsx`: Roulette-Spinner-Animation für Case Openings (mit Mythic-Spin Support).
- `frontend/src/components/Navbar.jsx`: Navbar mit Brand "CSMOLLY", Games-Dropdown, Balance-Anzeige, User-Dropdown (Desktop + Mobile).
- `frontend/src/components/LiveGamesFeed.jsx`: Live Game Feed mit All/Top-Filter und Steam-Avatar-Anzeige.
- `frontend/src/index.css`: Globales Styling inkl. responsive Breakpoints (mobile/tablet ≤1280px, tablet 769–1280px, desktop ≥1281px).
- `backend/server.js`: Hauptserver, API-Endpunkte, SQLite-Queries, `broadcastGameResult()`-Funktion für den Game Feed.
- `backend/battleEngine.js`: Externe Logik für Case Battles (Lobby, Timer, Bot-Logik, Game Feed Broadcast).
- `backend/chatEngine.js`: Socket.io Chat + Game Feed History Emission bei Verbindung.
- `backend/admin.js`: CLI-Tool für Admin-Aufgaben (z.B. Gems vergeben: `node admin.js add-gems Username 1000`).

## 🎮 Implementierte Spielmodi
1. **Cases (Solo & Creator):** Eigene Cases können erstellt werden. Items haben Bilder und Wahrscheinlichkeiten. "Mythic Spin" Modus (hebt Items >150% Profit hervor). Erstellungs-Option für Case Battles wurde in den `/battles` Bereich verschoben.
2. **Case Battles:** Multiplayer via WebSockets. Modi: 1v1, 1v1v1, 2v2, 3v3, FFA. "Crazy Mode" (wenigster Loot gewinnt). Voller Bot-Support. Case-Battle-Erstellung ist exklusiv hier eingebettet.
3. **Upgrader:** SVG-Ring-Spinner. Win-Chance wird berechnet (`(Bet * 0.99) / Ziel-Preis`). 99% RTP ist fest einprogrammiert.
4. **Crash:** Raketen-Animation mit Cashout-Funktion. 
   - **Historie:** Anzeige der letzten 9 Multiplikatoren direkt über dem Spielfeld (neuester Wert ganz rechts). Werte unter 2.00x sind rot, Werte ab 2.00x sind grün.
   - **Ping-Anzeige:** Echtzeit-Latenz-Anzeige basierend auf Round-Trip-Messung zum Backend.
   - **Sound-Updates:** Klassische Raketen-Beeps wurden durch Bombensounds (`bomb_planted.mp3` & `bomb_exploding.m4a`) ersetzt.
5. **Double (Roulette):** Rot/Schwarz/Grün-System. History der letzten 100 Spins inkl. Statistik-Anzeige.
6. **Mines:** Server-seitige Mine-Generierung (damit nicht cheatbar). Basiert auf einem 5x5 Raster.
7. **Plinko (Deaktiviert):** Derzeit im Navigations-Menü deaktiviert.
8. **Keep Digging (Deaktiviert):** Derzeit im Navigations-Menü deaktiviert.
9. **Chicken Road (Deaktiviert):** Derzeit im Navigations-Menü deaktiviert.
10. **Blackjack (Deaktiviert):** Derzeit im Navigations-Menü deaktiviert.
11. **Slots (Deaktiviert):** Derzeit im Navigations-Menü deaktiviert.
12. **Kalshi Bets (Deaktiviert):** Vorhersagemärkte basierend auf der Kalshi-API. (Aktuell deaktiviert, um Leistung zu sparen und den Netzwerk-Workload zu minimieren).

## 💬 Chat-System & Live Game Feed

### Chat
- Jedes Zeichen kostet 1 Gem. Fireworks kosten 1000 Gems und lösen eine `canvas-confetti` Animation aus.
- History wird über `chatEngine.js` verwaltet (letzte 50 Nachrichten).
- UI bietet kleine Pfeil-Buttons (Collapse-Arrows) am Rand, um den Chat oder den Live-Feed komplett ein-/auszuklappen bzw. zu verstecken.

### Live Game Feed
- **Toggle:** Chat-Sidebar hat zwei Tabs: `💬 Chat` und `📊 Live Feed`.
- **Datenquelle:** `global.broadcastGameResult(username, gameName, betAmount, payoutAmount, multiplier)` in `server.js`.
  - Berechnet `profit = payoutAmount - betAmount`.
  - Fragt asynchron `avatar` aus der `users`-Tabelle per `db.get('SELECT avatar FROM users WHERE username = ?', [username])` ab (keine Änderung an Aufrufern nötig).
  - Sendet via `io.emit('game_feed_update', update)`.
- **Unterstützte Spiele:** Cases, CaseBattle, Double, Crash, Mines, ChickenRoad, Upgrader, Blackjack, LiveBlackjack, Plinko, KeepDigging, Slots.
- **5-Sekunden-Verzögerung:** Neue Ergebnisse im Feed werden mit einem `setTimeout(5000)` verzögert angezeigt, damit man Ergebnisse nicht als Spoiler sieht.
- **Feed-Karten:** Zeigen Username (mit Steam-Avatar-Bild 24×24), Spielname, Einsatz, Multiplikator und Profit/Verlust.
  - **Grün** (`#22c55e`): Profit > 0 (Gewinn).
  - **Rot** (`#ef4444`): Profit ≤ 0 (Verlust oder Break-even).
- **Filter:** "All" (alle) und "Top" (Profit/Bet > 5x, geändert von 10x).
- **History:** Beim Verbinden werden die letzten 50 Ergebnisse aus `global.gameFeedHistory` gesendet.

## 🎨 Design, Background & Menü-Interaktionen
- **Hintergrundbild (`background1`):** Das vordefinierte Hintergrundbild (`background1`) wird responsive so gecroppt, dass linker und rechter Rand perfekt passen und kein monotoner Hintergrund angezeigt wird.
- **Spiele-Dropdown:** Klicks außerhalb des Spiele-Dropdowns schließen dieses automatisch.
- **Emojis durch Icons ersetzt:** Im Spiele-Dropdown und auf der Startseite wurden die Emojis durch professionelle Icons ersetzt. Die Spiele Plinko, Keep Digging, Chicken Road, Blackjack und Slots sind im Menü ausgeblendet.

## 📱 Responsive Layout (≤1280px Breakpoint)

- **Breakpoint:** Alle mobilen/tablet-spezifischen Regeln greifen bei ≤1280px (geändert von 768px, um iPad 9 (1080px landscape) abzudecken).
- **Navbar (mobil):** 3-Spalten-Grid: links `[Hamburger · CSMOLLY · Games]`, mitte `[Gems-Balance]`, rechts `[User-Dropdown]`.
  - `navbar-center` ist auf Desktop sichtbar, auf Mobile zentriert.
  - `navbar-mobile-right` ersetzt `navbar-right` auf Mobile (Dropdown statt Buttons).
  - Brand "CSMOLLY" wird nicht mehr absolut zentriert (kein `position: absolute; left: 50%; transform: translateX(-50%)`).
- **Chat (mobil ≤1280px):** Fullscreen-Overlay (`position: fixed; inset: 0`), öffnet per Floating-Button (unten-rechts).
  - **Tablet (769–1280px):** Chat öffnet als 320px rechte Seitenleiste (nicht Fullscreen).
- **Body-Scroll-Sperre:** Bei geöffnetem Chat auf Mobile wird `document.body.style.position = 'fixed'` gesetzt (mit Speichern/Wiederherstellen von `scrollY`).
- **Chat-Nachrichten & Feed:** `overscroll-behavior: contain` auf scrollbaren Containern.

## 🐛 Kürzlich behobene Bugs & Besonderheiten (WICHTIG für künftige Prompts)
- **Race Conditions / Moneyhacks:** 
  - Buttons für das Erstellen von Battles (`Cases.jsx`) und das Rufen von Bots (`Battle.jsx`) haben strikte Cooldowns (500ms) und `isCreating`-Locks, um Doppel-Requests durch Button-Spamming zu verhindern.
- **Optimistische Balance-Updates ("Spoiler-Schutz"):** 
  - Bei Spielen wie Plinko, Upgrader, Blackjack oder Cases wird im Backend das Ergebnis *sofort* in der Datenbank verbucht. 
  - Würde das Frontend nach dem Einsatz sofort einen DB-Fetch machen, wüsste der Spieler durch seinen Kontostand sofort, ob er gewonnen hat, noch bevor die Animation beendet ist.
  - **Lösung:** Wir nutzen `setUser(prev => ({ ...prev, gems: prev.gems - betAmount }))` aus dem `AuthContext`, um optisch **nur den Einsatz abzuziehen**. Der echte Kontostand (inklusive etwaigem Gewinn) wird erst nach der Animation über `refreshBalance()` neu vom Server geladen.
- **Plinko-Pfad:** Das Backend gibt den Pfad zwingend als Array mit `'R'` und `'L'` aus, nicht als `1` und `-1`.
- **Bot-Limitierung:** Bots in Battles werden über `battle.players.length < battle.maxPlayers` geschützt.
- **Live Feed: Cases-Verluste wurden grün angezeigt (behoben):**
  - **Problem:** Im Live Game Feed wurden auch Verluste bei Cases als Gewinne (grün) dargestellt.
  - **Ursache:** `const isWin = item.profit >= 0` in `Chat.jsx` — der `>=` Operator behandelte `profit === 0` und den Edge-Case `profit === -0` (entsteht durch `parseFloat(toFixed(2))` bei winzigen negativen Beträgen) als Win.
  - **Fix:** Geändert zu `item.profit > 0`. Jetzt ist nur positiver Profit grün; 0 und negativ sind rot.
- **CaseBattle `payoutPerWinner` ReferenceError (behoben):**
  - In `battleEngine.js` war `payoutPerWinner` im Game-Feed-Block nicht definiert (Variable war in einem anderen Scope). Umbenannt zu `payoutPerWinnerFeed` im Broadcast-Block.
- **Mobile Body-Scroll bei geöffnetem Chat (behoben):**
  - **Problem:** Auf iOS konnte man trotz `overflow: hidden` auf `body` die Seite hinter dem Chat-Fullscreen scrollen.
  - **Fix:** `document.body.style.position = 'fixed'` + Speichern von `window.scrollY`. Beim Schließen wird `position` zurückgesetzt und `window.scrollTo(0, savedScrollY)` aufgerufen.
- **Live Feed Avatar:** `broadcastGameResult()` fragt jetzt `avatar` aus der DB ab. Feed-Karten zeigen bei vorhandenem Avatar ein 24×24-Steam-Profilbild.
  - Avatar-Fallback ist leerer String → kein Bild wird angezeigt.
- **Top-Filter 5x:** Schwelle von `(profit / bet) > 10` auf `> 5` geändert.
- **Registrierung entfernt:** Homepage-Button, `/register`-Route und Import in `App.jsx` entfernt.
- **Login auf Startseite:** Geht direkt zu `/api/auth/steam` (keine Login-Seite).
- **Node.js Upgrade:** Von 20.11.1 auf 22.14.0 (nötig für Vite 8).

## 🔧 Architektur-Details

### broadcastGameResult() Signatur
```js
global.broadcastGameResult = (username, gameName, betAmount, payoutAmount, multiplier) => {
    const profit = payoutAmount - betAmount;
    db.get('SELECT avatar FROM users WHERE username = ?', [username], (err, row) => {
        const update = { username, avatar: row?.avatar || '', game: gameName, bet: parseFloat(betAmount.toFixed(2)), multiplier: parseFloat(multiplier.toFixed(2)), profit: parseFloat(profit.toFixed(2)), timestamp };
        global.gameFeedHistory.push(update);
        io.emit('game_feed_update', update);
    });
};
```
- **Asynchron:** Avatar wird per DB-Query abgerufen — Aufrufer müssen nichts ändern.
- **avatar:** Leerer String, falls kein Benutzer gefunden oder kein Avatar gesetzt.

### Socket Events (Game Feed)
| Event | Richtung | Beschreibung |
|-------|----------|-------------|
| `game_feed_history` | Server → Client | Array der letzten 50 Ergebnisse bei Verbindung |
| `game_feed_update` | Server → Client | Einzelnes neues Ergebnis (wird mit 5s Delay im Frontend angezeigt) |

## 🚫 Deaktivierte Features (Kalshi Bets)

Um die Ladezeiten der Website zu optimieren, den Server-Workload zu verringern und Fehlermeldungen bei API-Rate-Limits (429-Fehler) zu vermeiden, wurde das Kalshi-Feature vollständig deaktiviert. Der Code wurde jedoch nicht gelöscht, sodass er bei Bedarf schnell wieder aktiviert werden kann.

### Getroffene Maßnahmen:
1. **Hintergrund-Synchronisation deaktiviert:**
   - In [backend/server.js](file:///c:/Users/juliu/Downloads/clash2/backend/server.js#L1982-L1993) wurden der Startup-Sync sowie alle periodischen `setInterval`-Intervalle für den Kalshi-Sync (`syncKalshiMarkets`) und das Settlement (`settleKalshiBets`) auskommentiert.
2. **Frontend-Zugang verborgen:**
   - Der Navigationslink zu den Kalshi Bets in [frontend/src/components/Sidebar.jsx](file:///c:/Users/juliu/Downloads/clash2/frontend/src/components/Sidebar.jsx#L20-L24) wurde auskommentiert.
   - Der Import und die Route für `/kalshi` in [frontend/src/App.jsx](file:///c:/Users/juliu/Downloads/clash2/frontend/src/App.jsx#L19-L22) wurden ebenfalls auskommentiert.

### Reaktivierung:
Um das Feature wieder in Betrieb zu nehmen, müssen lediglich die oben beschriebenen auskommentierten Blöcke in `server.js`, `Sidebar.jsx` und `App.jsx` wieder einkommentiert werden.

## 📦 Withdraw Inventory (Bot Inventory)

- **644 real CS2 skins** across 3 price bands (cheap $0.01–$0.50, mid $0.55–$45.49, high $50–$9,993)
- Every item is a **real weapon+skin combo** from the official CSGO-API (`bymykel.github.io/CSGO-API`)
- Each item has its **own unique skin image** (not generic weapon placeholder)
- Prices are generated based on weapon class + rarity with multipliers (knives/gloves higher, rifles medium, pistols lower)
- `float_value` column displays the weapon wear float in the withdraw UI

### Seed Scripts
- `backend/seed_items.js` — 300 mid-range items (original)
- `backend/seed_cheap.js` — 102 cheap items
- `backend/seed_high.js` (inline) — 242 high-value items
- All scripts use the CSGO-API for REAL skin names and images — no fake combos
- Database auto-overwrite prevention: `database.js` only seeds when `bot_inventory` is empty

### Steam Bot (Simulated Mode)
- `backend/.env` — Steam credentials are commented out
- Backend starts in **simulated mode** — no real Steam trade offers
- Deposits/withdrawals work via mock trade offers in the database
- To enable real trades, uncomment the Steam credentials in `.env` and handle Steam Guard

### Critical Fixes
- **Nested transaction crash** (`tradebotService.js:122`): Payout loop had `BEGIN TRANSACTION` inside `db.all` callback — moved to single `db.serialize()` wrapper
- **Fake skin combos**: Seed scripts originally generated random names that didn't exist in CS2 → replaced all 644 items with real CSGO-API data

## 🚀 Starten der Umgebung
Um die Entwicklungsumgebung zu starten, müssen zwei Terminals geöffnet werden:
1. **Backend:** `cd backend` -> `node server.js`
2. **Frontend:** `cd frontend` -> `npm run dev`

### Produktions-Build
```bash
cd frontend && npm run build
```
Das Backend servt statische Dateien aus `frontend/dist/`.

*(Alle Konsolen-Outputs und Fehler logs erscheinen im Backend-Terminal, Socket-Events sind in der Netzwerkanalyse des Browsers sichtbar.)*
