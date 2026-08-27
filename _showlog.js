const fs = require('fs');
const path = require('path');
const logPath = path.join(__dirname, 'logs', '2026-08-27.log');
const content = fs.readFileSync(logPath, 'utf-8');
const lines = content.trim().split('\n');
console.log('=== Last 20 log lines ===');
lines.slice(-20).forEach(l => console.log(l));