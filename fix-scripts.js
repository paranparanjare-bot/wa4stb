const fs = require('fs');
const p = 'c:\\Vibe Project\\wa-stb\\src\\message-handler.js';
let c = fs.readFileSync(p, 'utf8');

// Fix indentation: the imageMessage block has too many spaces
const oldBlock = `      }
                    if (msg.message?.imageMessage) {
        setTransaction(from, STATES.COMPLETED, { paymentScreenshot: true });
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        try {
          const buffer = await sock.downloadMediaMessage(msg);
          saveReceipt((txn.data.notaNumber || 'receipt') + '-' + Date.now() + '.jpg', buffer);
          // Forward screenshot ke Telegram admin
          if (adminId) {
            const caption = '📸 *Bukti bayar diterima*\\nNota: *' + (txn.data.notaNumber || '-') + '*\\nCustomer: ' + (txn.data.name || '-') + '\\nWA: ' + (txn.data.waNumber || from.replace(/@.*/, '')) + '\\n\\nKetik /lunas ' + (txn.data.notaNumber || '') + ' jika valid';
            await sendPhotoMsg(adminId, buffer, caption);
          }
        } catch (e) { log('error', 'msg-handler', 'Forward screenshot failed', { error: e.message }); }
        await sock.sendMessage(from, { text: 'Bukti pembayaran diterima untuk Nota *' + txn.data.notaNumber + '*\\n\\nAdmin akan memverifikasi. Mohon tunggu konfirmasi.' });
        return;
      }`;

const newBlock = `      }
      if (msg.message?.imageMessage) {
        setTransaction(from, STATES.COMPLETED, { paymentScreenshot: true });
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        try {
          const buffer = await sock.downloadMediaMessage(msg);
          saveReceipt((txn.data.notaNumber || 'receipt') + '-' + Date.now() + '.jpg', buffer);
          // Forward screenshot ke Telegram admin
          if (adminId) {
            const caption = '📸 *Bukti bayar diterima*\\nNota: *' + (txn.data.notaNumber || '-') + '*\\nCustomer: ' + (txn.data.name || '-') + '\\nWA: ' + (txn.data.waNumber || from.replace(/@.*/, '')) + '\\n\\nKetik /lunas ' + (txn.data.notaNumber || '') + ' jika valid';
            await sendPhotoMsg(adminId, buffer, caption);
          }
        } catch (e) { log('error', 'msg-handler', 'Forward screenshot failed', { error: e.message }); }
        await sock.sendMessage(from, { text: 'Bukti pembayaran diterima untuk Nota *' + txn.data.notaNumber + '*\\n\\nAdmin akan memverifikasi. Mohon tunggu konfirmasi.' });
        return;
      }`;

if (c.includes(oldBlock)) {
  c = c.replace(oldBlock, newBlock);
  console.log('Fixed indentation: OK');
} else {
  console.log('Fixed indentation: NOT FOUND');
  // Try to find the pattern
  const idx = c.indexOf('if (msg.message?.imageMessage)');
  console.log('Found at index:', idx);
  if (idx > 0) {
    console.log('Context:', JSON.stringify(c.substring(idx-50, idx+50)));
  }
}

fs.writeFileSync(p, c);
console.log('File saved');

