# Clash.gg Clone - Project Documentation

Diese Dokumentation fasst den aktuellen Stand des Projekts zusammen, damit in einem neuen Chat nahtlos weitergearbeitet werden kann.

## 🛠 Technologie-Stack
- **Frontend:** React (gebaut mit Vite), React Router DOM, Axios, Socket.io-Client, canvas-confetti.
- **Backend:** Node.js, Express.js, Socket.io, SQLite3 (lokale Datei `database.sqlite`), Multer (Bild-Upload).
- **Authentifizierung:** JWT (JSON Web Tokens).

## 📂 Dateistruktur (Wichtigste Dateien)
- `frontend/src/App.jsx`: Main Routing & Layout (Navbar, Chat-Sidebar).
- `frontend/src/contexts/AuthContext.jsx`: Verwaltet User-Session, Token und das optimistische Balance-Update (`setUser`).
- `frontend/src/utils/sounds.js`: Web Audio API Modul für alle Soundeffekte (Karten, Explosionen, Ticks).
- `frontend/src/components/Chat.jsx`: Chat-Sidebar mit Live Chat und **Live Game Feed** (Toggle zwischen beiden Views).
- `frontend/src/components/RouletteSpinner.jsx`: Roulette-Spinner-Animation für Case Openings (mit Mythic-Spin Support).
- `backend/server.js`: Hauptserver, API-Endpunkte, SQLite-Queries, `broadcastGameResult()`-Funktion für den Game Feed.
- `backend/battleEngine.js`: Externe Logik für Case Battles (Lobby, Timer, Bot-Logik, Game Feed Broadcast).
- `backend/chatEngine.js`: Socket.io Chat + Game Feed History Emission bei Verbindung.
- `backend/admin.js`: CLI-Tool für Admin-Aufgaben (z.B. Gems vergeben: `node admin.js add-gems Username 1000`).

## 🎮 Implementierte Spielmodi
1. **Cases (Solo & Creator):** Eigene Cases können erstellt werden. Items haben Bilder und Wahrscheinlichkeiten. "Mythic Spin" Modus (hebt Items >150% Profit hervor).
2. **Case Battles:** Multiplayer via WebSockets. Modi: 1v1, 1v1v1, 2v2, 3v3, FFA. "Crazy Mode" (wenigster Loot gewinnt). Voller Bot-Support.
3. **Upgrader:** SVG-Ring-Spinner. Win-Chance wird berechnet (`(Bet * 0.99) / Ziel-Preis`). 99% RTP ist fest einprogrammiert.
4. **Crash:** Raketen-Animation mit Cashout-Funktion. Sound-Cleanup via React `useEffect` Unmount.
5. **Double (Roulette):** Rot/Schwarz/Grün-System. History der letzten 100 Spins inkl. Statistik-Anzeige.
6. **Mines:** Server-seitige Mine-Generierung (damit nicht cheatbar). Basiert auf einem 5x5 Raster.
7. **Plinko:** 8, 14 oder 16 Reihen. Low/Medium/High Risk. Der Fallweg wird vom Backend (`'R'`/`'L'`) vorgegeben und im Frontend synchron animiert.
8. **Keep Digging:** Schaufel-Minispiel. Klick-basiertes Aufdecken von Multiplikatoren.
9. **Chicken Road:** Lane-basiertes Voranschreiten.
10. **Blackjack (Normal & Live):**
    - **Normal:** Gegen den Dealer mit asynchronen Animationen.
    - **Live Multiplayer:** Lobby-basiert via WebSockets. Alle setzen auf das gleiche Board, entscheiden aber individuell (Hit, Stand, Double). Dealer-Bild (`dealer.png`) über den Karten platziert.
11. **Slots:** Slot-Machine mit Multiplikator-System.
12. **Kalshi Bets (Deaktiviert):** Vorhersagemärkte basierend auf der Kalshi-API. (Aktuell deaktiviert, um Leistung zu sparen und den Netzwerk-Workload zu minimieren).

## 💬 Chat-System & Live Game Feed

### Chat
- Jedes Zeichen kostet 1 Gem. Fireworks kosten 1000 Gems und lösen eine `canvas-confetti` Animation aus.
- History wird über `chatEngine.js` verwaltet (letzte 50 Nachrichten).

### Live Game Feed
- **Toggle:** Chat-Sidebar hat zwei Tabs: `💬 Chat` und `📊 Live Feed`.
- **Datenquelle:** `global.broadcastGameResult(username, gameName, betAmount, payoutAmount, multiplier)` in `server.js` (Zeile 59).
  - Berechnet `profit = payoutAmount - betAmount` und sendet via `io.emit('game_feed_update', update)`.
- **Unterstützte Spiele:** Cases, CaseBattle, Double, Crash, Mines, ChickenRoad, Upgrader, Blackjack, LiveBlackjack, Plinko, KeepDigging, Slots.
- **5-Sekunden-Verzögerung:** Neue Ergebnisse im Feed werden mit einem `setTimeout(5000)` verzögert angezeigt, damit man Ergebnisse nicht als Spoiler sieht.
- **Feed-Karten:** Zeigen Username, Spielname, Einsatz, Multiplikator und Profit/Verlust.
  - **Grün** (`#22c55e`): Profit > 0 (Gewinn).
  - **Rot** (`#ef4444`): Profit ≤ 0 (Verlust oder Break-even).
- **History:** Beim Verbinden werden die letzten 50 Ergebnisse aus `global.gameFeedHistory` gesendet.

## 🏆 Challenge
- **1.000.000 Gems Challenge:** Die erste Person, die 1 Million Gems erreicht, bekommt 1€. Angezeigt auf der Home-Seite.

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

## 🔧 Architektur-Details

### broadcastGameResult() Signatur
```js
global.broadcastGameResult = (username, gameName, betAmount, payoutAmount, multiplier) => {
    const profit = payoutAmount - betAmount;
    // profit > 0 = Gewinn, profit <= 0 = Verlust
    const update = { username, game: gameName, bet, multiplier, profit, timestamp };
    io.emit('game_feed_update', update);
};
```

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

