
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// ── Helper: Extract Dominant Luxury Color ──
const getDominantColor = async (buffer) => {
  try {
    const { data, info } = await sharp(buffer)
      .resize(200, 200, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let r = 0, g = 0, b = 0, count = 0;
    const centerX = info.width / 2;
    const centerY = info.height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

    for (let i = 0; i < data.length; i += info.channels) {
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];

      const max = Math.max(pr, pg, pb);
      const min = Math.min(pr, pg, pb);
      const saturation = max === 0 ? 0 : (max - min) / max;
      
      if (saturation < 0.15) continue; 
      if (pr > 240 && pg > 240 && pb > 240) continue; 

      const x = (i / info.channels) % info.width;
      const y = Math.floor((i / info.channels) / info.width);
      const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const distWeight = 1 - (dist / maxDist); 

      const pigmentWeight = saturation * 5; 
      const totalWeight = distWeight * pigmentWeight;

      r += pr * totalWeight;
      g += pg * totalWeight;
      b += pb * totalWeight;
      count += totalWeight;
    }

    if (count === 0) return '#D4AF37'; 

    const avgR = Math.round(r / count);
    const avgG = Math.round(g / count);
    const avgB = Math.round(b / count);

    return `#${((1 << 24) + (avgR << 16) + (avgG << 8) + avgB).toString(16).slice(1).toUpperCase()}`;
  } catch (err) {
    console.error('[COLOR EXTRACTION] Failed:', err);
    return '#D4AF37';
  }
};

const getLuxuryNameFallback = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  if (r > 150 && g < 100 && b < 100) return 'Ruby Desire';
  if (r > 100 && g < 80 && b < 80) return 'Rich Mahogany'; // Added for the lipstick test
  if (r > 200 && g > 150 && b < 150) return 'Coral Muse';
  if (r > 150 && g > 100 && b > 150) return 'Velvet Rose';
  if (r < 100 && g < 100 && b > 150) return 'Royal Blue';
  if (r < 100 && g > 150 && b < 100) return 'Emerald Glow';
  if (r > 100 && g > 100 && b > 100 && r < 180) return 'Mocha Satin';
  if (r > 220 && g > 220 && b > 220) return 'Pure Pearl';
  return 'Luxe Shade';
};

async function test() {
    const images = [
        path.join(root, 'public/images/products/lipstick_main.png'),
        path.join(root, 'public/images/products/nailpolish.png'),
        path.join(root, 'public/images/products/eyeliner.png')
    ];

    console.log('--- TEST: LUXURY COLOR EXTRACTION (CENTER-WEIGHTED) ---');

    for (const imgPath of images) {
        if (!fs.existsSync(imgPath)) continue;
        const buffer = fs.readFileSync(imgPath);
        const hex = await getDominantColor(buffer);
        const name = getLuxuryNameFallback(hex);
        console.log(`File: ${path.basename(imgPath)}`);
        console.log(`  Extracted: ${hex}`);
        console.log(`  Suggested: ${name}`);
        console.log('---------------------------');
    }
}

test();
