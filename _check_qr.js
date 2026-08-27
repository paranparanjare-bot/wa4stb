const fetch = require('node-fetch');
require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;

fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=0&limit=100`)
  .then(r => r.json())
  .then(d => {
    console.log('Total updates:', d.result?.length || 0);
    (d.result || []).slice(-10).forEach((u, i) => {
      const m = u.message;
      const t = new Date(m.date * 1000).toISOString();
      const type = m.photo ? 'PHOTO' : m.text ? 'TEXT' : 'OTHER';
      console.log(`${i}: ${t} ${type} ${(m.caption || '').substring(0, 40)}`);
    });
  });