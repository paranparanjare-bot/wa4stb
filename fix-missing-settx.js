const fs = require('fs');
const p = 'src/message-handler.js';
let c = fs.readFileSync(p, 'utf8');

// Check if setTransaction is missing
if (!c.includes('setTransaction(from, STATES.COMPLETED, { paymentScreenshot: true });')) {
  console.log('Missing setTransaction - need to add it');
  // Add after "if (msg.message?.imageMessage) {"
  c = c.replace(
    'if (msg.message?.imageMessage) {\n        const adminId',
    'if (msg.message?.imageMessage) {\n        setTransaction(from, STATES.COMPLETED, { paymentScreenshot: true });\n        const adminId'
  );
  fs.writeFileSync(p, c);
  console.log('Fixed');
} else {
  console.log('OK - setTransaction exists');
}