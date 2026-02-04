/**
 * Generate Firefox-compatible manifest from Chrome manifest
 * Firefox uses Manifest V2 for some features and has different APIs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const firefoxDir = join(__dirname, '..', 'dist-firefox');

// Read Chrome manifest
const chromeManifest = JSON.parse(
  readFileSync(join(distDir, 'manifest.json'), 'utf-8')
);

// Create Firefox manifest (Manifest V3 with Firefox-specific changes)
const firefoxManifest = {
  ...chromeManifest,
  // Firefox uses 'browser_specific_settings' instead of relying on Chrome defaults
  browser_specific_settings: {
    gecko: {
      id: 'moltbot@extension',
      strict_min_version: '109.0'
    }
  },
  // Firefox MV3 uses 'scripts' array for background
  background: {
    scripts: ['background.js'],
    type: 'module'
  }
};

// Remove Chrome-specific fields
delete firefoxManifest.minimum_chrome_version;

// Create Firefox dist directory
if (!existsSync(firefoxDir)) {
  mkdirSync(firefoxDir, { recursive: true });
}

// Copy all files from dist to dist-firefox
const { execSync } = await import('child_process');
execSync(`cp -r ${distDir}/* ${firefoxDir}/`);

// Write Firefox manifest
writeFileSync(
  join(firefoxDir, 'manifest.json'),
  JSON.stringify(firefoxManifest, null, 2)
);

console.log('Firefox extension created in dist-firefox/');
