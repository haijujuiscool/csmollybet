const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, 'public', 'uploads');

// Undo the 180° rotation by rotating another 180° back
const filesToUndo = [
    '1779197131513-956250707.webp',
    '1779197130135-802212085.webp',
    '1779197128074-424227689.webp',
    '1779197120977-86071463.webp',
    '1779197115339-99498169.webp',
    '1779197114997-636275143.webp',
    '1779197114689-599428283.webp',
    '1779197113970-981771122.webp',
    '1779197112924-506636796.webp',
    '1779174567401-IMG_3110.webp',
    '1779174567295-IMG_3108.webp',
    '1779022362942-IMG_0123_12d85acd-2e17-4000-8bf4-05f945628f78.webp',
];

async function undoRotations() {
    let fixed = 0;
    for (const file of filesToUndo) {
        const filepath = path.join(uploadDir, file);
        if (!fs.existsSync(filepath)) {
            console.log(`Skipped (not found): ${file}`);
            continue;
        }
        try {
            const buffer = fs.readFileSync(filepath);
            await sharp(buffer)
                .rotate(180)
                .webp({ quality: 80 })
                .toFile(filepath + '.tmp');
            fs.renameSync(filepath + '.tmp', filepath);
            fixed++;
            console.log(`Undone: ${file}`);
        } catch (err) {
            console.error(`Error with ${file}: ${err.message}`);
        }
    }
    console.log(`\nDone! Reverted ${fixed} images back to original orientation.`);
}

undoRotations();
