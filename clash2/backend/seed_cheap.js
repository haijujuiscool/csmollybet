const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const WEAPON_IMAGES = {
    'P250': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhzMOwwjFU0OGvZqBSLPmUBnPelesn5-RrSXDlwRhx5TjSwtmocCifPwQpDpshReBfsxPrk4DhNu3jshue1dy8VcXxuA',
    'Dual Berettas': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL0kp_0-B1I4M29eKVuJc-eD3WZz-tJvOhuRz39wRx2smzVyIqtJ3OQaARzDschFO5esxm5mtHiM-7l5wCN3ohBxSz63zQJsHg_UethgQ',
    'G3SG1': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2zYXnrB1I_82lYKVmKc-QD2qf_uJ_t-l9AXi3whgm4WjczNageHzCZgRyDcchRu8Ls0W5l922N7jhsgyMjYpAzS7gznQe2xurqq8',
    'SCAR-20': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2zYXnrB1I_82lYKVmKc-QD2qf_uJ_t-l9AXi3whgm4WjczNageHzCZgRyDcchRu8Ls0W5l922N7jhsgyMjYpAzS7gznQe2xurqq8',
    'MP7': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'PP-Bizon': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'Negev': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'M249': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'Nova': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLpk8ewrHZk5-uRa6hiNfSsDWadztF6ueZhW2fgwhghtm3SzN6qcS6fbwV1DpV5QO8P5kTulIW0P7vj4ATbjdlEm3iokGoXuQMfRK1o',
    'XM1014': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLpk8ewrHZk5-uRa6hiNfSsDWadztF6ueZhW2fgwhghtm3SzN6qcS6fbwV1DpV5QO8P5kTulIW0P7vj4ATbjdlEm3iokGoXuQMfRK1o',
    'MAG-7': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLpk8ewrHZk5-uRa6hiNfSsDWadztF6ueZhW2fgwhghtm3SzN6qcS6fbwV1DpV5QO8P5kTulIW0P7vj4ATbjdlEm3iokGoXuQMfRK1o',
    'Five-SeveN': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL0kp_0-B1I4M29eKVuJc-eD3WZz-tJvOhuRz39wRx2smzVyIqtJ3OQaARzDschFO5esxm5mtHiM-7l5wCN3ohBxSz63zQJsHg_UethgQ',
    'Tec-9': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fn8Sdk7vORbqhsLfWAMWuZxuZi_uI_TX6wxxkjsGXXnImsJ37COlUoWcByEOMOtxa5kdXmNu3htVPZjN1bjXKpkHLRfQU',
    'CZ75-Auto': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL0kp_0-B1I4M29eKVuJc-eD3WZz-tJvOhuRz39wRx2smzVyIqtJ3OQaARzDschFO5esxm5mtHiM-7l5wCN3ohBxSz63zQJsHg_UethgQ',
    'R8 Revolver': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL1m5fn8Sdk7vORbqhsLfWAMWuZxuZi_uI_TX6wxxkjsGXXnImsJ37COlUoWcByEOMOtxa5kdXmNu3htVPZjN1bjXKpkHLRfQU',
    'MAC-10': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'UMP-45': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'MP9': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf9TZk_PujeKhoH_OSA2ivzedxuPUnGXHqkE1-4mjdz9eudnuTPQ8gWZpzE-Ve5hOxlNHgY-jj5VPY39gXyjK-0H2RUgwoBA',
    'Sawed-Off': 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLpk8ewrHZk5-uRa6hiNfSsDWadztF6ueZhW2fgwhghtm3SzN6qcS6fbwV1DpV5QO8P5kTulIW0P7vj4ATbjdlEm3iokGoXuQMfRK1o',
};

function getImg(name) {
    const w = name.split(' | ')[0];
    return WEAPON_IMAGES[w] || Object.values(WEAPON_IMAGES)[0];
}

const wearMap = {'(Factory New)': 'FN', '(Minimal Wear)': 'MW', '(Field-Tested)': 'FT', '(Well-Worn)': 'WW', '(Battle-Scarred)': 'BS'};
function getWear(s) { for (const [k, v] of Object.entries(wearMap)) if (s.includes(k)) return v; return null; }
function getFloat(w) { const r = { FN: [0, 0.07], MW: [0.07, 0.15], FT: [0.15, 0.38], WW: [0.38, 0.45], BS: [0.45, 0.8] }; const [min, max] = r[w] || [0.15, 0.38]; return parseFloat((Math.random() * (max - min) + min).toFixed(4)); }

// 100 cheap CS2 skin names (each typically $0.01-$0.50 on Steam)
const cheapItems = [
    "P250 | Sand Dune (Field-Tested)", "P250 | Sand Dune (Well-Worn)", "P250 | Sand Dune (Battle-Scarred)",
    "P250 | Sand Dune (Minimal Wear)", "P250 | Boreal Forest (Field-Tested)", "P250 | Boreal Forest (Well-Worn)",
    "P250 | Boreal Forest (Battle-Scarred)", "P250 | Bone Mask (Field-Tested)", "P250 | Bone Mask (Well-Worn)",
    "P250 | Bone Mask (Battle-Scarred)", "P250 | Gunsmoke (Field-Tested)", "P250 | Gunsmoke (Well-Worn)",
    "P250 | Gunsmoke (Battle-Scarred)", "P250 | Metallic DDPAT (Field-Tested)", "P250 | Metallic DDPAT (Well-Worn)",
    "Dual Berettas | Colony (Field-Tested)", "Dual Berettas | Colony (Well-Worn)", "Dual Berettas | Colony (Battle-Scarred)",
    "Dual Berettas | Contractor (Field-Tested)", "Dual Berettas | Contractor (Well-Worn)", "Dual Berettas | Contractor (Battle-Scarred)",
    "Dual Berettas | Stained (Field-Tested)", "Dual Berettas | Stained (Well-Worn)", "Dual Berettas | Stained (Battle-Scarred)",
    "Dual Berettas | Briar (Field-Tested)", "Dual Berettas | Briar (Battle-Scarred)", "Dual Berettas | Briar (Well-Worn)",
    "G3SG1 | Green Cell (Field-Tested)", "G3SG1 | Green Cell (Well-Worn)", "G3SG1 | Green Cell (Battle-Scarred)",
    "G3SG1 | Orange Kimono (Field-Tested)", "G3SG1 | Orange Kimono (Well-Worn)", "G3SG1 | Orange Kimono (Battle-Scarred)",
    "G3SG1 | Contractor (Field-Tested)", "G3SG1 | Contractor (Well-Worn)", "G3SG1 | Contractor (Battle-Scarred)",
    "G3SG1 | Jungle Dashed (Field-Tested)", "G3SG1 | Jungle Dashed (Well-Worn)", "G3SG1 | Jungle Dashed (Battle-Scarred)",
    "SCAR-20 | Storm (Field-Tested)", "SCAR-20 | Storm (Well-Worn)", "SCAR-20 | Storm (Battle-Scarred)",
    "SCAR-20 | Sand Mesh (Field-Tested)", "SCAR-20 | Sand Mesh (Well-Worn)", "SCAR-20 | Sand Mesh (Battle-Scarred)",
    "SCAR-20 | Palm (Field-Tested)", "SCAR-20 | Palm (Well-Worn)", "SCAR-20 | Palm (Battle-Scarred)",
    "MP7 | Groundwater (Field-Tested)", "MP7 | Groundwater (Well-Worn)", "MP7 | Groundwater (Battle-Scarred)",
    "MP7 | Skulls (Field-Tested)", "MP7 | Skulls (Well-Worn)", "MP7 | Skulls (Battle-Scarred)",
    "MP7 | Forest DDPAT (Field-Tested)", "MP7 | Forest DDPAT (Well-Worn)", "MP7 | Forest DDPAT (Battle-Scarred)",
    "PP-Bizon | Forest Leaves (Field-Tested)", "PP-Bizon | Forest Leaves (Well-Worn)", "PP-Bizon | Forest Leaves (Battle-Scarred)",
    "PP-Bizon | Sand Dashed (Field-Tested)", "PP-Bizon | Sand Dashed (Well-Worn)", "PP-Bizon | Sand Dashed (Battle-Scarred)",
    "PP-Bizon | Irradiated Alert (Field-Tested)", "PP-Bizon | Irradiated Alert (Well-Worn)", "PP-Bizon | Irradiated Alert (Battle-Scarred)",
    "Negev | Army Sheen (Field-Tested)", "Negev | Army Sheen (Well-Worn)", "Negev | Army Sheen (Battle-Scarred)",
    "Negev | Sandstorm (Field-Tested)", "Negev | Sandstorm (Well-Worn)", "Negev | Sandstorm (Battle-Scarred)",
    "Negev | Palm (Field-Tested)", "Negev | Palm (Well-Worn)", "Negev | Palm (Battle-Scarred)",
    "M249 | Contrast Spray (Field-Tested)", "M249 | Contrast Spray (Well-Worn)", "M249 | Contrast Spray (Battle-Scarred)",
    "M249 | Jungle Dashed (Field-Tested)", "M249 | Jungle Dashed (Well-Worn)", "M249 | Jungle Dashed (Battle-Scarred)",
    "M249 | Magma (Field-Tested)", "M249 | Magma (Well-Worn)", "M249 | Magma (Battle-Scarred)",
    "Nova | Walnut (Field-Tested)", "Nova | Walnut (Well-Worn)", "Nova | Walnut (Battle-Scarred)",
    "Nova | Forest Leaves (Field-Tested)", "Nova | Forest Leaves (Well-Worn)", "Nova | Forest Leaves (Battle-Scarred)",
    "Nova | Predator (Field-Tested)", "Nova | Predator (Well-Worn)", "Nova | Predator (Battle-Scarred)",
    "XM1014 | Grassland (Field-Tested)", "XM1014 | Grassland (Well-Worn)", "XM1014 | Grassland (Battle-Scarred)",
    "XM1014 | Jungle (Field-Tested)", "XM1014 | Jungle (Well-Worn)", "XM1014 | Jungle (Battle-Scarred)",
    "MAG-7 | Silver (Field-Tested)", "MAG-7 | Silver (Well-Worn)", "MAG-7 | Silver (Battle-Scarred)",
];

console.log(`Adding ${cheapItems.length} cheap items...`);

let count = 0;
const stmt = db.prepare('INSERT INTO bot_inventory (item_name, item_value, image_url, float_value) VALUES (?, ?, ?, ?)');

cheapItems.forEach(name => {
    const wear = getWear(name);
    const price = parseFloat((Math.random() * 0.49 + 0.01).toFixed(2));
    const imgUrl = getImg(name);
    const floatVal = getFloat(wear);
    stmt.run(name, price, imgUrl, floatVal);
    count++;
});

stmt.finalize(() => {
    console.log(`Inserted ${count} cheap items into bot_inventory!`);
    db.close();
});
