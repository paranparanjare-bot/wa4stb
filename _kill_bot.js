const { execSync } = require('child_process');
console.log('Killing node processes...');
try { execSync('taskkill /F /IM node.exe 2>nul', { stdio: 'inherit' }); } catch(e) {}
console.log('Done.');