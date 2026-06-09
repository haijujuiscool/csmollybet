const https = require('https');

// One representative item per missing weapon to fetch correct economy image
const queries = [
  ['SSG 08', 'SSG 08 | Death Strike (Field-Tested)'],
  ['FAMAS', 'FAMAS | Eye of Hades (Field-Tested)'],
  ['Galil AR', 'Galil AR | Connexion (Field-Tested)'],
  ['MP9', 'MP9 | Rose Iron (Field-Tested)'],
  ['MAC-10', 'MAC-10 | Whitefish (Field-Tested)'],
  ['UMP-45', 'UMP-45 | Exposure (Field-Tested)'],
  ['MP7', 'MP7 | Sun Moon (Field-Tested)'],
  ['PP-Bizon', 'PP-Bizon | Runic (Field-Tested)'],
  ['Nova', 'Nova | Windblown (Field-Tested)'],
  ['MAG-7', 'MAG-7 | Cinquedea (Field-Tested)'],
  ['Five-SeveN', 'Five-SeveN | Capillary (Field-Tested)'],
  ['Tec-9', 'Tec-9 | Ice Cap (Field-Tested)'],
  ['CZ75-Auto', 'CZ75-Auto | Distressed (Field-Tested)'],
  ['R8 Revolver', 'R8 Revolver | Memento (Field-Tested)'],
  ['SG 553', 'SG 553 | Dark Wings (Field-Tested)'],
  ['AUG', 'AUG | Ricochet (Field-Tested)'],
  ['Negev', 'Negev | Loudmouth (Field-Tested)'],
  ['M249', 'M249 | O.S.I.P.R. (Field-Tested)'],
  ['SCAR-20', 'SCAR-20 | Assault (Field-Tested)'],
  ['MP5-SD', 'MP5-SD | Necro Jr. (Field-Tested)'],
  ['Sawed-Off', 'Sawed-Off | Forest DDPAT (Field-Tested)'],
];

let pending = queries.length;

queries.forEach(([weapon, itemName]) => {
  const encoded = encodeURIComponent(itemName);
  const url = `https://steamcommunity.com/market/listings/730/${encoded}`;
  https.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      // Try to find the large market image URL
      const m = data.match(/market_listing_largeimage["']\s*src=["']([^"']+)/);
      if (m) {
        // Remove size suffix if present to get base economy URL
        const img = m[1].replace(/\/\d+x\d+x?\d*$/, '');
        console.log(`'${weapon}': '${img}',`);
      } else {
        console.log(`// ${weapon}: NOT FOUND`);
      }
      pending--;
      if (pending === 0) console.log('// DONE');
    });
  }).on('error', (e) => {
    console.log(`// ${weapon}: ERROR ${e.message}`);
    pending--;
  });
});
