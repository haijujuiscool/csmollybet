# csmolly.bet - Project Documentation

Diese Dokumentation fasst den aktuellen Stand des Projekts zusammen, damit in einem neuen Chat nahtlos weitergearbeitet werden kann.

## 🛠 Technologie-Stack
- **Frontend:** React (gebaut mit Vite), React Router DOM, Axios, Socket.io-Client, canvas-confetti.
- **Backend:** Node.js (>=22), Express.js, Socket.io, SQLite3 (lokale Datei `database.sqlite`), Multer (Bild-Upload).
- **Authentifizierung:** JWT (JSON Web Tokens) + Steam OAuth.

## 📂 Dateistruktur (Wichtigste Dateien)
- `frontend/src/App.jsx`: Main Routing & Layout (Navbar, Chat-Sidebar, Feed-Sidebar, Expand-Handles).
- `frontend/src/contexts/AuthContext.jsx`: Verwaltet User-Session, Token und das optimistische Balance-Update (`setUser`).
- `frontend/src/utils/sounds.js`: Web Audio API Modul für alle Soundeffekte (Karten, Explosionen, Ticks).
- `frontend/src/components/Chat.jsx`: Chat-Sidebar mit Live Chat und **Live Game Feed** (Toggle zwischen beiden Views).
- `frontend/src/components/LiveGamesFeed.jsx`: Live Game Feed mit All/Top-Filter und Steam-Avatar-Anzeige, klickbare Items navigieren zur Spiel-Route.
- `frontend/src/components/RouletteSpinner.jsx`: Roulette-Spinner-Animation für Case Openings (mit Mythic-Spin Support).
- `frontend/src/components/Navbar.jsx`: Navbar mit Brand "CSMOLLY", Games-Dropdown (incl. World Cup with Trophy icon), Balance-Anzeige, Daily/Deposit/Profile-Buttons, User-Dropdown (Desktop + Mobile).
- `backend/server.js`: Hauptserver, API-Endpunkte, SQLite-Queries, `broadcastGameResult()`-Funktion für den Game Feed.
- `backend/battleEngine.js`: Externe Logik für Case Battles (Lobby, Timer, Bot-Logik, Game Feed Broadcast).
- `backend/chatEngine.js`: Socket.io Chat + Game Feed History Emission bei Verbindung.
- `backend/admin.js`: CLI-Tool für Admin-Aufgaben (z.B. Gems vergeben: `node admin.js add-gems Username 1000`).
- `backend/lotteryEngine.js`: Single global lottery with socket events (get_lottery, join_lottery, lottery_tick/100ms, lottery_rolling spinner, lottery_finished). Weighted roll by item value.
- `backend/worldCupService.js`: World Cup 2026 match data, real odds (The Odds API), real-time scores (wcup2026.org API), auto-refresh every 1 minute.
- `backend/worldcup_matches.json`: Cached match data with scores, odds, and status.
- `frontend/src/index.css`: Globales Styling inkl. responsive Breakpoints (mobile/tablet ≤1280px, tablet 769–1280px, desktop ≥1281px).
- `frontend/src/pages/FreeDailyCase.jsx`: Täglicher Free Case mit Steam-Anforderungsprüfung, Welcome Cases, Transfer-Image-Overlay.
- `frontend/src/pages/WorldCup.jsx`: World Cup betting page with match cards, odds buttons, bet slip, live scores, desktop background, mobile-responsive stacking.
- `frontend/src/pages/Terms.jsx`: Terms of Service und Privacy Policy mit Tab-Toggle.

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
13. **Lottery:** Single global lottery (not user-created). Players join by depositing items from `user_inventories`. When ≥2 players joined, a 30s timer starts (ticks every 100ms for smooth countdown). Weighted roll by item value — higher value = higher odds. Winner takes all items. Spinning animation with profile picture carousel (rapid cycling, decelerates, snaps to winner).
14. **World Cup 2026 Betting:** Real-time sports betting on FIFA World Cup 2026 matches. Features:
    - **Real match data** from `thestatsapi.com` (initial fixtures) + real-time scores from `wcup2026.org/api/data.php`.
    - **Real odds** from The Odds API (free tier, 500 req/month) with fallback to strength-based synthetic odds.
    - **Match lifecycle:** `upcoming` → `closed` (kicked off, no more bets) → `completed` (finished, bets resolved).
    - **Auto-refresh** every 1 minute: fetches latest odds + scores, auto-resolves finished matches, settles winning bets.
    - **Bet types:** Home win, Draw, Away win — standard 1X2 market with decimal odds.
    - **Admin controls:** Manual simulate result, force refresh odds.
    - **Desktop background:** Static fixed admin-uploaded image (`/transfers/A8D32192-...png`), hidden on mobile.
    - **Mobile responsive:** Match cards stack vertically, odds buttons go single-column on small screens.
    - **Lucide React Trophy icon** in Navbar dropdown, Sidebar, and Home page game grid.

## 💬 Chat-System & Live Game Feed

### Chat
- Jedes Zeichen kostet 1 Gem. Fireworks kosten 1000 Gems und lösen eine `canvas-confetti` Animation aus.
- History wird über `chatEngine.js` verwaltet (letzte 30 Nachrichten).
- Chat-Messages-Bereich hat `overflow: hidden` (kein internes Scrollen) auf Desktop.
- UI bietet kleine Pfeil-Buttons (Collapse-Arrows) am Rand, um den Chat oder den Live-Feed komplett ein-/auszuklappen bzw. zu verstecken (nur auf Mobile sichtbar).

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
- **Filter:** "All" (alle) und "Top" (Profit/Bet > 5x).
- **History:** Beim Verbinden werden die letzten 20 Ergebnisse aus `global.gameFeedHistory` gesendet (maximal 20 im Feed sichtbar).
- **Klick-Navigation:** Feed-Items sind klickbar (`cursor: pointer`) und navigieren zur entsprechenden Spielseite (Double→/double, Crash→/crash, etc.).

## 🎨 Design, Background & Menü-Interaktionen
- **Hintergrundbild (`background1`):** Das vordefinierte Hintergrundbild (`background1`) wird responsive so gecroppt, dass linker und rechter Rand perfekt passen und kein monotoner Hintergrund angezeigt wird.
- **Navbar (Desktop ≥1281px):** `position: fixed; top: 0; left: 0; right: 0; height: 64px` — spannt vollständig von links nach rechts. Chat und Feed sind mit `top: 64px` darunter positioniert.
- **Navbar-Buttons:** Alle drei Action-Buttons (Daily, Deposit, Profile) haben einheitliche `height: 40px; boxSizing: border-box`. Der Daily-Button (`<Link>`) hat `borderRadius: '4px'` für konsistente Optik. Der Profile-Button-Wrapper hat `display: flex; alignItems: center`.
- **Spiele-Dropdown:** Klicks außerhalb des Spiele-Dropdowns schließen dieses automatisch.
- **Emojis durch Icons ersetzt:** Im Spiele-Dropdown und auf der Startseite wurden die Emojis durch professionelle Icons ersetzt. Die Spiele Plinko, Keep Digging, Chicken Road, Blackjack und Slots sind im Menü ausgeblendet.

## 📱 Responsive Layout (≤1280px Breakpoint)

- **Breakpoint:** Alle mobilen/tablet-spezifischen Regeln greifen bei ≤1280px (geändert von 768px, um iPad 9 (1080px landscape) abzudecken).
- **Navbar (mobil):** 3-Spalten-Grid: links `[Hamburger · CSMOLLY · Games]`, mitte `[Gems-Balance]`, rechts `[User-Dropdown]`.
  - `navbar-center` ist auf Desktop sichtbar, auf Mobile ausgeblendet.
  - `navbar-mobile-right` ersetzt `navbar-right` auf Mobile (Dropdown statt Buttons).
  - Brand "CSMOLLY" wird nicht mehr absolut zentriert (kein `position: absolute; left: 50%; transform: translateX(-50%)`).
- **Chat (mobil ≤1280px):** Fullscreen-Overlay (`position: fixed; inset: 0`), öffnet per Floating-Button (unten-rechts).
  - **Tablet (769–1280px):** Chat öffnet als 320px rechte Seitenleiste (nicht Fullscreen).
- **Body-Scroll-Sperre:** Bei geöffnetem Chat auf Mobile wird `document.body.style.position = 'fixed'` gesetzt (mit Speichern/Wiederherstellen von `scrollY`).
- **Chat-Nachrichten & Feed:** `overscroll-behavior: contain` auf scrollbaren Containern.
- **Expand-Handles:** Auf Desktop (≥1281px) sind die Collapse-Pfeil-Buttons (`.expand-handle`) ausgeblendet (`display: none`).

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
- **Chat/Feed Limits reduziert:** Chat-History von 50 auf 30 Nachrichten reduziert. Feed-History von 50 auf 20 Einträge reduziert. Beide Bereiche auf Desktop auf `overflow: hidden` gesetzt (kein Scrollen der Nachrichten-Container).
- **Navbar Desktop-Layout:** Navbar verwendet jetzt `position: fixed` auf Desktop (≥1281px) und spannt über die volle Breite. Chat-Sidebar und Feed-Sidebar sind mit `top: 64px` darunter positioniert. Expand-Handles sind auf Desktop ausgeblendet. `body { overflow-x: hidden }` verhindert horizontale Scrollbalken.
- **Pending Payouts entfernt:** Items gehen direkt in `user_inventories` statt 50% sofort/50% delayed gems. `deposits`-Tabelle und `startPayoutReleaseLoop` wurden entfernt. Deposit bestätigt mit 100% Item-Gutschrift.
- **Neue Inventory-Seite:** `/inventory` zeigt gelagerte Items mit Sell (→Gems) und Withdraw per Hover. Navbar-Dropdown wurde um Inventory-Link erweitert.
- **DepositWithdrawModal:** Payouts-Tab entfernt, zeigt "Goes to Inventory" statt Gem-Aufschlüsselung.
- **Deposit-Loop-Fix:** Steam API lieferte `Rarity`-Tags ohne `name`-Property → `rarityTag.name.replace()` crashte bei Inventory-Fetch. Null-Check hinzugefügt.
- **Shell stuck root cause:** `steamBot.js` `process.stdin.once('data', ...)` in `steamGuard` handler blocks parent PowerShell when stdin is inherited. **Fix**: Read Steam Guard code from `sg.txt` file (or `STEAM_GUARD_CODE` env var) first — no stdin redirection needed.
- **JWT_SECRET persisted:** Added to `.env` so restarts don't invalidate tokens.
- **Lottery → single global instance:** Changed from user-created lotteries to one always-running lottery. Join with items, ≥2 players triggers 30s timer, weighted roll, winner takes all.
- **Lottery spinner animation:** Server emits `lottery_rolling` with shuffled profile pics + winner index. Frontend cycles avatars rapidly (50ms interval) for 2.5s → decelerates → snaps to winner with gold border.
- **Lottery items display:** Each player entry shows deposited items with name, float value, image, gem value — on both /lotteries page and home page banner.
- **Home page lottery banner:** Live lottery widget between hero and game grid. Shows current pot, player avatars with items, timer, winner announcement.
- **Lottery timer:** Ticks every 100ms for smooth countdown display (was 1000ms).
- **Admin withdrawal review:** `POST /api/inventory/withdraw` creates `withdrawals` table record. Admin approves (keeps `withdrawing`) or declines (returns to `available`). Old bot-inventory withdrawals still refund gems on decline.
- **Navbar/Sidebar lottery links:** `Dices` icon in Games dropdown, Sidebar, and /lotteries route in App.jsx.
- **Sounds tab-visibility mute:** `visibilitychange` listener + `play()` guard in `sounds.js` — all sounds silently dropped when tab hidden.
- **Case card button alignment:** Card container `display: flex; flexDirection: column; alignItems: center` + button `marginTop: auto`.
- **Cases/items translated:** 37 German-to-English translations via SQL UPDATE.
- **Socket auth middleware:** JWT verification on socket.io connection (`io.use`) — used by lottery engine for authenticated operations.

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
| `game_feed_history` | Server → Client | Array der letzten 20 Ergebnisse bei Verbindung |
| `game_feed_update` | Server → Client | Einzelnes neues Ergebnis (wird mit 5s Delay im Frontend angezeigt) |

## ⚽ World Cup 2026 Betting Architecture

### Backend Service (`worldCupService.js`)
- **Initialization:** On startup, loads cached matches from `worldcup_matches.json`. If no cache exists, fetches fixtures from `thestatsapi.com/world-cup/data/fixtures.json`.
- **Odds source priority:** Real odds from The Odds API (`soccer_fifa_world_cup` sport key) > fallback strength-based odds.
- **Score source:** `wcup2026.org/api/data.php?action=all` — provides live scores, match status (`upcoming`/`live`/`finished`), and elapsed minutes for all 104 WC matches.
- **Team name normalization:** `TEAM_ALIASES` map handles naming differences between APIs (e.g. "South Korea" → "Korea Republic", "USA" → "United States", "Ivory Coast" → "Cote d'Ivoire", "Czech Republic" → "Czechia", "Turkey" → "Turkiye", "Curaçao" → "Curacao", "Bosnia & Herzegovina" → "Bosnia and Herzegovina").
- **Winner recalculation:** Always recalculates `match.winner` from actual scores (`homeScore` vs `awayScore`), even for already-completed matches. This prevents stale/incorrect winners from cached data.
- **Auto-refresh interval:** 1 minute (`ODDS_REFRESH_INTERVAL`). Fetches odds + scores, persists changes to `worldcup_matches.json`.

### API Endpoints (in `server.js`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/worldcup/matches` | No | Returns all matches with current odds, scores, status |
| POST | `/api/worldcup/bet` | JWT | Place a bet (matchId, betType, stake) |
| GET | `/api/worldcup/my-bets` | JWT | List user's World Cup bets |
| POST | `/api/admin/worldcup/simulate` | Admin | Manually simulate a match result |
| POST | `/api/admin/worldcup/refresh-odds` | Admin | Force re-fetch odds and scores |

### Database (`worldcup_bets` table)
```sql
CREATE TABLE worldcup_bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, match_id TEXT, bet_type TEXT,
  odds REAL, stake REAL, status TEXT DEFAULT 'pending',
  payout REAL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
- **Status flow:** `pending` → `won` (payout = stake × odds) or `lost` (payout = 0).
- Bets are auto-resolved when `fetchScores()` detects a match transition to `completed`.

### Frontend (`WorldCup.jsx`)
- **Match cards:** Show team flags (emoji), team names, scores (for live/completed), odds buttons, status badge.
- **Bet slip:** Right sidebar (desktop) with selection, odds, stake input, potential payout calculation.
- **Filters:** Open / In Progress / Completed / All — with count badges.
- **Desktop background:** Fixed `background-attachment: fixed` image via `.worldcup-container-bg` div, hidden via `@media (max-width: 768px)`.
- **Mobile stacking:** `@media (max-width: 600px)` overrides grid to single column for teams and odds.
- **Auto-refresh:** Frontend polls `/api/worldcup/matches` every 15 seconds.

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

### Steam Bot (Real Mode)
- `backend/.env` — Steam credentials are set (`STEAM_ACCOUNT_NAME=jujuscol`, `STEAM_PASSWORD=...`, `JWT_SECRET=...`)
- Backend starts in **real Steam bot mode** — connects to Steam (requires Steam Guard code on startup)
- Steam Guard code is read from `sg.txt` file in project root (or `STEAM_GUARD_CODE` env var) — **no stdin reading**, prevents parent shell from blocking
- Create `sg.txt` with the 5-character code before starting: `Set-Content sg.txt "XXXXX"`
- Deposits/withdrawals work via real Steam trade offers once bot is fully logged in

### Item Inventory System (Replaces Gems + Pending Payouts)
- Deposited items go directly to `user_inventories` table as `available` (status: `available`, `selling`, `withdrawing`)
- **No gems credited** on deposit — items stay as items
- **No 7-day payout lock** — items are immediately available
- `/inventory` page at `frontend/src/pages/Inventory.jsx` — item grid with hover actions:
  - **Sell** — converts item to gems at full `item_value` via `POST /api/inventory/sell`
  - **Withdraw** — marks item as `withdrawing` (admin handles trade) via `POST /api/inventory/withdraw`
- Navbar dropdown has "Inventory" link (`Package` icon) between Settings and Logout
- DepositWithdrawModal: Payouts tab removed, shows "Goes to Inventory" instead of gem breakdown
- **Removed old system:** `deposits` table, `startPayoutReleaseLoop`, `/api/deposits/pending`, `/api/deposits/mature-test`
- New endpoints: `GET /api/user-inventory`, `POST /api/inventory/sell`, `POST /api/inventory/withdraw`

### Critical Fixes
- **Nested transaction crash** (`tradebotService.js:122`): Payout loop had `BEGIN TRANSACTION` inside `db.all` callback — moved to single `db.serialize()` wrapper
- **Fake skin combos**: Seed scripts originally generated random names that didn't exist in CS2 → replaced all 644 items with real CSGO-API data
- **`rarityTag.name.replace()` crash** (`server.js:522`): Steam inventory API returns `Rarity` tags without a `name` for some items — added `&& rarityTag.name` null check to prevent `Cannot read properties of undefined (reading 'replace')`

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
