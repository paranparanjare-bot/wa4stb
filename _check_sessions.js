const fs = require('fs');
const path = require('path');

const sessPath = path.join(__dirname, 'data', 'sessions');
const credsPath = path.join(sessPath, 'creds.json');

console.log('Sessions folder exists:', fs.existsSync(sessPath));
console.log('creds.json exists:', fs.existsSync(credsPath));

if (fs.existsSync(credsPath)) {
  try {
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    console.log('creds keys:', Object.keys(creds || {}));
    console.log('Session phone:', creds?.number || 'N/A');
  } catch(e) {
    console.log('Error reading creds:', e.message);
  }
}