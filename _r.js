const fetch = require('node-fetch');
require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = process.env.TELEGRAM_ADMIN_ID;
fetch(`https://api.telegram.org/bot${token}/getUpdates`)
  .then(r => r.json())
  .then(d => {
    const msgs = d.result || [];
    const relevant = msgs.filter(m => m.message?.chat?.id == adminId);
    if (relevant.length === 0) { console.log('No messages found for admin'); return; }
    const last = relevant[relevant.length - 1];
    console.log('Last message:', JSON.stringify(last.message.text || '(photo)'));
    console.log('Msg count:', relevant.length);
  })
  .catch(e => console.error(e.message));
