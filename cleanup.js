const fs = require('fs');
const files = ['check-sessions.js', 'find-json.js', 'list-data.js', 'test-syntax.js', 'fresh_start.bat'];
files.forEach(f => {
  try {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      console.log('Deleted:', f);
    }
  } catch(e) {}
});