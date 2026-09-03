const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity-ide\\brain\\9ff9a8ca-ce00-4fe3-85c4-0759b5e8e83f\\.user_uploaded\\media_1788436569292.png';

const destPublic1 = path.join(__dirname, 'public', 'forge-india-logo.png');
const destPublic2 = path.join(__dirname, 'public', 'logo.png');
const destAssets = path.join(__dirname, 'src', 'assets', 'logo.png');

try {
  fs.copyFileSync(src, destPublic1);
  fs.copyFileSync(src, destPublic2);
  fs.copyFileSync(src, destAssets);
  console.log('Logo copied successfully to all 3 paths!');
} catch (err) {
  console.error('Error copying logo:', err);
}
