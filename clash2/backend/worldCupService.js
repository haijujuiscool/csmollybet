const https = require('https');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'worldcup_matches.json');
const ODDS_CACHE_FILE = path.join(__dirname, 'worldcup_odds_cache.json');

// The Odds API config – free tier (500 requests/month)
// Sport key for FIFA World Cup
const SPORT_KEY = 'soccer_fifa_world_cup';

function getApiKey() {
    return process.env.ODDS_API_KEY || '';
}

let worldCupMatches = [];
let lastOddsFetchTime = 0;
const ODDS_REFRESH_INTERVAL = 1 * 60 * 1000; // Refresh odds every 1 minute

// ─── Team name normalization (The Odds API uses slightly different names) ───
const TEAM_ALIASES = {
    'usa': 'United States',
    'united states': 'United States',
    'us': 'United States',
    'korea republic': 'Korea Republic',
    'south korea': 'Korea Republic',
    'republic of korea': 'Korea Republic',
    'ir iran': 'IR Iran',
    'iran': 'IR Iran',
    'turkiye': 'Turkiye',
    'turkey': 'Turkiye',
    'türkiye': 'Turkiye',
    "cote d'ivoire": "Cote d'Ivoire",
    'ivory coast': "Cote d'Ivoire",
    'congo dr': 'Congo DR',
    'dr congo': 'Congo DR',
    'dem. rep. congo': 'Congo DR',
    'democratic republic of the congo': 'Congo DR',
    'cabo verde': 'Cabo Verde',
    'cape verde': 'Cabo Verde',
    'bosnia and herzegovina': 'Bosnia and Herzegovina',
    'bosnia': 'Bosnia and Herzegovina',
    'bosnia & herzegovina': 'Bosnia and Herzegovina',
    'curacao': 'Curacao',
    'curaçao': 'Curacao',
    'czech republic': 'Czechia',
    'czechia': 'Czechia',
};

function normalizeTeamName(name) {
    if (!name) return name;
    const lower = name.trim().toLowerCase();
    return TEAM_ALIASES[lower] || name.trim();
}

// ─── Fetch from The Odds API ───
function fetchFromOddsApi(endpoint) {
    const apiKey = getApiKey();
    if (!apiKey) return Promise.resolve(null);

    const url = `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
    
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                // Log remaining quota
                const remaining = res.headers['x-requests-remaining'];
                const used = res.headers['x-requests-used'];
                if (remaining !== undefined) {
                    console.log(`[OddsAPI] Quota: ${used} used, ${remaining} remaining`);
                }
                
                if (res.statusCode !== 200) {
                    console.error(`[OddsAPI] HTTP ${res.statusCode}: ${body.substring(0, 200)}`);
                    resolve(null);
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    console.error('[OddsAPI] Parse error:', e.message);
                    resolve(null);
                }
            });
        }).on('error', (err) => {
            console.error('[OddsAPI] Fetch error:', err.message);
            resolve(null);
        });
    });
}

// ─── Fetch real odds and merge with match data ───
async function fetchRealOdds() {
    const now = Date.now();
    if (now - lastOddsFetchTime < ODDS_REFRESH_INTERVAL) {
        console.log('[WorldCup] Skipping odds refresh (too soon)');
        return false;
    }
    
    console.log('[WorldCup] Fetching real odds from The Odds API...');
    const oddsData = await fetchFromOddsApi('odds?regions=eu&markets=h2h&oddsFormat=decimal');
    
    if (!oddsData || !Array.isArray(oddsData)) {
        console.warn('[WorldCup] No odds data received from API');
        return false;
    }
    
    lastOddsFetchTime = now;
    console.log(`[WorldCup] Received ${oddsData.length} events with odds from API`);

    // Save raw odds cache for debugging
    try {
        fs.writeFileSync(ODDS_CACHE_FILE, JSON.stringify(oddsData, null, 2), 'utf8');
    } catch (e) {}

    let updatedCount = 0;
    
    for (const event of oddsData) {
        const apiHome = normalizeTeamName(event.home_team);
        const apiAway = normalizeTeamName(event.away_team);
        
        // Find matching local match
        const match = worldCupMatches.find(m => {
            const localHome = normalizeTeamName(m.home);
            const localAway = normalizeTeamName(m.away);
            return (localHome === apiHome && localAway === apiAway) ||
                   (localHome === apiAway && localAway === apiHome); // Sometimes home/away swap
        });
        
        if (!match) continue;
        
        // Extract average odds from all bookmakers
        let homeOddsList = [];
        let drawOddsList = [];
        let awayOddsList = [];
        
        for (const bookmaker of (event.bookmakers || [])) {
            for (const market of (bookmaker.markets || [])) {
                if (market.key !== 'h2h') continue;
                for (const outcome of (market.outcomes || [])) {
                    const normalizedOutcomeName = normalizeTeamName(outcome.name);
                    const normalizedHome = normalizeTeamName(match.home);
                    const normalizedAway = normalizeTeamName(match.away);
                    
                    if (normalizedOutcomeName === normalizedHome) {
                        homeOddsList.push(outcome.price);
                    } else if (normalizedOutcomeName === normalizedAway) {
                        awayOddsList.push(outcome.price);
                    } else if (outcome.name === 'Draw') {
                        drawOddsList.push(outcome.price);
                    }
                }
            }
        }
        
        // Calculate average odds (use median for more stability)
        if (homeOddsList.length > 0) {
            homeOddsList.sort((a, b) => a - b);
            match.homeOdds = parseFloat(homeOddsList[Math.floor(homeOddsList.length / 2)].toFixed(2));
        }
        if (drawOddsList.length > 0) {
            drawOddsList.sort((a, b) => a - b);
            match.drawOdds = parseFloat(drawOddsList[Math.floor(drawOddsList.length / 2)].toFixed(2));
        }
        if (awayOddsList.length > 0) {
            awayOddsList.sort((a, b) => a - b);
            match.awayOdds = parseFloat(awayOddsList[Math.floor(awayOddsList.length / 2)].toFixed(2));
        }
        
        // Update kickoff time from API if available
        if (event.commence_time) {
            match.kickoff = event.commence_time;
            match.date = event.commence_time.split('T')[0];
        }
        
        // Mark the odds source
        match.oddsSource = 'live';
        match.oddsUpdatedAt = new Date().toISOString();
        updatedCount++;
    }
    
    console.log(`[WorldCup] Updated real odds for ${updatedCount}/${worldCupMatches.length} matches`);
    
    // Auto-close matches based on kickoff time
    updateMatchStatuses();
    
    saveMatches();
    return true;
}

// ─── Fetch scores from wcup2026.org API ───
async function fetchRealScores() {
    console.log('[WorldCup] Fetching real-time scores from wcup2026.org API...');
    return new Promise((resolve) => {
        https.get('https://wcup2026.org/api/data.php?action=all', (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.error(`[WorldCup] API HTTP ${res.statusCode}`);
                    resolve([]);
                    return;
                }
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.ok && Array.isArray(parsed.matches)) {
                        resolve(parsed.matches);
                    } else {
                        resolve([]);
                    }
                } catch (e) {
                    console.error('[WorldCup] API parse error:', e.message);
                    resolve([]);
                }
            });
        }).on('error', (err) => {
            console.error('[WorldCup] API fetch error:', err.message);
            resolve([]);
        });
    });
}

async function fetchScores() {
    const apiMatches = await fetchRealScores();
    if (!apiMatches || apiMatches.length === 0) {
        console.warn('[WorldCup] No scores data received from wcup2026.org');
        return [];
    }

    console.log(`[WorldCup] Received ${apiMatches.length} matches from wcup2026.org`);

    let resolvedMatches = [];
    let shouldSave = false;

    for (const apiMatch of apiMatches) {
        const apiHome = normalizeTeamName(apiMatch.team1);
        const apiAway = normalizeTeamName(apiMatch.team2);

        const match = worldCupMatches.find(m => {
            const localHome = normalizeTeamName(m.home);
            const localAway = normalizeTeamName(m.away);
            return (localHome === apiHome && localAway === apiAway) ||
                   (localHome === apiAway && localAway === apiHome);
        });

        if (!match) continue;

        // Parse scores
        let homeScore = null;
        let awayScore = null;
        if (Array.isArray(apiMatch.score)) {
            homeScore = apiMatch.score[0];
            awayScore = apiMatch.score[1];
        } else if (typeof apiMatch.score === 'string') {
            const parts = apiMatch.score.trim().split(/\s+/);
            if (parts.length === 2) {
                homeScore = parseInt(parts[0]);
                awayScore = parseInt(parts[1]);
            }
        }

        // Apply scores to local match if they are defined
        if (homeScore !== null && awayScore !== null) {
            if (match.homeScore !== homeScore || match.awayScore !== awayScore) {
                match.homeScore = homeScore;
                match.awayScore = awayScore;
                shouldSave = true;
            }

            // Always recalculate winner from scores (fixes stale winner from old simulated runs)
            const correctWinner = homeScore > awayScore ? 'home' : (awayScore > homeScore ? 'away' : 'draw');
            if (match.winner !== correctWinner && (match.status === 'completed' || apiMatch.status === 'finished')) {
                const oldWinner = match.winner;
                match.winner = correctWinner;
                shouldSave = true;
                console.log(`[WorldCup] Fixed winner for ${match.home} ${homeScore}-${awayScore} ${match.away}: ${oldWinner} → ${correctWinner}`);
            }
        }

        // Apply live progress or finalization
        if (apiMatch.status === 'live' || apiMatch.status === 'in-progress') {
            const nextElapsed = apiMatch.live_minute || 0;
            if (match.status !== 'closed' || match.liveElapsed !== nextElapsed) {
                match.status = 'closed';
                match.liveElapsed = nextElapsed;
                shouldSave = true;
            }
        } else if (apiMatch.status === 'finished') {
            if (match.status !== 'completed') {
                match.status = 'completed';
                if (homeScore > awayScore) {
                    match.winner = 'home';
                } else if (awayScore > homeScore) {
                    match.winner = 'away';
                } else {
                    match.winner = 'draw';
                }
                resolvedMatches.push(match);
                console.log(`[WorldCup] Auto-resolved via wcup2026.org API: ${match.home} ${homeScore}-${awayScore} ${match.away} → Winner: ${match.winner}`);
                shouldSave = true;
            }
        }
    }

    if (shouldSave || resolvedMatches.length > 0) {
        saveMatches();
    }

    return resolvedMatches;
}

// ─── Update match statuses based on kickoff time ───
function updateMatchStatuses() {
    const now = new Date();
    let changed = 0;
    const newlyCompleted = [];
    
    for (const match of worldCupMatches) {
        if (match.status === 'completed') continue;
        
        if (match.kickoff) {
            const kickoffTime = new Date(match.kickoff);
            const diffMs = now - kickoffTime;
            
            if (diffMs >= 0) {
                // Match has started or finished – close for betting.
                // Do NOT make up any scores or auto-complete them here.
                // Complete matches only when we retrieve actual scores from wcup2026.org!
                if (match.status !== 'closed') {
                    match.status = 'closed';
                    changed++;
                }
            }
        }
    }
    
    return { changed, newlyCompleted };
}

// ─── Filter for matches with clear team names ───
function filterClearTeam(team) {
    if (!team) return false;
    const lower = team.toLowerCase();
    return !lower.includes('winner') && 
           !lower.includes('runner') && 
           !lower.includes('tbd') && 
           !lower.includes('group') && 
           !lower.includes('ru') && 
           !lower.includes('w5') && 
           !lower.includes('w6');
}

// ─── Fallback: generate synthetic odds (only used if API has no odds for a match) ───
const teamStrengths = {
    'Argentina': 90, 'France': 89, 'Brazil': 88, 'England': 87, 'Spain': 87,
    'Portugal': 85, 'Netherlands': 84, 'Germany': 84, 'Italy': 83, 'Belgium': 82,
    'Croatia': 81, 'Uruguay': 80, 'Japan': 78, 'United States': 77, 'Mexico': 76,
    'Morocco': 78, 'Senegal': 76, 'Switzerland': 75, 'Denmark': 75, 'Korea Republic': 74,
    'Paraguay': 72, 'South Africa': 70, 'Canada': 71, 'Scotland': 70, 'Haiti': 60,
    'Bosnia and Herzegovina': 69, 'Czechia': 71, 'Australia': 72, 'Turkiye': 76,
    'Qatar': 68, 'Ecuador': 74, 'Curacao': 55, 'Sweden': 73, 'Tunisia': 72,
    'Cabo Verde': 55, 'IR Iran': 73, 'New Zealand': 65, 'Egypt': 71,
    'Iraq': 70, 'Norway': 74, 'Algeria': 72, 'Austria': 75, 'Jordan': 68,
    'Ghana': 72, 'Panama': 68, 'Congo DR': 70, 'Uzbekistan': 70, 'Colombia': 80,
    'Saudi Arabia': 68, "Cote d'Ivoire": 74
};

function generateFallbackOdds(homeTeam, awayTeam) {
    const homeStr = teamStrengths[homeTeam] || 70;
    const awayStr = teamStrengths[awayTeam] || 70;
    const diff = homeStr - awayStr;

    let homeProb = 0.40 + (diff * 0.012);
    let awayProb = 0.30 - (diff * 0.012);

    homeProb = Math.max(0.12, Math.min(0.78, homeProb));
    awayProb = Math.max(0.12, Math.min(0.78, awayProb));
    const drawProb = 1.0 - homeProb - awayProb;

    const margin = 0.94; // 6% margin
    const homeOdds = parseFloat((margin / homeProb).toFixed(2));
    const drawOdds = parseFloat((margin / drawProb).toFixed(2));
    const awayOdds = parseFloat((margin / awayProb).toFixed(2));

    return { homeOdds, drawOdds, awayOdds };
}

// ─── Initialize: load fixtures + real odds ───
function initialize(callback) {
    // Check if cache file exists
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            worldCupMatches = JSON.parse(data);
            console.log(`[WorldCup] Loaded ${worldCupMatches.length} matches from cache.`);
            
            // Immediately update statuses based on time
            updateMatchStatuses();
            saveMatches();
            
            // Then try to fetch real odds in background
            fetchRealOdds().then(() => {
                fetchScores().then((resolved) => {
                    if (resolved.length > 0 && callback) {
                        callback(worldCupMatches);
                    }
                });
            });
            
            if (callback) callback(worldCupMatches);
            return;
        } catch (e) {
            console.error('[WorldCup] Failed to parse cache file:', e.message);
        }
    }

    console.log('[WorldCup] Fetching real matches from TheStatsAPI...');
    https.get('https://www.thestatsapi.com/world-cup/data/fixtures.json', (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                const fixtures = parsed.fixtures || [];
                const clearFixtures = fixtures.filter(f => filterClearTeam(f.homeTeam) && filterClearTeam(f.awayTeam));
                
                worldCupMatches = clearFixtures.map(f => {
                    const odds = generateFallbackOdds(f.homeTeam, f.awayTeam);
                    return {
                        id: `wc_${f.matchNumber}`,
                        home: f.homeTeam,
                        away: f.awayTeam,
                        homeOdds: odds.homeOdds,
                        drawOdds: odds.drawOdds,
                        awayOdds: odds.awayOdds,
                        status: 'upcoming',
                        stage: f.stage.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        date: f.date,
                        kickoff: f.kickoffUtc,
                        winner: null,
                        oddsSource: 'fallback'
                    };
                });

                // Immediately update statuses 
                updateMatchStatuses();

                fs.writeFileSync(CACHE_FILE, JSON.stringify(worldCupMatches, null, 2), 'utf8');
                console.log(`[WorldCup] Initialized and cached ${worldCupMatches.length} real matches.`);
                
                // Then try to overlay real odds
                fetchRealOdds().then(() => {
                    fetchScores();
                });
                
                if (callback) callback(worldCupMatches);
            } catch (err) {
                console.error('[WorldCup] Failed to process fixtures API data:', err.message);
                if (callback) callback([]);
            }
        });
    }).on('error', (err) => {
        console.error('[WorldCup] Fetch error:', err.message);
        if (callback) callback([]);
    });
}

function saveMatches() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(worldCupMatches, null, 2), 'utf8');
    } catch (e) {
        console.error('[WorldCup] Failed to write cache file:', e.message);
    }
}

// ─── Periodically refresh odds and scores ───
let refreshInterval = null;
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(async () => {
        try {
            await fetchRealOdds();
            await fetchScores();
        } catch (e) {
            console.error('[WorldCup] Auto-refresh error:', e.message);
        }
    }, ODDS_REFRESH_INTERVAL);
    console.log(`[WorldCup] Auto-refresh started (every ${ODDS_REFRESH_INTERVAL / 60000} min)`);
}

module.exports = {
    initialize,
    getMatches: () => {
        // Always update statuses on read
        const { changed } = updateMatchStatuses();
        if (changed > 0) {
            saveMatches();
        }
        return worldCupMatches;
    },
    saveMatches,
    fetchRealOdds,
    fetchScores,
    startAutoRefresh,
    updateMatchStatuses
};
