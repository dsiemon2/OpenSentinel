/**
 * Generate simple PNG placeholder icons for the extension
 * These can be replaced with proper designed icons later
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'dist', 'icons');

// Simple PNG generation using pure JavaScript
// Creates a basic colored square with the letter "M"

// PNG signature and basic chunks
function createPNG(size, bgColor, textColor) {
  // For simplicity, we'll create a very basic uncompressed PNG
  // In production, you should use proper design tools

  // Create raw pixel data (RGBA)
  const pixels = new Uint8Array(size * size * 4);

  // Fill with background gradient colors
  const colorStart = hexToRgb(bgColor.start);
  const colorEnd = hexToRgb(bgColor.end);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const t = (x + y) / (size * 2);

      // Interpolate gradient
      pixels[idx] = Math.round(colorStart.r + (colorEnd.r - colorStart.r) * t);
      pixels[idx + 1] = Math.round(colorStart.g + (colorEnd.g - colorStart.g) * t);
      pixels[idx + 2] = Math.round(colorStart.b + (colorEnd.b - colorStart.b) * t);
      pixels[idx + 3] = 255; // Alpha

      // Add "M" letter in the center (simplified)
      const centerX = size / 2;
      const centerY = size / 2;
      const letterSize = size * 0.4;

      if (isInLetter(x, y, centerX, centerY, letterSize, size)) {
        const tc = hexToRgb(textColor);
        pixels[idx] = tc.r;
        pixels[idx + 1] = tc.g;
        pixels[idx + 2] = tc.b;
      }
    }
  }

  return pixels;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Simplified "M" letter detection
function isInLetter(x, y, cx, cy, letterSize, size) {
  // Define M shape relative to center
  const halfW = letterSize * 0.45;
  const halfH = letterSize * 0.5;
  const strokeW = letterSize * 0.15;

  const relX = x - cx;
  const relY = y - cy;

  // Left vertical stroke
  if (relX >= -halfW && relX <= -halfW + strokeW && Math.abs(relY) <= halfH) {
    return true;
  }

  // Right vertical stroke
  if (relX >= halfW - strokeW && relX <= halfW && Math.abs(relY) <= halfH) {
    return true;
  }

  // Left diagonal (top to middle)
  const diagSlope = halfH / (halfW * 0.5);
  if (relY <= -halfH + strokeW + diagSlope * (relX + halfW) &&
      relY >= -halfH + diagSlope * (relX + halfW - strokeW * 0.7) &&
      relX >= -halfW && relX <= 0) {
    return true;
  }

  // Right diagonal (middle to top)
  if (relY <= -halfH + strokeW + diagSlope * (halfW - relX) &&
      relY >= -halfH + diagSlope * (halfW - relX - strokeW * 0.7) &&
      relX >= 0 && relX <= halfW) {
    return true;
  }

  return false;
}

// Since proper PNG encoding is complex, let's create a simpler solution:
// Generate a BMP-like raw format that most tools can use

// For the extension, we'll generate proper PNGs using sharp or canvas if available,
// otherwise fall back to creating placeholder files with instructions

async function generateIcons() {
  const sizes = [16, 48, 128];

  console.log('Generating placeholder icons...');
  console.log('Note: For production, replace these with properly designed icons.');

  // Create icons directory if it doesn't exist
  if (!existsSync(iconsDir)) {
    mkdirSync(iconsDir, { recursive: true });
  }

  // Try to use sharp if available
  try {
    const { default: sharp } = await import('sharp');

    for (const size of sizes) {
      // Create a gradient image with "M" text
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#4fc3f7"/>
              <stop offset="100%" style="stop-color:#7c4dff"/>
            </linearGradient>
          </defs>
          <rect width="${size}" height="${size}" rx="${size * 0.19}" fill="url(#grad)"/>
          <text x="${size/2}" y="${size * 0.69}" font-family="Arial, sans-serif" font-size="${size * 0.56}" font-weight="bold" fill="#0f0f23" text-anchor="middle">M</text>
        </svg>
      `;

      await sharp(Buffer.from(svg))
        .png()
        .toFile(join(iconsDir, `icon${size}.png`));

      console.log(`Created icon${size}.png`);
    }

    console.log('Icons generated successfully!');
  } catch (err) {
    console.log('Sharp not available, creating placeholder instructions...');

    // Create a placeholder text file with instructions
    const placeholder = `
Placeholder Icon Files
======================
PNG icons need to be generated manually.

Required files:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)
- icon128.png (128x128 pixels)

You can generate these from icon.svg using:
1. ImageMagick: convert -background none icon.svg -resize 16x16 icon16.png
2. Inkscape: inkscape icon.svg --export-filename=icon16.png -w 16 -h 16
3. Online converters: Use cloudconvert.com or similar

Or design custom icons using your preferred design tool.
`;

    writeFileSync(join(iconsDir, 'README.txt'), placeholder);

    // Copy the SVG as fallback (some browsers support SVG icons)
    console.log('Created placeholder instructions in dist/icons/README.txt');
    console.log('Please generate PNG icons manually for best compatibility.');
  }
}

generateIcons().catch(console.error);
