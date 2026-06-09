const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);
const seen = new Set();
const results = [];
const IMAGES = {};

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', reject).setTimeout(20000, () => reject(new Error('Timeout')));
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getWear(name) {
    for (const [w, s] of [['(Factory New)', 'FN'], ['(Minimal Wear)', 'MW'], ['(Field-Tested)', 'FT'], ['(Well-Worn)', 'WW'], ['(Battle-Scarred)', 'BS']])
        if (name.includes(w)) return s;
    return null;
}

function getFloat(w) {
    const r = { FN: [0, 0.07], MW: [0.07, 0.15], FT: [0.15, 0.38], WW: [0.38, 0.45], BS: [0.45, 0.8] };
    const [min, max] = r[w] || [0.15, 0.38];
    return parseFloat((Math.random() * (max - min) + min).toFixed(4));
}

function parsePrice(text) {
    const m = text.match(/(\d+[.,]?\d*)/);
    return m ? parseFloat(m[1].replace(',', '')) : null;
}

function parseItems(html) {
    const items = [];
    const linkRegex = /<a class="market_listing_row_link"[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        const block = match[1];
        const nm = block.match(/market_listing_item_name[^>]*>([^<]+)<\/span>/);
        if (!nm) continue;
        const name = nm[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
        if (!name.includes(' | ')) continue;

        let price = null;
        const pf = block.match(/market_listing_price_with_fee[^>]*>([\s\S]*?)<\/span>/);
        if (pf) { const pt = pf[1].replace(/<[^>]+>/g, '').trim(); price = parsePrice(pt); }
        if (!price) {
            const pn = block.match(/market_listing_price[^>]*>([\s\S]*?)<\/span>/);
            if (pn) { const pt = pn[1].replace(/<[^>]+>/g, '').trim(); price = parsePrice(pt); }
        }
        if (!price) continue;

        const im = block.match(/<img[^>]+src="([^"]+)"[^>]*>/);
        let imgUrl = im ? im[1] : '';
        if (imgUrl) imgUrl = imgUrl.replace(/\/\d+x\d+f.*$/, '/360fx360f');

        items.push({ name, price, imgUrl });
    }
    return items;
}

async function fetchByQuery(query, start = 0) {
    const url = `https://steamcommunity.com/market/search/render/?query=${encodeURIComponent(query)}&start=${start}&count=100&search_descriptions=0&sort_column=quantity&sort_dir=desc&appid=730&currency=1`;
    const raw = await httpGet(url);
    const parsed = JSON.parse(raw);
    if (!parsed.success || !parsed.results_html) return [];
    return parseItems(parsed.results_html);
}

async function fetchPrice(name) {
    try {
        const hashName = encodeURIComponent(name);
        const url = `https://steamcommunity.com/market/priceoverview/?appid=730&market_hash_name=${hashName}&currency=1`;
        const raw = await httpGet(url);
        const parsed = JSON.parse(raw);
        if (parsed.success && parsed.lowest_price) {
            const m = parsed.lowest_price.match(/\$?(\d+\.?\d*)/);
            if (m) return parseFloat(m[1]);
        }
    } catch (e) {}
    return null;
}

// Search multiple categories of weapon skins
async function searchWeaponSkins() {
    // Search by popular skin collections and operations to get many skins per query
    const queries = [
        'AK-47 |', 'M4A4 |', 'M4A1-S |', 'AWP |', 'USP-S |',
        'Glock-18 |', 'Desert Eagle |', 'SSG 08 |', 'FAMAS |',
        'Galil AR |', 'P90 |', 'MP9 |', 'MAC-10 |', 'UMP-45 |',
        'MP7 |', 'PP-Bizon |', 'Nova |', 'XM1014 |',
        'MAG-7 |', 'P250 |', 'Five-SeveN |', 'Tec-9 |',
        'CZ75-Auto |', 'R8 Revolver |', 'SG 553 |', 'AUG |',
        'Negev |', 'M249 |', 'G3SG1 |', 'SCAR-20 |', 'MP5-SD |'
    ];

    for (const query of queries) {
        if (results.length >= 300) break;
        // Get 2 pages per weapon
        for (let page = 0; page < 2; page++) {
            if (results.length >= 300) break;
            try {
                const items = await fetchByQuery(query, page * 100);
                let added = 0;
                for (const item of items) {
                    const wear = getWear(item.name);
                    if (!wear) continue;
                    if (!item.name.includes(' | ')) continue;
                    if (item.price < 0.1 || item.price > 50) continue;
                    const key = item.name.trim().toLowerCase();
                    if (seen.has(key)) continue;
                    seen.add(key);
                    results.push({
                        name: item.name.trim(),
                        price: item.price,
                        imgUrl: item.imgUrl,
                        floatVal: getFloat(wear)
                    });
                    added++;
                    if (results.length >= 300) break;
                }
                if (added > 0) console.log(`  [${query}] page ${page}: +${added} (total: ${results.length}/300)`);
                await sleep(1200);
            } catch (e) {
                console.log(`  Error on ${query} page ${page}: ${e.message}`);
                await sleep(3000);
            }
        }
    }
}

// Fallback: 1000+ skin names to check prices for via API
async function checkPrices() {
    const SKIN_LIST = [
        "AK-47 | Ice Coaled (Field-Tested)", "AK-47 | Slate (Field-Tested)", "AK-47 | Cartel (Field-Tested)",
        "AK-47 | Safety Net (Field-Tested)", "AK-47 | Leet Museo (Field-Tested)", "AK-47 | Green Laminate (Field-Tested)",
        "AK-47 | Jungle Spray (Field-Tested)", "AK-47 | Predator (Field-Tested)", "AK-47 | Phantom Disruptor (Field-Tested)",
        "AK-47 | Redline (Minimal Wear)", "AK-47 | Rat Rod (Field-Tested)", "M4A4 | Poly Mag (Field-Tested)",
        "M4A4 | Etch Lord (Field-Tested)", "M4A4 | Evil Daimyo (Field-Tested)", "M4A4 | Daybreak (Field-Tested)",
        "M4A4 | Cyber Security (Field-Tested)", "M4A4 | Converter (Field-Tested)", "M4A4 | Desolate Space (Field-Tested)",
        "M4A4 | Tooth Fairy (Field-Tested)", "M4A4 | Dragon King (Field-Tested)", "M4A1-S | Leaded Glass (Field-Tested)",
        "M4A1-S | Night Terror (Field-Tested)", "M4A1-S | Emphorosaur-S (Field-Tested)", "M4A1-S | Moss Quartz (Field-Tested)",
        "M4A1-S | Player Two (Field-Tested)", "M4A1-S | Control (Field-Tested)", "M4A1-S | Decimator (Minimal Wear)",
        "M4A1-S | Briefing (Field-Tested)", "M4A1-S | Mecha Industries (Field-Tested)", "M4A1-S | Basilisk (Field-Tested)",
        "M4A1-S | Blood Tiger (Field-Tested)", "M4A1-S | Bright Water (Field-Tested)", "M4A1-S | Dark Water (Field-Tested)",
        "AWP | Capillary (Field-Tested)", "AWP | PAW (Field-Tested)", "AWP | Chrome Cannon (Field-Tested)",
        "AWP | Duality (Field-Tested)", "AWP | Exoskeleton (Field-Tested)", "AWP | Sun in Leo (Field-Tested)",
        "AWP | Black Nile (Field-Tested)", "AWP | Corticera (Field-Tested)", "AWP | Electric Hive (Field-Tested)",
        "AWP | Fever Dream (Field-Tested)", "AWP | Neo-Noir (Field-Tested)", "AWP | Acheron (Field-Tested)",
        "AWP | Jungle Slipstream (Field-Tested)", "AWP | Worm God (Field-Tested)", "AWP | Pit Viper (Field-Tested)",
        "USP-S | Flashback (Field-Tested)", "USP-S | Business Class (Field-Tested)", "USP-S | Road Rash (Field-Tested)",
        "USP-S | Check Engine (Field-Tested)", "USP-S | The Traitor (Field-Tested)", "USP-S | Lead Conduit (Field-Tested)",
        "USP-S | Monster Mashup (Field-Tested)", "USP-S | Blueprint (Field-Tested)", "USP-S | Target Acquired (Field-Tested)",
        "USP-S | Cyrex (Field-Tested)", "USP-S | Ticket to Hell (Field-Tested)", "USP-S | Forest Leaves (Field-Tested)",
        "Glock-18 | Vogue (Field-Tested)", "Glock-18 | Ironwork (Field-Tested)", "Glock-18 | Bubson Burner (Field-Tested)",
        "Glock-18 | Sacrifice (Field-Tested)", "Glock-18 | Death Rattle (Field-Tested)", "Glock-18 | Royal Legion (Field-Tested)",
        "Glock-18 | Warhawk (Field-Tested)", "Glock-18 | High Water (Field-Tested)", "Glock-18 | Weasel (Field-Tested)",
        "Glock-18 | Oxide Blaze (Field-Tested)", "Glock-18 | Battle Scarred (Field-Tested)", "Glock-18 | Brass (Field-Tested)",
        "Desert Eagle | Trigger Discipline (Field-Tested)", "Desert Eagle | Night Heist (Field-Tested)",
        "Desert Eagle | Light Rail (Field-Tested)", "Desert Eagle | Bronze Deco (Field-Tested)",
        "Desert Eagle | Heated Shot (Field-Tested)", "Desert Eagle | Blue Ply (Field-Tested)",
        "Desert Eagle | Corinthian (Field-Tested)", "Desert Eagle | Siren (Field-Tested)", "Desert Eagle | Naga (Field-Tested)",
        "Desert Eagle | Crying Grave (Field-Tested)", "Desert Eagle | Mecha Industries (Field-Tested)",
        "Desert Eagle | Kumicho Dragon (Field-Tested)", "Desert Eagle | Conspiracy (Field-Tested)",
        "SSG 08 | Parallax (Field-Tested)", "SSG 08 | Hand Brake (Field-Tested)", "SSG 08 | Abyss (Field-Tested)",
        "SSG 08 | Mayan Dreams (Field-Tested)", "SSG 08 | Jungle Dashed (Field-Tested)", "SSG 08 | Slashed (Field-Tested)",
        "SSG 08 | Ghost Crusader (Field-Tested)", "SSG 08 | Threat Detected (Field-Tested)", "SSG 08 | Turbo Peek (Field-Tested)",
        "SSG 08 | Sand Scale (Field-Tested)", "SSG 08 | Palisade (Field-Tested)", "SSG 08 | Forest Night (Field-Tested)",
        "FAMAS | Roll Cage (Field-Tested)", "FAMAS | Styx (Field-Tested)", "FAMAS | Sergeant (Field-Tested)",
        "FAMAS | Commemoration (Field-Tested)", "FAMAS | Djinn (Field-Tested)", "FAMAS | Macabre (Field-Tested)",
        "FAMAS | ZX Spectron (Field-Tested)", "FAMAS | MLX (Field-Tested)", "FAMAS | Pulse (Field-Tested)",
        "FAMAS | Doomkitty (Field-Tested)", "FAMAS | Survivor Z (Field-Tested)", "FAMAS | Contingency (Field-Tested)",
        "Galil AR | Connexion (Field-Tested)", "Galil AR | Imperial (Field-Tested)", "Galil AR | Signal (Field-Tested)",
        "Galil AR | CAUTION! (Field-Tested)", "Galil AR | Chromatic Aberration (Field-Tested)", "Galil AR | Phase Glass (Field-Tested)",
        "Galil AR | Cold Fusion (Field-Tested)", "Galil AR | Sugar Rush (Field-Tested)", "Galil AR | Black Sand (Field-Tested)",
        "Galil AR | Rocket Pop (Field-Tested)", "Galil AR | Stone Cold (Field-Tested)", "Galil AR | Kami (Field-Tested)",
        "Galil AR | Tuxedo (Field-Tested)", "Galil AR | Orange DDPAT (Field-Tested)", "Galil AR | Winter Forest (Field-Tested)",
        "P90 | Grim (Field-Tested)", "P90 | Death by Kitty (Field-Tested)", "P90 | Traction (Field-Tested)",
        "P90 | Chopper (Field-Tested)", "P90 | Desert Halftone (Field-Tested)", "P90 | Freight (Field-Tested)",
        "P90 | Glacier Mesh (Field-Tested)", "P90 | Module (Field-Tested)", "P90 | Neoqueen (Field-Tested)",
        "P90 | Shallow Grave (Field-Tested)", "P90 | Storm Well (Field-Tested)", "P90 | Run and Hide (Field-Tested)",
        "P90 | Tiger Pit (Field-Tested)", "P90 | Vent Rush (Field-Tested)", "P90 | Full Throttle (Field-Tested)",
        "P90 | Off World (Field-Tested)", "P90 | Virus (Field-Tested)", "P90 | Ancient Ritual (Field-Tested)",
        "MP9 | Rose Iron (Field-Tested)", "MP9 | Bioleak (Field-Tested)", "MP9 | Black Sand (Field-Tested)",
        "MP9 | Starlight Protector (Field-Tested)", "MP9 | Modest Threat (Field-Tested)", "MP9 | Food Chain (Field-Tested)",
        "MP9 | Featherweight (Field-Tested)", "MP9 | Music Box (Field-Tested)", "MP9 | Goo (Field-Tested)",
        "MP9 | Block Surfer (Field-Tested)", "MP9 | Slide (Field-Tested)", "MP9 | Ruby Poison Dart (Field-Tested)",
        "MAC-10 | Pipe Down (Field-Tested)", "MAC-10 | Echoing Sands (Field-Tested)", "MAC-10 | Disco Tech (Field-Tested)",
        "MAC-10 | Last Dive (Field-Tested)", "MAC-10 | Lapis Gator (Field-Tested)", "MAC-10 | Button Machine (Field-Tested)",
        "MAC-10 | Propaganda (Field-Tested)", "MAC-10 | Ensnared (Field-Tested)", "MAC-10 | Nuclear Garden (Field-Tested)",
        "MAC-10 | Stalker (Field-Tested)", "MAC-10 | Silver (Field-Tested)", "MAC-10 | Allure (Field-Tested)",
        "UMP-45 | Moonrise (Field-Tested)", "UMP-45 | Grand Prix (Field-Tested)", "UMP-45 | Crime Scene (Field-Tested)",
        "UMP-45 | Scafold (Field-Tested)", "UMP-45 | Airstrike (Field-Tested)", "UMP-45 | Caramel (Field-Tested)",
        "UMP-45 | Blaze (Field-Tested)", "UMP-45 | Corporal (Field-Tested)", "UMP-45 | Labyrinth (Field-Tested)",
        "UMP-45 | Urban Hazard (Field-Tested)", "UMP-45 | Delusion (Field-Tested)", "UMP-45 | Arctic Wolf (Field-Tested)",
        "MP7 | Sun Moon (Field-Tested)", "MP7 | Mischief (Field-Tested)", "MP7 | Crimson Foil Spear (Field-Tested)",
        "MP7 | Full Stop (Field-Tested)", "MP7 | Groundwater (Field-Tested)", "MP7 | Forest DDPAT (Field-Tested)",
        "MP7 | Latte (Field-Tested)", "MP7 | Blue Gem (Field-Tested)", "MP7 | Impire (Field-Tested)",
        "MP7 | Special Delivery (Field-Tested)", "MP7 | Powercore (Field-Tested)", "MP7 | Motherboard (Field-Tested)",
        "MP7 | Prestige (Field-Tested)", "MP7 | Aqua (Field-Tested)", "MP7 | Oliv Plaid (Field-Tested)",
        "PP-Bizon | Runic (Field-Tested)", "PP-Bizon | Fuel Rod (Field-Tested)", "PP-Bizon | Phase Space (Field-Tested)",
        "PP-Bizon | High Roller (Field-Tested)", "PP-Bizon | Embargo (Field-Tested)", "PP-Bizon | Jungle Slipstream (Field-Tested)",
        "PP-Bizon | Lumen (Field-Tested)", "PP-Bizon | Irradiated Alert (Field-Tested)", "PP-Bizon | Death Rattle (Field-Tested)",
        "PP-Bizon | Harvester (Field-Tested)", "PP-Bizon | Armor Pierce (Field-Tested)", "PP-Bizon | Blue Streak (Field-Tested)",
        "PP-Bizon | Candy Apple (Field-Tested)", "PP-Bizon | Brass (Field-Tested)", "PP-Bizon | Modern Hunter (Field-Tested)",
        "Nova | Windblown (Field-Tested)", "Nova | Plume (Field-Tested)", "Nova | Clear Polymer (Field-Tested)",
        "Nova | Interlock (Field-Tested)", "Nova | Quick Sand (Field-Tested)", "Nova | Bloomstick (Field-Tested)",
        "Nova | Rising Skull (Field-Tested)", "Nova | Tempest (Field-Tested)", "Nova | Moon in Libra (Field-Tested)",
        "Nova | Exo (Field-Tested)", "Nova | Rust Coat (Field-Tested)", "Nova | Toy Soldier (Field-Tested)",
        "Nova | Yaeger (Field-Tested)", "Nova | Gila (Field-Tested)", "Nova | Walnut (Field-Tested)",
        "Nova | Mandrel (Field-Tested)", "Nova | Wood Fired (Field-Tested)", "Nova | Red Quasar (Field-Tested)",
        "XM1014 | Zombie Road (Field-Tested)", "XM1014 | Season (Field-Tested)", "XM1014 | Entombed (Field-Tested)",
        "XM1014 | Frost Borre (Field-Tested)", "XM1014 | Quicksilver (Field-Tested)", "XM1014 | Highwayman (Field-Tested)",
        "XM1014 | Slipstream (Field-Tested)", "XM1014 | Heaven Guard (Field-Tested)", "XM1014 | Fallout Warning (Field-Tested)",
        "XM1014 | Uraeus (Field-Tested)", "XM1014 | Charleris (Field-Tested)", "XM1014 | Scumbria (Field-Tested)",
        "XM1014 | Bone Machine (Field-Tested)", "XM1014 | Elegant Vines (Field-Tested)", "XM1014 | Teclu Burner (Field-Tested)",
        "MAG-7 | Cinquedea (Field-Tested)", "MAG-7 | Monsoon (Field-Tested)", "MAG-7 | Hard Water (Field-Tested)",
        "MAG-7 | Terror Squad (Field-Tested)", "MAG-7 | Petroglyph (Field-Tested)", "MAG-7 | Justice (Field-Tested)",
        "MAG-7 | Enforcer (Field-Tested)", "MAG-7 | Bully Boy (Field-Tested)", "MAG-7 | Heat (Field-Tested)",
        "MAG-7 | Seabird (Field-Tested)", "MAG-7 | Cerberus (Field-Tested)", "MAG-7 | Memento (Field-Tested)",
        "P250 | Nevermore (Field-Tested)", "P250 | Digital Architect (Field-Tested)", "P250 | Ripple (Field-Tested)",
        "P250 | Cyber Shell (Field-Tested)", "P250 | Epicenter (Field-Tested)", "P250 | Cartel (Field-Tested)",
        "P250 | X-Ray (Field-Tested)", "P250 | Cassette (Field-Tested)", "P250 | Wingshot (Field-Tested)",
        "P250 | Verdigris (Field-Tested)", "P250 | Whiteout (Field-Tested)", "P250 | Splash (Field-Tested)",
        "P250 | Bengal Tiger (Field-Tested)", "P250 | Asiimov (Field-Tested)", "P250 | Red Rock (Field-Tested)",
        "P250 | Drought (Field-Tested)", "P250 | Contamination (Field-Tested)", "P250 | Re.built (Field-Tested)",
        "Five-SeveN | Boost Protocol (Field-Tested)", "Five-SeveN | Fairy Tale (Field-Tested)", "Five-SeveN | Scrawl (Field-Tested)",
        "Five-SeveN | Angry Mob (Field-Tested)", "Five-SeveN | Monkey Business (Field-Tested)", "Five-SeveN | Hot Shot (Field-Tested)",
        "Five-SeveN | Nitro (Field-Tested)", "Five-SeveN | Retrobution (Field-Tested)", "Five-SeveN | Urban Hazard (Field-Tested)",
        "Tec-9 | Ice Cap (Field-Tested)", "Tec-9 | Fubar (Field-Tested)", "Tec-9 | Phoenix (Field-Tested)",
        "Tec-9 | Fuel Injector (Field-Tested)", "Tec-9 | Snek (Field-Tested)", "Tec-9 | Brother (Field-Tested)",
        "Tec-9 | Cutout (Field-Tested)", "Tec-9 | Brutal (Field-Tested)", "Tec-9 | Flash (Field-Tested)",
        "R8 Revolver | Memento (Field-Tested)", "R8 Revolver | Survivalist (Field-Tested)", "R8 Revolver | Junk (Field-Tested)",
        "R8 Revolver | Banana Cannon (Field-Tested)", "R8 Revolver | Crimson Web (Field-Tested)", "R8 Revolver | Crazy 8 (Field-Tested)",
        "R8 Revolver | Bone Mask (Field-Tested)", "R8 Revolver | Amber Slice (Field-Tested)", "R8 Revolver | Icon (Field-Tested)",
        "CZ75-Auto | Distressed (Field-Tested)", "CZ75-Auto | Vendetta (Field-Tested)", "CZ75-Auto | Eco (Field-Tested)",
        "CZ75-Auto | Polymer (Field-Tested)", "CZ75-Auto | Circaetus (Field-Tested)", "CZ75-Auto | Tread (Field-Tested)",
        "CZ75-Auto | Yellow Jacket (Field-Tested)", "CZ75-Auto | Red Star (Field-Tested)", "CZ75-Auto | Hexane (Field-Tested)",
        "SG 553 | Dark Wings (Field-Tested)", "SG 553 | Triarch (Field-Tested)", "SG 553 | Cyrex (Field-Tested)",
        "SG 553 | Hazard Close (Field-Tested)", "SG 553 | Heavy Metal (Field-Tested)", "SG 553 | Demonic (Field-Tested)",
        "SG 553 | Slashed (Field-Tested)", "SG 553 | Anodized Navy (Field-Tested)", "SG 553 | Ultraviolet (Field-Tested)",
        "AUG | Ricochet (Field-Tested)", "AUG | Bengal Tiger (Field-Tested)", "AUG | Mortis (Field-Tested)",
        "AUG | Akihabara Accept (Field-Tested)", "AUG | Pro (Field-Tested)", "AUG | Sycamore (Field-Tested)",
        "AUG | Condemned (Field-Tested)", "AUG | Surveillance (Field-Tested)", "AUG | Radiation Hazard (Field-Tested)",
        "Negev | Loudmouth (Field-Tested)", "Negev | Bratatat (Field-Tested)", "Negev | Terrain (Field-Tested)",
        "Negev | Phoenix Stencil (Field-Tested)", "Negev | Mjolnir (Field-Tested)", "Negev | Lionfish (Field-Tested)",
        "Negev | Power Loader (Field-Tested)", "Negev | dev_texte (Field-Tested)", "Negev | Anodized Navy (Field-Tested)",
        "M249 | O.S.I.P.R. (Field-Tested)", "M249 | Impact Drill (Field-Tested)", "M249 | Emerald Striker (Field-Tested)",
        "M249 | Spectre (Field-Tested)", "M249 | Shipping Forecast (Field-Tested)", "M249 | Submerged (Field-Tested)",
        "M249 | System Lock (Field-Tested)", "M249 | Magma (Field-Tested)", "M249 | Contrast Spray (Field-Tested)",
        "G3SG1 | Green Cell (Field-Tested)", "G3SG1 | Orange Crash (Field-Tested)", "G3SG1 | Highwater (Field-Tested)",
        "G3SG1 | Keeping Tabs (Field-Tested)", "G3SG1 | Scavenger (Field-Tested)", "G3SG1 | Ventilator (Field-Tested)",
        "G3SG1 | Demeter (Field-Tested)", "G3SG1 | Jungle Dashed (Field-Tested)", "G3SG1 | Predator (Field-Tested)",
        "SCAR-20 | Assault (Field-Tested)", "SCAR-20 | Enforcer (Field-Tested)", "SCAR-20 | Poultrygeist (Field-Tested)",
        "SCAR-20 | Red Fog (Field-Tested)", "SCAR-20 | Torn (Field-Tested)", "SCAR-20 | Journeyman (Field-Tested)",
        "SCAR-20 | Cardiac (Field-Tested)", "SCAR-20 | Stone Mosaick (Field-Tested)", "SCAR-20 | Palm (Field-Tested)",
        "MP5-SD | Necro Jr. (Field-Tested)", "MP5-SD | Liquidation (Field-Tested)", "MP5-SD | Acid Wash (Field-Tested)",
        "MP5-SD | Condition Zero (Field-Tested)", "MP5-SD | Phosphor (Field-Tested)", "MP5-SD | Gauss (Field-Tested)",
        "MP5-SD | Autumn Shock (Field-Tested)", "MP5-SD | Dirt Drop (Field-Tested)", "MP5-SD | Dash (Field-Tested)"
    ];

    // Use 4 real Steam economy images for variety
    const fallbackImages = [
        'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiBk3byUf6hOJeWcDziZy-Yj5-1uR3G8lx9zsz3VyY-8JiKFOBhhXJIlEeMJ4RegkdjsNO7s5FKE29VS3y3a2FpNPyRf9A/360fx360f',
        'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbfwiBk3byUf6hOJeWcDziZy-Yj5-1uR3G8lx9zsz3VyY-8JiKFOBhhXJIlEeMJ4RegkdjsNO7s5FKE29VS3y3a2FpNPyRf9A/360fx360f',
        'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fnwiBk3byUf6hOJeWcDziZy-Yj5-1uR3G8lx9zsz3VyY-8JiKFOBhhXJIlEeMJ4RegkdjsNO7s5FKE29VS3y3a2FpNPyRf9A/360fx360f',
        'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2kpnjwiBk3byUf6hOJeWcDziZy-Yj5-1uR3G8lx9zsz3VyY-8JiKFOBhhXJIlEeMJ4RegkdjsNO7s5FKE29VS3y3a2FpNPyRf9A/360fx360f'
    ];

    for (let i = 0; i < SKIN_LIST.length && results.length < 300; i++) {
        const name = SKIN_LIST[i];
        const key = name.replace(/\s+/g, '').toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const price = await fetchPrice(name);
        if (price !== null && price >= 0.1 && price <= 50) {
            const wear = getWear(name);
            const imgUrl = fallbackImages[i % fallbackImages.length];
            results.push({ name, price, imgUrl, floatVal: getFloat(wear) });
            console.log(`  price-check [${results.length}/300] $${price.toFixed(2)} - ${name}`);
        } else {
            console.log(`  no-price ${name}`);
        }

        await sleep(700);
        if (results.length >= 300) break;
    }
}

async function main() {
    console.log('=== Steam Market Bot ===\n');

    // Phase 1: Search by weapon name queries
    console.log('Phase 1: Searching weapon-specific queries...');
    await searchWeaponSkins();

    // Phase 2: Check prices for additional items
    if (results.length < 300) {
        console.log(`\nPhase 2: Checking prices for ${300 - results.length} more items...`);
        await checkPrices();
    }

    console.log(`\nTotal collected: ${results.length} items.`);

    db.serialize(() => {
        db.run('DELETE FROM bot_inventory', (err) => {
            if (err) { console.error('DB error:', err.message); db.close(); return; }
            const stmt = db.prepare('INSERT INTO bot_inventory (item_name, item_value, image_url, float_value) VALUES (?, ?, ?, ?)');
            results.forEach(item => stmt.run(item.name, item.price, item.imgUrl, item.floatVal));
            stmt.finalize();
            console.log(`Inserted ${results.length} items into bot_inventory.`);
            db.close();
        });
    });
}

main().catch(err => { console.error('Fatal:', err); db.close(); });
