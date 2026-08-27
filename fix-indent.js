const fs = require('fs');
const p = 'src/message-handler.js';
let c = fs.readFileSync(p, 'utf8');
const lines = c.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (msg.message?.imageMessage) {')) {
    const m = lines[i].match(/^(\s*)/);
    if (m && m[1].length > 6) {
      lines[i] = '      ' + lines[i].trim();
      console.log('Fixed line ' + (i + 1));
    }
  }
}

c = lines.join('\n');
fs.writeFileSync(p, c);
console.log('Done');
