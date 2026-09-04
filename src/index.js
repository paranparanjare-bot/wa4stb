require('dotenv').config();
const { log, ensureDir } = require('./utils');
const { startWA, getSock } = require('./wa-handler');
const { cleanupOldReceipts } = require('./media-manager');
const { startTelegramBot, setWASockRef, sendMsg } = require('./telegram-handler');
const { startAdminServer } = require('./admin-server');
const { checkExpiredTransactions, expireTransaction } = require('./transaction-manager');

const botOnlyMode = process.argv.includes('--bot-only');

async function main() {
  log('info', 'main', `Starting WA-STB Bot v1.0.0 (${botOnlyMode ? 'bot-only' : 'admin'})`);

  ['data/sessions', 'data/media/qris', 'data/media/receipts', 'data/knowledge', 'logs']
    .forEach(d => ensureDir(require('path').join(__dirname, '..', d)));

  cleanupOldReceipts();
  setInterval(cleanupOldReceipts, 30 * 60 * 1000);

  if (!botOnlyMode) {
    startAdminServer();
    startTelegramBot();
    log('info', 'main', 'Admin mode ready; WhatsApp will start only from Start Bot action.');
    return;
  }

  await startWA();
  setWASockRef(getSock);
  log('info', 'main', 'Bot initialized');

  setInterval(function() {
    const expired = checkExpiredTransactions();
    const sock = getSock();
    const kb = require('./kb-loader');
    const orderTrig = (kb.getConfigList('order_trigger', ['pesan', 'order', 'beli'])[0] || 'PESAN').toUpperCase();
    for (const chatId of expired) {
      const txn = expireTransaction(chatId);
      const notaNum = txn ? txn.data.notaNumber : '';
      if (sock) {
        sock.sendMessage(chatId, { text: 'Pesanan *' + notaNum + '* sudah melewati batas waktu pembayaran dan otomatis hangus.\n\nSilakan ketik *' + orderTrig + '* untuk membuat pesanan baru.' });
      }
      sendMsg(process.env.TELEGRAM_ADMIN_ID, 'Nota *' + notaNum + '* EXPIRED (customer tidak bayar dalam batas waktu)');
    }
  }, 5 * 60 * 1000);

  await sendMsg(process.env.TELEGRAM_ADMIN_ID, 'WA-STB Bot started!');
}

main().catch(err => {
  log('error', 'main', 'Fatal error', { error: err.message, stack: err.stack });
  process.exit(1);
});
