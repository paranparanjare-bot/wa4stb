const fs = require('fs');
const path = require('path');
const fetch = global.fetch;
const FormData = require('form-data');
const { log, DATA_DIR, LOGS_DIR, formatCurrency } = require('./utils');
const {
  findTransactionByNota, setTransaction,
  getFinalNotaMessage, getReceiptMessage, resetTransaction, getAllPending,
} = require('./transaction-manager');
const kb = require('./kb-loader');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;
const KB_DIR = path.join(DATA_DIR, 'knowledge');
let offset = 0;
let awaitingKB = null;
let getSockRef = null;
let waStatus = 'disconnected';
let lastQR = null;

function setWAStatus(s) { waStatus = s; }
function getWAStatus() { return waStatus; }
function setWASockRef(fn) { getSockRef = fn; }
function getWASock() { return getSockRef ? getSockRef() : null; }

async function sendMsg(chatId, text, opts = {}) {
  if (!TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...opts }),
    });
  } catch (e) { log('error', 'telegram', 'Send failed', { error: e.message }); }
}

async function sendPhoto(chatId, buffer, opts = {}) {
  if (!TOKEN || !chatId) return;
  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', buffer, { filename: 'qr.png', contentType: 'image/png' });
    if (opts.caption) form.append('caption', opts.caption);
    if (opts.parse_mode) form.append('parse_mode', opts.parse_mode);
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form,
    });
  } catch (e) { log('error', 'telegram', 'Send photo failed', { error: e.message }); }
}

async function sendPhotoMsg(chatId, buffer, caption = '') {
  await sendPhoto(chatId, buffer, { caption: caption, parse_mode: 'Markdown' });
}

async function sendQRToTelegram(qrString) {
  if (!ADMIN_ID) return;
  lastQR = qrString;
  const QRCode = require('qrcode');
  try {
    const buffer = await QRCode.toBuffer(qrString, { width: 300, margin: 2 });
    await sendPhoto(ADMIN_ID, buffer, { caption: '📱 Scan QR code WhatsApp di bawah ya', parse_mode: 'Markdown' });
  } catch (e) { log('error', 'telegram', 'QR send failed', { error: e.message }); }
}

async function handleCommand(chatId, text) {
  if (String(chatId) !== String(ADMIN_ID)) return;

  if (awaitingKB && !text.startsWith('/')) {
    const fp = path.join(KB_DIR, awaitingKB.filename);
    fs.writeFileSync(fp, text, 'utf-8');
    sendMsg(chatId, '✅ Knowledge base *' + awaitingKB.filename + '* berhasil disimpan (' + text.length + ' karakter).');
    awaitingKB = null;
    return;
  }
  awaitingKB = null;

  const lower = text.toLowerCase().trim();

  if (['/start', '/menu', '/help'].includes(lower)) {
    const icon = waStatus === 'open' ? '🟢' : '🔴';
    sendMsg(chatId, icon + ' WA Status: *' + waStatus + '*\n\n*Perintah Kontrol:*\n/startbot — Hidupkan engine WhatsApp & kirim QR\n/stopbot — Matikan koneksi WhatsApp\n/getqr — Ambil ulang QR code\n/status — Cek status sistem\n/restartnode — Restart bot\n/log — Lihat log aktivitas');
    return;
  }

  if (lower === '/restartnode') {
    sendMsg(chatId, '🔄 Merestart proses...');
    const { exec } = require('child_process');
    exec('npx pm2 restart wa-stb || pm2 restart wa-stb');
    return;
  }

  if (['/startbot', '/startwa'].includes(lower)) {
    if (waStatus === 'open') {
      sendMsg(chatId, '🟢 WhatsApp sudah terhubung.');
      return;
    }
    sendMsg(chatId, '⏳ Menginisialisasi WhatsApp... QR code akan dikirim otomatis.');
    const { startWA } = require('./wa-handler');
    try {
      await startWA();
    } catch (e) {
      sendMsg(chatId, '❌ Gagal start WA: ' + e.message);
    }
    return;
  }

  if (['/stopbot', '/stopwa'].includes(lower)) {
    const sock = getWASock();
    if (sock) {
      try { sock.ws.close(); } catch (e) {}
    }
    setWAStatus('disconnected');
    sendMsg(chatId, '🔴 WhatsApp dimatikan.');
    return;
  }

  if (['/qr', '/getqr'].includes(lower)) {
    if (lastQR) { sendQRToTelegram(lastQR); }
    else { sendMsg(chatId, 'QR belum tersedia. Ketik /startbot dulu.'); }
    return;
  }

  if (lower === '/status') {
    const icon = waStatus === 'open' ? '🟢' : '🔴';
    sendMsg(chatId, icon + ' WA: *' + waStatus + '*\nUptime: ' + Math.floor(process.uptime()) + 's');
    return;
  }

  if (lower === '/log' || lower === '/logs') {
    const logFile = path.join(LOGS_DIR, new Date().toISOString().slice(0, 10) + '.log');
    if (!fs.existsSync(logFile)) { sendMsg(chatId, 'Belum ada log hari ini.'); return; }
    const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
    sendMsg(chatId, '*Log (20 terakhir):*\n\n' + lines.slice(-20).join('\n').slice(0, 3000));
    return;
  }

  if (lower === '/stats') {
    const receipts = path.join(DATA_DIR, 'media', 'receipts');
    const count = fs.existsSync(receipts) ? fs.readdirSync(receipts).length : 0;
    sendMsg(chatId, '*Stats:*\nWA: ' + waStatus + '\nReceipts: ' + count + '\nUptime: ' + Math.floor(process.uptime()) + 's\nRAM: ' + Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB');
    return;
  }

  // /ongkir BR0827-001 15000
  let ongkirMatch = text.trim().match(/^\/ongkir([A-Z0-9]{6})\s+(\d+)/i) || text.trim().match(/^\/ongkir\s+([A-Z0-9]{6})\s+(\d+)/i);
  if (ongkirMatch) {
    const notaNum = ongkirMatch[1].toUpperCase();
    const nominal = parseInt(ongkirMatch[2].replace(/\D/g, ''));
    if (isNaN(nominal) || nominal < 0) { sendMsg(chatId, 'Nominal ongkir tidak valid'); return; }
    const found = findTransactionByNota(notaNum);
    if (!found) { sendMsg(chatId, 'Nota *' + notaNum + '* tidak ditemukan.'); return; }
    setTransaction(found.chatId, 'awaiting_payment', { ongkir: String(nominal) });
    sendMsg(chatId, 'Nota *' + notaNum + '*\nOngkir: ' + formatCurrency(nominal) + '\n\nNota final dikirim ke customer.');
    const sock = getWASock();
    if (sock) {
      const notaText = getFinalNotaMessage(found.chatId);
      const qrisPath = path.join(DATA_DIR, 'media', 'qris', 'qris.jpg');
      if (fs.existsSync(qrisPath)) {
        const imgBuffer = fs.readFileSync(qrisPath);
        await sock.sendMessage(found.chatId, { caption: notaText, image: imgBuffer });
      } else {
        await sock.sendMessage(found.chatId, { text: notaText });
      }
    }
    return;
  }

  // /lunas A1B2C3
  if (lower.startsWith('/lunas')) {
    let notaNum = '';
    const match = text.trim().match(/^\/lunas([A-Z0-9]{6})/i);
    if (match) {
      notaNum = match[1].toUpperCase();
    } else {
      const parts = text.trim().split(/\s+/);
      if (parts.length >= 2) notaNum = parts[1].toUpperCase();
    }

    let found = null;
    if (notaNum) {
      found = findTransactionByNota(notaNum);
    } else {
      const all = getAllPending();
      const paying = all.find(p => p.txn.state === 'awaiting_payment');
      if (paying) { found = paying; notaNum = paying.txn.data.notaNumber; }
    }
    if (!found) { sendMsg(chatId, 'Nota tidak ditemukan atau tidak ada order aktif.'); return; }
    setTransaction(found.chatId, 'payment_verified');
    sendMsg(chatId, 'Nota *' + notaNum + '* ditandai LUNAS.');
    const sock2 = getWASock();
    if (sock2) {
      sock2.sendMessage(found.chatId, { text: getReceiptMessage(found.chatId) });
    }
    return;
  }

  if (lower === '/pending') {
    const all = getAllPending();
    if (all.length === 0) { sendMsg(chatId, 'Tidak ada order aktif.'); return; }
    const lines = all.map(p => '• *' + (p.txn.data.notaNumber || '?') + '* — ' + (p.txn.data.name || '?') + ' (' + p.txn.state + ')');
    sendMsg(chatId, '*Order Aktif (' + all.length + '):*\n' + lines.join('\n'));
    return;
  }
}

async function pollUpdates() {
  if (!TOKEN || !ADMIN_ID) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${offset}&timeout=2`);
    const data = await res.json();
    if (data.ok && data.result) {
      for (const u of data.result) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (msg && String(msg.chat.id) === String(ADMIN_ID) && msg.text) {
          await handleCommand(msg.chat.id, msg.text);
        }
      }
    }
  } catch (e) {
    // Sembunyikan error jaringan kecil agar log bersih
  }
}

function startTelegramBot() {
  if (!TOKEN || !ADMIN_ID) { log('warn', 'telegram', 'Telegram bot not configured'); return; }
  log('info', 'telegram', 'Telegram control panel started');
  setInterval(pollUpdates, 3000);
}

module.exports = {
  startTelegramBot,
  setWAStatus,
  getWAStatus,
  getWASock,
  setWASockRef,
  sendMsg,
  sendPhotoMsg,
  sendQRToTelegram,
  getLastQR: () => lastQR,
};
