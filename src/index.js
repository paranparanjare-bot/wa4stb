require('dotenv').config();
const { log, ensureDir } = require('./utils');
const { startWA, getSock } = require('./wa-handler');
const { cleanupOldReceipts } = require('./media-manager');
const { startTelegramBot, setWASockRef, sendMsg } = require('./telegram-handler');
const { checkExpiredTransactions, expireTransaction } = require('./transaction-manager');

async function main() {
  log('info', 'main', 'Starting WA-STB Bot v1.0.0');

  ['data/sessions', 'data/media/qris', 'data/media/receipts', 'data/knowledge', 'logs']
    .forEach(d => ensureDir(require('path').join(__dirname, '..', d)));

  cleanupOldReceipts();
  setInterval(cleanupOldReceipts, 30 * 60 * 1000);

  // Start Telegram control panel
  startTelegramBot();

  // Start WhatsApp bot
  await startWA();

    // Pass WA socket to telegram handler (for sending messages to customers)
  setWASockRef(getSock);
  log('info', 'main', 'Bot initialized');

  // Periodic deadline check every 5 minutes
  setInterval(function() {
    const expired = checkExpiredTransactions();
    const sock = getSock();
    for (const chatId of expired) {
      const txn = expireTransaction(chatId);
      const notaNum = txn ? txn.data.notaNumber : '';
      if (sock) {
        sock.sendMessage(chatId, { text: 'Pesanan *' + notaNum + '* sudah melewati batas waktu pembayaran (3 jam) dan otomatis hangus.\n\nSilakan ketik *PESAN* untuk membuat pesanan baru.' });
      }
      sendMsg(process.env.TELEGRAM_ADMIN_ID, 'Nota *' + notaNum + '* EXPIRED (customer tidak bayar dalam 3 jam)');
    }
  }, 5 * 60 * 1000);

  await sendMsg(process.env.TELEGRAM_ADMIN_ID, 'WA-STB Bot started!');
}

main().catch(err => {
  log('error', 'main', 'Fatal error', { error: err.message, stack: err.stack });
  process.exit(1);
});
