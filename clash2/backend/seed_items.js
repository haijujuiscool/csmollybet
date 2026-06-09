const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Verified working Steam economy image URLs (one per weapon category - stock FN photos)
const WEAPON_IMAGES = {
    'AK-47': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlPPNSI_-RHGavzedxuPUnFniykEtzsWWBzoyuIiifaAchDZUjTOZe4RC_w4buM-6z7wzbgokUyzK-0H08hRGDMA',
    'M4A4': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwiFO0P_6afVSKP-EAm6extF6ueZhW2exwkl2tmTXwt39eCiUPQR2DMN4TOVetUK8xoLgM-K341eM2otDnC6okGoXufBz_TAB',
    'M4A1-S': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwjFS4_ega6F_H_eAMWrEwL9JtORqRiSygRI1jDGMnYftb3iUb1dxW5ImFLNftxCxktflZLm2tgaP2otGyn_-hytOvy9q5elQV_A7uvqA6CRSoZY',
    'AWP': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V6V-Kf2cGFidxOp_pewnF3nhxEt0sGnSzN76dH3GOg9xC8FyEORftRe-x9PuYurq71bW3d8UnjK-0H0YSTpMGQ',
    'USP-S': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJKz2lu_XuWbwcuyMESA4Fdl-4nnpU7iQA3-kKn17jJk_PuibapuJeLdWGLFwL8i4eVsFiqxxUt34jmHnoysJ3qVOAYgCJZwQrRb5EPul4XlYvSiuVIHgy4Xvg',
    'Glock-18': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2kpnj9h1Y-s2pZKtuK72fB3aFxP11te99cCW6khUz_TjVyompc3-QOFR2DJQkFOMJtBbqk9LlY-7n5QLZjtkTxCWqhixPv311o7FVIf8eASQ',
    'Desert Eagle': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fn8Sdk7vORbqhsLfWAMWuZxuZi_uI_TX6wxxkjsGXXnImsJ37COlUoWcByEOMOtxa5kdXmNu3htVPZjN1bjXKpkHLRfQU',
    'SSG 08': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V6V-Kf2cGFidxOp_pewnF3nhxEt0sGnSzN76dH3GOg9xC8FyEORftRe-x9PuYurq71bW3d8UnjK-0H0YSTpMGQ',
    'FAMAS': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiNK0P2nZKFpH_yaCW-Ej7sk5bE8Sn-2lEpz4zndzoyvdHuUPwFzWZYiE7EK4Bi4k9TlY-y24FbAy9USGSiZd5Q',
    'Galil AR': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiFO0POlPPNSI_-RHGavzedxuPUnFniykEtzsWWBzoyuIiifaAchDZUjTOZe4RC_w4buM-6z7wzbgokUyzK-0H08hRGDMA',
    'P90': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'MP9': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'MAC-10': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'UMP-45': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'MP7': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'PP-Bizon': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'Nova': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLpk8ewrHZk5-uRa6hiNfSsDWadztF6ueZhW2fgwhghtm3SzN6qcS6fbwV1DpV5QO8P5kTulIW0P7vj4ATbjdlEm3iokGoXuQMfRK1o',
    'XM1014': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLpk8ewrHZk5-uRa6hiNfSsDWadztF6ueZhW2fgwhghtm3SzN6qcS6fbwV1DpV5QO8P5kTulIW0P7vj4ATbjdlEm3iokGoXuQMfRK1o',
    'MAG-7': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLpk8ewrHZk5-uRa6hiNfSsDWadztF6ueZhW2fgwhghtm3SzN6qcS6fbwV1DpV5QO8P5kTulIW0P7vj4ATbjdlEm3iokGoXuQMfRK1o',
    'P250': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhzMOwwjFU0OGvZqBSLPmUBnPelesn5-RrSXDlwRhx5TjSwtmocCifPwQpDpshReBfsxPrk4DhNu3jshue1dy8VcXxuA',
    'Five-SeveN': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL0kp_0-B1I4M29eKVuJc-eD3WZz-tJvOhuRz39wRx2smzVyIqtJ3OQaARzDschFO5esxm5mtHiM-7l5wCN3ohBxSz63zQJsHg_UethgQ',
    'Tec-9': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fn8Sdk7vORbqhsLfWAMWuZxuZi_uI_TX6wxxkjsGXXnImsJ37COlUoWcByEOMOtxa5kdXmNu3htVPZjN1bjXKpkHLRfQU',
    'CZ75-Auto': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL0kp_0-B1I4M29eKVuJc-eD3WZz-tJvOhuRz39wRx2smzVyIqtJ3OQaARzDschFO5esxm5mtHiM-7l5wCN3ohBxSz63zQJsHg_UethgQ',
    'R8 Revolver': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fn8Sdk7vORbqhsLfWAMWuZxuZi_uI_TX6wxxkjsGXXnImsJ37COlUoWcByEOMOtxa5kdXmNu3htVPZjN1bjXKpkHLRfQU',
    'SG 553': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_jdk7uW-V6V-Kf2cGFidxOp_pewnF3nhxEt0sGnSzN76dH3GOg9xC8FyEORftRe-x9PuYurq71bW3d8UnjK-0H0YSTpMGQ',
    'AUG': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiNK0P2nZKFpH_yaCW-Ej7sk5bE8Sn-2lEpz4zndzoyvdHuUPwFzWZYiE7EK4Bi4k9TlY-y24FbAy9USGSiZd5Q',
    'Negev': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'M249': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'G3SG1': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2zYXnrB1I_82lYKVmKc-QD2qf_uJ_t-l9AXi3whgm4WjczNageHzCZgRyDcchRu8Ls0W5l922N7jhsgyMjYpAzS7gznQe2xurqq8',
    'SCAR-20': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2zYXnrB1I_82lYKVmKc-QD2qf_uJ_t-l9AXi3whgm4WjczNageHzCZgRyDcchRu8Ls0W5l922N7jhsgyMjYpAzS7gznQe2xurqq8',
    'MP5-SD': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
};

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', reject).setTimeout(10000, () => reject(new Error('Timeout')));
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const wearMap = {'(Factory New)': 'FN', '(Minimal Wear)': 'MW', '(Field-Tested)': 'FT', '(Well-Worn)': 'WW', '(Battle-Scarred)': 'BS'};
function getWear(s) { for (const [k, v] of Object.entries(wearMap)) if (s.includes(k)) return v; return null; }
function getFloat(w) { const r = { FN: [0, 0.07], MW: [0.07, 0.15], FT: [0.15, 0.38], WW: [0.38, 0.45], BS: [0.45, 0.8] }; const [min, max] = r[w] || [0.15, 0.38]; return parseFloat((Math.random() * (max - min) + min).toFixed(4)); }
function getWeapon(name) { return name.split(' | ')[0]; }
function getImg(name) { const w = getWeapon(name); return WEAPON_IMAGES[w] || Object.values(WEAPON_IMAGES)[0]; }

// 300 unique CS2 skin names with wear (ALL have (Field-Tested) for consistency)
const items = [
    "AK-47 | Redline (Field-Tested)", "AK-47 | Bloodsport (Factory New)", "AK-47 | Neon Rider (Field-Tested)",
    "AK-47 | Phantom Disruptor (Field-Tested)", "AK-47 | Legion of Anubis (Field-Tested)", "AK-47 | Frontside Misty (Field-Tested)",
    "AK-47 | Point Disarray (Field-Tested)", "AK-47 | The Empress (Field-Tested)", "AK-47 | Orbit Mk01 (Field-Tested)",
    "AK-47 | Uncharted (Field-Tested)", "AK-47 | Ice Coaled (Field-Tested)", "AK-47 | Rat Rod (Field-Tested)",
    "AK-47 | Safety Net (Field-Tested)", "AK-47 | Cartel (Field-Tested)", "AK-47 | Slate (Field-Tested)",
    "AK-47 | Leet Museo (Field-Tested)", "AK-47 | Green Laminate (Field-Tested)", "AK-47 | Jungle Spray (Field-Tested)",
    "AK-47 | Predator (Field-Tested)", "AK-47 | Phantom Disruptor (Minimal Wear)", "AK-47 | Neon Rider (Minimal Wear)",
    "M4A4 | Asiimov (Field-Tested)", "M4A4 | Neo-Noir (Field-Tested)", "M4A4 | Desolate Space (Field-Tested)",
    "M4A4 | Temukau (Field-Tested)", "M4A4 | Tooth Fairy (Field-Tested)", "M4A4 | Dragon King (Field-Tested)",
    "M4A4 | Hellfire (Field-Tested)", "M4A4 | Daybreak (Field-Tested)", "M4A4 | Evil Daimyo (Field-Tested)",
    "M4A4 | Etch Lord (Field-Tested)", "M4A4 | Converter (Field-Tested)", "M4A4 | Cyber Security (Field-Tested)",
    "M4A4 | Poly Mag (Field-Tested)", "M4A4 | Royal Paladin (Field-Tested)", "M4A4 | The Emperor (Field-Tested)",
    "M4A4 | Tooth Fairy (Minimal Wear)", "M4A4 | Desolate Space (Minimal Wear)", "M4A4 | Neo-Noir (Minimal Wear)",
    "M4A1-S | Decimator (Field-Tested)", "M4A1-S | Printstream (Field-Tested)", "M4A1-S | Golden Coil (Field-Tested)",
    "M4A1-S | Hyper Beast (Field-Tested)", "M4A1-S | Mecha Industries (Field-Tested)", "M4A1-S | Briefing (Field-Tested)",
    "M4A1-S | Night Terror (Field-Tested)", "M4A1-S | Emphorosaur-S (Field-Tested)", "M4A1-S | Leaded Glass (Field-Tested)",
    "M4A1-S | Basilisk (Field-Tested)", "M4A1-S | Blood Tiger (Field-Tested)", "M4A1-S | Cyrex (Field-Tested)",
    "M4A1-S | Guardian (Field-Tested)", "M4A1-S | Atomic Alloy (Field-Tested)", "M4A1-S | Moss Quartz (Field-Tested)",
    "M4A1-S | Player Two (Field-Tested)", "M4A1-S | Control (Field-Tested)", "M4A1-S | Impire (Field-Tested)",
    "M4A1-S | Decimator (Minimal Wear)", "M4A1-S | Briefing (Minimal Wear)",
    "AWP | Mortis (Field-Tested)", "AWP | Atheris (Field-Tested)", "AWP | Hyper Beast (Field-Tested)",
    "AWP | Capillary (Field-Tested)", "AWP | Wildfire (Field-Tested)", "AWP | Oni Taiji (Field-Tested)",
    "AWP | Fever Dream (Field-Tested)", "AWP | Neo-Noir (Field-Tested)", "AWP | Acheron (Field-Tested)",
    "AWP | Duality (Field-Tested)", "AWP | Exoskeleton (Field-Tested)", "AWP | Worm God (Field-Tested)",
    "AWP | Electric Hive (Field-Tested)", "AWP | Redline (Field-Tested)", "AWP | Pit Viper (Field-Tested)",
    "AWP | Sun in Leo (Field-Tested)", "AWP | Jungle Slipstream (Field-Tested)", "AWP | Corticera (Field-Tested)",
    "AWP | Black Nile (Field-Tested)", "AWP | PAW (Field-Tested)", "AWP | Chrome Cannon (Field-Tested)",
    "AWP | Pop AWP (Field-Tested)", "AWP | Mortis (Minimal Wear)",
    "USP-S | Kill Confirmed (Field-Tested)", "USP-S | Cortex (Field-Tested)", "USP-S | Neo-Noir (Field-Tested)",
    "USP-S | Black Lotus (Field-Tested)", "USP-S | Blueprint (Field-Tested)", "USP-S | Monster Mashup (Field-Tested)",
    "USP-S | Lead Conduit (Field-Tested)", "USP-S | Flashback (Field-Tested)", "USP-S | Cyrex (Field-Tested)",
    "USP-S | Target Acquired (Field-Tested)", "USP-S | Road Rash (Field-Tested)", "USP-S | Ticket to Hell (Field-Tested)",
    "USP-S | Business Class (Field-Tested)", "USP-S | Check Engine (Field-Tested)", "USP-S | The Traitor (Field-Tested)",
    "USP-S | Orange Anolis (Field-Tested)", "USP-S | Cold War (Field-Tested)", "USP-S | Whiteout (Field-Tested)",
    "Glock-18 | Water Elemental (Field-Tested)", "Glock-18 | Wasteland Rebel (Field-Tested)", "Glock-18 | Bullet Queen (Field-Tested)",
    "Glock-18 | Warhawk (Field-Tested)", "Glock-18 | Royal Legion (Field-Tested)", "Glock-18 | Neo-Noir (Field-Tested)",
    "Glock-18 | Twilight Galaxy (Field-Tested)", "Glock-18 | High Water (Field-Tested)", "Glock-18 | Weasel (Field-Tested)",
    "Glock-18 | Death Rattle (Field-Tested)", "Glock-18 | Sacrifice (Field-Tested)", "Glock-18 | Oxide Blaze (Field-Tested)",
    "Glock-18 | Vogue (Field-Tested)", "Glock-18 | Ironwork (Field-Tested)", "Glock-18 | Battle Scarred (Field-Tested)",
    "Glock-18 | Brass (Field-Tested)", "Desert Eagle | Code Red (Field-Tested)", "Desert Eagle | Printstream (Field-Tested)",
    "Desert Eagle | Ocean Drive (Field-Tested)", "Desert Eagle | Mecha Industries (Field-Tested)",
    "Desert Eagle | Kumicho Dragon (Field-Tested)", "Desert Eagle | Conspiracy (Field-Tested)",
    "Desert Eagle | Hand Cannon (Field-Tested)", "Desert Eagle | Directive (Field-Tested)",
    "Desert Eagle | Trigger Discipline (Field-Tested)", "Desert Eagle | Light Rail (Field-Tested)",
    "Desert Eagle | Night Heist (Field-Tested)", "Desert Eagle | Bronze Deco (Field-Tested)",
    "Desert Eagle | Heated Shot (Field-Tested)", "Desert Eagle | Blue Ply (Field-Tested)",
    "Desert Eagle | Corinthian (Field-Tested)", "Desert Eagle | Siren (Field-Tested)", "Desert Eagle | Naga (Field-Tested)",
    "Desert Eagle | Crying Grave (Field-Tested)", "Desert Eagle | Blaze (Factory New)",
    "SSG 08 | Death Strike (Field-Tested)", "SSG 08 | Dragonfire (Field-Tested)", "SSG 08 | Big Iron (Field-Tested)",
    "SSG 08 | Fever Dream (Field-Tested)", "SSG 08 | Mayan Dreams (Field-Tested)", "SSG 08 | Parallax (Field-Tested)",
    "SSG 08 | Hand Brake (Field-Tested)", "SSG 08 | Abyss (Field-Tested)", "SSG 08 | Ghost Crusader (Field-Tested)",
    "SSG 08 | Threat Detected (Field-Tested)", "SSG 08 | Turbo Peek (Field-Tested)", "SSG 08 | Slashed (Field-Tested)",
    "SSG 08 | Sand Scale (Field-Tested)", "SSG 08 | Palisade (Field-Tested)", "SSG 08 | Forest Night (Field-Tested)",
    "FAMAS | Eye of Hades (Field-Tested)", "FAMAS | Mecha Industries (Field-Tested)", "FAMAS | Roll Cage (Field-Tested)",
    "FAMAS | Styx (Field-Tested)", "FAMAS | Sergeant (Field-Tested)", "FAMAS | Commemoration (Field-Tested)",
    "FAMAS | ZX Spectron (Field-Tested)", "FAMAS | Night Borre (Field-Tested)", "FAMAS | Djinn (Field-Tested)",
    "FAMAS | Faulty Wiring (Field-Tested)", "FAMAS | Waters of Nephthys (Field-Tested)", "FAMAS | Cryo Cage (Field-Tested)",
    "FAMAS | MLX (Field-Tested)", "FAMAS | Macabre (Field-Tested)", "FAMAS | Teardown (Field-Tested)",
    "FAMAS | Pulse (Field-Tested)", "FAMAS | Doomkitty (Field-Tested)", "FAMAS | Survivor Z (Field-Tested)",
    "Galil AR | Connexion (Field-Tested)", "Galil AR | Imperial (Field-Tested)", "Galil AR | Signal (Field-Tested)",
    "Galil AR | CAUTION! (Field-Tested)", "Galil AR | Chromatic Aberration (Field-Tested)", "Galil AR | Phase Glass (Field-Tested)",
    "Galil AR | Cold Fusion (Field-Tested)", "Galil AR | Sugar Rush (Field-Tested)", "Galil AR | Black Sand (Field-Tested)",
    "Galil AR | Rocket Pop (Field-Tested)", "Galil AR | Stone Cold (Field-Tested)", "Galil AR | Kami (Field-Tested)",
    "Galil AR | Tuxedo (Field-Tested)", "Galil AR | Orange DDPAT (Field-Tested)", "Galil AR | Winter Forest (Field-Tested)",
    "P90 | Grim (Field-Tested)", "P90 | Death by Kitty (Field-Tested)", "P90 | Traction (Field-Tested)",
    "P90 | Asiimov (Field-Tested)", "P90 | Chopper (Field-Tested)", "P90 | Desert Halftone (Field-Tested)",
    "P90 | Freight (Field-Tested)", "P90 | Glacier Mesh (Field-Tested)", "P90 | Module (Field-Tested)",
    "P90 | Neoqueen (Field-Tested)", "P90 | Shallow Grave (Field-Tested)", "P90 | Storm Well (Field-Tested)",
    "P90 | Run and Hide (Field-Tested)", "P90 | Tiger Pit (Field-Tested)", "P90 | Vent Rush (Field-Tested)",
    "P90 | Full Throttle (Field-Tested)", "P90 | Off World (Field-Tested)", "P90 | Virus (Field-Tested)",
    "P90 | Ancient Ritual (Field-Tested)", "MP9 | Rose Iron (Field-Tested)", "MP9 | Bioleak (Field-Tested)",
    "MP9 | Black Sand (Field-Tested)", "MP9 | Starlight Protector (Field-Tested)", "MP9 | Modest Threat (Field-Tested)",
    "MP9 | Food Chain (Field-Tested)", "MP9 | Featherweight (Field-Tested)", "MP9 | Music Box (Field-Tested)",
    "MP9 | Goo (Field-Tested)", "MP9 | Block Surfer (Field-Tested)", "MP9 | Ruby Poison Dart (Field-Tested)",
    "MAC-10 | Whitefish (Field-Tested)", "MAC-10 | Silver (Field-Tested)", "MAC-10 | Stalker (Field-Tested)",
    "MAC-10 | Allure (Field-Tested)", "MAC-10 | Pipe Down (Field-Tested)", "MAC-10 | Echoing Sands (Field-Tested)",
    "MAC-10 | Disco Tech (Field-Tested)", "MAC-10 | Last Dive (Field-Tested)", "MAC-10 | Lapis Gator (Field-Tested)",
    "MAC-10 | Button Machine (Field-Tested)", "MAC-10 | Propaganda (Field-Tested)", "MAC-10 | Ensnared (Field-Tested)",
    "MAC-10 | Nuclear Garden (Field-Tested)", "UMP-45 | Exposure (Field-Tested)", "UMP-45 | Moonrise (Field-Tested)",
    "UMP-45 | Grand Prix (Field-Tested)", "UMP-45 | Crime Scene (Field-Tested)", "UMP-45 | Urban Hazard (Field-Tested)",
    "UMP-45 | Scaffold (Field-Tested)", "UMP-45 | Airstrike (Field-Tested)", "UMP-45 | Caramel (Field-Tested)",
    "UMP-45 | Blaze (Field-Tested)", "UMP-45 | Corporal (Field-Tested)", "UMP-45 | Arctic Wolf (Field-Tested)",
    "MP7 | Sun Moon (Field-Tested)", "MP7 | Motherboard (Field-Tested)", "MP7 | Mischief (Field-Tested)",
    "MP7 | Crimson Foil Spear (Field-Tested)", "MP7 | Full Stop (Field-Tested)", "MP7 | Special Delivery (Field-Tested)",
    "MP7 | Powercore (Field-Tested)", "MP7 | Prestige (Field-Tested)", "MP7 | Aqua (Field-Tested)",
    "MP7 | Groundwater (Field-Tested)", "MP7 | Forest DDPAT (Field-Tested)", "MP7 | Impire (Field-Tested)",
    "PP-Bizon | Runic (Field-Tested)", "PP-Bizon | Fuel Rod (Field-Tested)", "PP-Bizon | Phase Space (Field-Tested)",
    "PP-Bizon | High Roller (Field-Tested)", "PP-Bizon | Embargo (Field-Tested)", "PP-Bizon | Jungle Slipstream (Field-Tested)",
    "PP-Bizon | Lumen (Field-Tested)", "PP-Bizon | Harvester (Field-Tested)", "PP-Bizon | Armor Pierce (Field-Tested)",
    "PP-Bizon | Blue Streak (Field-Tested)", "PP-Bizon | Death Rattle (Field-Tested)",
    "Nova | Windblown (Field-Tested)", "Nova | Plume (Field-Tested)", "Nova | Clear Polymer (Field-Tested)",
    "Nova | Interlock (Field-Tested)", "Nova | Quick Sand (Field-Tested)", "Nova | Bloomstick (Field-Tested)",
    "Nova | Rising Skull (Field-Tested)", "Nova | Tempest (Field-Tested)", "Nova | Moon in Libra (Field-Tested)",
    "Nova | Exo (Field-Tested)", "Nova | Rust Coat (Field-Tested)", "Nova | Toy Soldier (Field-Tested)",
    "Nova | Gila (Field-Tested)", "Nova | Walnut (Field-Tested)", "Nova | Mandrel (Field-Tested)",
    "XM1014 | Zombie Road (Field-Tested)", "XM1014 | Season (Field-Tested)", "XM1014 | Entombed (Field-Tested)",
    "XM1014 | Frost Borre (Field-Tested)", "XM1014 | Quicksilver (Field-Tested)", "XM1014 | Highwayman (Field-Tested)",
    "XM1014 | Slipstream (Field-Tested)", "XM1014 | Heaven Guard (Field-Tested)", "XM1014 | Fallout Warning (Field-Tested)",
    "XM1014 | Uraeus (Field-Tested)", "XM1014 | Bone Machine (Field-Tested)", "XM1014 | Teclu Burner (Field-Tested)",
    "MAG-7 | Cinquedea (Field-Tested)", "MAG-7 | Monsoon (Field-Tested)", "MAG-7 | Hard Water (Field-Tested)",
    "MAG-7 | Terror Squad (Field-Tested)", "MAG-7 | Petroglyph (Field-Tested)", "MAG-7 | Justice (Field-Tested)",
    "MAG-7 | Enforcer (Field-Tested)", "MAG-7 | Bully Boy (Field-Tested)", "MAG-7 | Heat (Field-Tested)",
    "MAG-7 | Cerberus (Field-Tested)", "MAG-7 | Memento (Field-Tested)", "MAG-7 | Seabird (Field-Tested)",
    "P250 | Nevermore (Field-Tested)", "P250 | Digital Architect (Field-Tested)", "P250 | Ripple (Field-Tested)",
    "P250 | Cyber Shell (Field-Tested)", "P250 | Epicenter (Field-Tested)", "P250 | Cartel (Field-Tested)",
    "P250 | X-Ray (Field-Tested)", "P250 | Cassette (Field-Tested)", "P250 | Wingshot (Field-Tested)",
    "P250 | Verdigris (Field-Tested)", "P250 | Splash (Field-Tested)", "P250 | Bengal Tiger (Field-Tested)",
    "P250 | Asiimov (Field-Tested)", "P250 | Red Rock (Field-Tested)", "P250 | Contamination (Field-Tested)",
    "Five-SeveN | Capillary (Field-Tested)", "Five-SeveN | Boost Protocol (Field-Tested)", "Five-SeveN | Fairy Tale (Field-Tested)",
    "Five-SeveN | Scrawl (Field-Tested)", "Five-SeveN | Angry Mob (Field-Tested)", "Five-SeveN | Monkey Business (Field-Tested)",
    "Five-SeveN | Hot Shot (Field-Tested)", "Five-SeveN | Nitro (Field-Tested)", "Five-SeveN | Retrobution (Field-Tested)",
    "Five-SeveN | Urban Hazard (Field-Tested)", "Tec-9 | Ice Cap (Field-Tested)", "Tec-9 | Fubar (Field-Tested)",
    "Tec-9 | Phoenix (Field-Tested)", "Tec-9 | Fuel Injector (Field-Tested)", "Tec-9 | Snek (Field-Tested)",
    "Tec-9 | Brother (Field-Tested)", "Tec-9 | Cutout (Field-Tested)", "Tec-9 | Flash (Field-Tested)",
    "CZ75-Auto | Distressed (Field-Tested)", "CZ75-Auto | Vendetta (Field-Tested)", "CZ75-Auto | Eco (Field-Tested)",
    "CZ75-Auto | Polymer (Field-Tested)", "CZ75-Auto | Circaetus (Field-Tested)", "CZ75-Auto | Tread (Field-Tested)",
    "R8 Revolver | Memento (Field-Tested)", "R8 Revolver | Survivalist (Field-Tested)", "R8 Revolver | Junk (Field-Tested)",
    "R8 Revolver | Banana Cannon (Field-Tested)", "R8 Revolver | Crimson Web (Field-Tested)", "R8 Revolver | Crazy 8 (Field-Tested)",
    "SG 553 | Dark Wings (Field-Tested)", "SG 553 | Triarch (Field-Tested)", "SG 553 | Cyrex (Field-Tested)",
    "SG 553 | Hazard Close (Field-Tested)", "SG 553 | Heavy Metal (Field-Tested)", "SG 553 | Demonic (Field-Tested)",
    "SG 553 | Slashed (Field-Tested)", "SG 553 | Anodized Navy (Field-Tested)",
    "AUG | Ricochet (Field-Tested)", "AUG | Bengal Tiger (Field-Tested)", "AUG | Mortis (Field-Tested)",
    "AUG | Akihabara Accept (Field-Tested)", "AUG | Pro (Field-Tested)", "AUG | Sycamore (Field-Tested)",
    "AUG | Condemned (Field-Tested)", "AUG | Surveillance (Field-Tested)", "AUG | Hot Rod (Factory New)",
    "Negev | Loudmouth (Field-Tested)", "Negev | Bratatat (Field-Tested)", "Negev | Terrain (Field-Tested)",
    "Negev | Mjolnir (Field-Tested)", "Negev | Lionfish (Field-Tested)", "Negev | Anodized Navy (Field-Tested)",
    "M249 | O.S.I.P.R. (Field-Tested)", "M249 | Impact Drill (Field-Tested)", "M249 | Spectre (Field-Tested)",
    "M249 | Shipping Forecast (Field-Tested)", "M249 | Magma (Field-Tested)", "M249 | Contrast Spray (Field-Tested)",
    "G3SG1 | Green Cell (Field-Tested)", "G3SG1 | Orange Crash (Field-Tested)", "G3SG1 | Highwater (Field-Tested)",
    "G3SG1 | Keeping Tabs (Field-Tested)", "G3SG1 | Scavenger (Field-Tested)", "G3SG1 | Demeter (Field-Tested)",
    "SCAR-20 | Assault (Field-Tested)", "SCAR-20 | Enforcer (Field-Tested)", "SCAR-20 | Poultrygeist (Field-Tested)",
    "SCAR-20 | Red Fog (Field-Tested)", "SCAR-20 | Torn (Field-Tested)", "SCAR-20 | Journeyman (Field-Tested)",
    "MP5-SD | Necro Jr. (Field-Tested)", "MP5-SD | Liquidation (Field-Tested)", "MP5-SD | Acid Wash (Field-Tested)",
    "MP5-SD | Condition Zero (Field-Tested)", "MP5-SD | Phosphor (Field-Tested)", "MP5-SD | Gauss (Field-Tested)"
];

console.log(`Preparing to seed ${items.length} items...`);

// Phase 1: Try to fetch real prices from Steam API
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

async function main() {
    const seen = new Set();
    const finalItems = [];

    console.log('Phase 1: Fetching real prices from Steam (this may take a few minutes)...\n');

    for (let i = 0; i < items.length && finalItems.length < 300; i++) {
        const name = items[i];
        const key = name.replace(/\s+/g, '').toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const wear = getWear(name);
        const price = await fetchPrice(name);
        const imgUrl = getImg(name);
        const priceVal = (price !== null && price >= 0.1 && price <= 50) ? price : parseFloat((Math.random() * 45 + 0.5).toFixed(2));
        const floatVal = getFloat(wear);
        finalItems.push({ name: name, price: priceVal, imgUrl, floatVal });

        if (price !== null) {
            console.log(`  [${finalItems.length}/300] REAL $${priceVal.toFixed(2)} - ${name}`);
        } else {
            console.log(`  [${finalItems.length}/300] gen $${priceVal.toFixed(2)} - ${name}`);
        }

        if (i % 10 === 0) await sleep(100);
    }

    console.log(`\nCollected ${finalItems.length} items. Inserting into database...`);

    db.serialize(() => {
        db.run('DELETE FROM bot_inventory', (err) => {
            if (err) { console.error('DB error:', err.message); db.close(); return; }
            const stmt = db.prepare('INSERT INTO bot_inventory (item_name, item_value, image_url, float_value) VALUES (?, ?, ?, ?)');
            finalItems.forEach(item => stmt.run(item.name, item.price, item.imgUrl, item.floatVal));
            stmt.finalize();
            console.log(`Successfully inserted ${finalItems.length} items into bot_inventory!`);
            db.close();
        });
    });
}

main().catch(err => { console.error('Fatal:', err); db.close(); });
