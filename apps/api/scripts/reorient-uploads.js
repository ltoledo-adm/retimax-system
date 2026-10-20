/**
 * Endereza fotos ya guardadas solo si todavía traen orientación EXIF.
 * No borra archivos ni toca la base. Si el dato ya se perdió, deja el archivo igual.
 *
 *   UPLOAD_DIR=/data/uploads node scripts/reorient-uploads.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = process.env.UPLOAD_DIR || '/data/uploads';
const dirs = ['images', 'thumbnails'].map((dir) => path.join(root, dir));

async function orientFile(file) {
  const meta = await sharp(file, { failOn: 'none' }).metadata();
  if (!meta.orientation || meta.orientation === 1) {
    return false;
  }

  const output = await sharp(file, { failOn: 'none' }).rotate().webp({ quality: 80 }).toBuffer();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, output);
  fs.renameSync(tmp, file);
  console.log(`enderezada ${file} (orientacion ${meta.orientation})`);
  return true;
}

async function main() {
  let changed = 0;
  let skipped = 0;
  let failed = 0;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/\.(webp|jpe?g|png)$/i.test(name)) continue;
      const file = path.join(dir, name);
      try {
        if (await orientFile(file)) changed += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        console.error(`omitida ${file}: ${error.message}`);
      }
    }
  }

  console.log(JSON.stringify({ changed, skipped, failed }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
