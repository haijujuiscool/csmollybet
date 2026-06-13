const https = require('https');
const zlib = require('zlib');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Encoding': 'gzip'
            }
        }, (res) => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                if (res.headers['content-encoding'] === 'gzip') {
                    zlib.gunzip(buf, (err, dec) => {
                        if (err) reject(err);
                        else resolve(dec.toString());
                    });
                } else {
                    resolve(buf.toString());
                }
            });
        }).on('error', reject).setTimeout(60000, () => reject(new Error('Timeout')));
    });
}

async function main() {
    console.log('Fetching Buff163 prices...');
    const raw = await httpGet('https://prices.csgotrader.app/latest/buff163.json');
    const buffData = JSON.parse(raw);
    console.log(`Loaded ${Object.keys(buffData).length} items from Buff163\n`);

    const rows = await new Promise((resolve, reject) => {
        db.all('SELECT id, item_name, item_value FROM bot_inventory ORDER BY id', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    console.log(`Found ${rows.length} items in bot_inventory. Matching prices...\n`);

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
        // Normalize name for matching: remove trailing wear abbreviations, trim
        const normalized = row.item_name.trim();

        // Try exact match first, then try with different wear formats
        let price = null;

        // Direct match
        const itemData = buffData[normalized];
        if (itemData) {
            price = itemData.starting_at?.price || itemData.highest_order?.price;
        }

        if (price && price > 0) {
            const oldVal = row.item_value;
            if (Math.abs(price - oldVal) > 0.01) {
                await new Promise((resolve, reject) => {
                    db.run('UPDATE bot_inventory SET item_value = ? WHERE id = ?', [price, row.id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                console.log(`  $${oldVal.toFixed(2)} -> $${price.toFixed(2)}  ${normalized}`);
                updated++;
            } else {
                skipped++;
            }
        } else {
            skipped++;
        }
    }

    console.log(`\nDone! Updated: ${updated}, Skipped (no change or no match): ${skipped}`);
    db.close();
}

main().catch(err => { console.error('Fatal:', err); db.close(); });
