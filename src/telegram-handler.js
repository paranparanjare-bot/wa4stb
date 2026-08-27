const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { log, DATA_DIR, LOGS_DIR, formatCurrency } = require('./utils');
const {
  findTransactionByNota, setTransaction, STATES,
  getFinalNotaMessage, getReceiptMessage, resetTransaction, getAllPending,
} = require('./transaction-manager');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;
const KB_DIR = path.join(DATA_DIR, 'knowledge');
let offset = 0;
let awaitingKB = null;
let getSockRef = null; // getter function for WA sock
let waStatus = 'disconnected';
let lastQR = null; // last QR string for /qr resend

function setWAStatus(s) { waStatus = s; }
function setWASockRef(fn) { getSockRef = fn; }
function getWASock() { return getSockRef ? getSockRef() : null; }

async function sendMsg(chatId, text, opts = {}) {
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...opts }),
    });
  } catch (e) { log('error', 'telegram', 'Send failed', { error: e.message }); }
}

async function sendPhoto(chatId, buffer, opts = {}) {
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

  
// Generate QR PNG from string and send to admin
async function sendQRToTelegram(qrString) {
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
    const fp = path.join(KB_DIR, awaitingKB);
    fs.writeFileSync(fp, text, 'utf-8');
    sendMsg(chatId, '✅ Knowledge base berhasil diperbarui secara total (' + text.length + ' karakter).\n\nData lama telah diganti.');
    awaitingKB = null;
    return;
  }
  awaitingKB = null;

  const lower = text.toLowerCase().trim();

  if (['/start', '/menu', '/help'].includes(lower)) {
    const icon = waStatus === 'open' ? '🟢' : '🔴';
    sendMsg(chatId, icon + ' WA Status: *' + waStatus + '*\n\n*Perintah:*\n/status — Status koneksi WA\n/qr — Dapatkan QR code scan ulang\n/kb — Lihat Knowledge Base\n/kbset — Perbarui Knowledge Base (replace total)\n/logs — Log hari ini\n/stats — Statistik\n\n*Order:*\n/ongkir BR0827-001 15000 — Set ongkir (tanpa spasi: /ongkirBR0827-001 15000)\n/lunas [nota] — Verifikasi bayar\n/pending — Lihat order aktif');
    return;
  }
  if (lower === '/status') {
    const icon = waStatus === 'open' ? '🟢' : '🔴';
    sendMsg(chatId, icon + ' WA: *' + waStatus + '*\nUptime: ' + Math.floor(process.uptime()) + 's');
    return;
  }
  if (lower === '/qr') {
    if (lastQR) { sendQRToTelegram(lastQR); }
    else { sendMsg(chatId, 'QR belum tersedia.'); }
    return;
  }
  if (lower === '/kb') {
    if (!fs.existsSync(KB_DIR)) { sendMsg(chatId, 'Belum ada file KB.'); return; }
    const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.txt'));
    if (files.length === 0) { sendMsg(chatId, 'Belum ada file KB.'); return; }
    const list = files.map(f => f + ' (' + fs.statSync(path.join(KB_DIR, f)).size + ' byte)').join('\n');
    sendMsg(chatId, '*Knowledge Base:*\n' + list + '\n\n/kb_add [nama.txt] untuk tambah');
    return;
  }
  if (lower.startsWith('/kb_add ')) {
    const filename = text.slice(8).trim();
    if (!filename.endsWith('.txt')) { sendMsg(chatId, 'Format: /kb_add nama.txt'); return; }
    awaitingKB = { filename };
    sendMsg(chatId, 'Kirim isi KB *' + filename + '* (pesan berikutnya disimpan)');
    return;
  }
  if (lower.startsWith('/kb_del ')) {
    const filename = text.slice(8).trim();
    const fp = path.join(KB_DIR, filename);
    if (!fs.existsSync(fp)) { sendMsg(chatId, 'File "' + filename + '" tidak ditemukan.'); return; }
    fs.unlinkSync(fp);
    sendMsg(chatId, 'File "' + filename + '" dihapus.');
    return;
  }
  if (lower === '/logs') {
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
  // /ongkirBR0827-001 15000 (tanpa spasi) atau /ongkir BR0827-001 15000
  let ongkirMatch = text.trim().match(/^\/ongkir([A-Z0-9]{6})\s+(\d+)/i) || text.trim().match(/^\/ongkir\s+([A-Z0-9]{6})\s+(\d+)/i);
  if (ongkirMatch) {
    const notaNum = ongkirMatch[1].toUpperCase();
    const nominal = parseInt(ongkirMatch[2].replace(/\D/g, ''));
    if (isNaN(nominal) || nominal < 0) { sendMsg(chatId, 'Nominal ongkir tidak valid'); return; }
    const found = findTransactionByNota(notaNum);
    if (!found) { sendMsg(chatId, 'Nota *' + notaNum + '* tidak ditemukan.'); return; }
    setTransaction(found.chatId, STATES.AWAITING_PAYMENT, { ongkir: String(nominal) });
    sendMsg(chatId, 'Nota *' + notaNum + '*\nOngkir: ' + formatCurrency(nominal) + '\n\nNota final dikirim ke customer.');
    // Send final nota ke customer via WA + QRIS image
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
  // Legacy: /ongkir BR0827-001 15000 (dengan spasi)
  if (lower.startsWith('/ongkir ')) {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 3) { sendMsg(chatId, 'Format: /ongkir BR0827-001 15000 atau /ongkirBR0827-001 15000\nContoh: /ongkirBR0827-001 15000'); return; }
    const notaNum = parts[1];
    const nominal = parseInt(parts[2].replace(/\D/g, ''));
    if (isNaN(nominal) || nominal < 0) { sendMsg(chatId, 'Nominal ongkir tidak valid'); return; }
    const found = findTransactionByNota(notaNum);
    if (!found) { sendMsg(chatId, 'Nota *' + notaNum + '* tidak ditemukan.'); return; }
    setTransaction(found.chatId, STATES.AWAITING_PAYMENT, { ongkir: String(nominal) });
    sendMsg(chatId, 'Nota *' + notaNum + '*\nOngkir: ' + formatCurrency(nominal) + '\n\nNota final dikirim ke customer.');
    const sock2 = getWASock();
    if (sock2) {
      const notaText = getFinalNotaMessage(found.chatId);
      const qrisPath = path.join(DATA_DIR, 'media', 'qris', 'qris.jpg');
      if (fs.existsSync(qrisPath)) {
        const imgBuffer = fs.readFileSync(qrisPath);
        await sock2.sendMessage(found.chatId, { caption: notaText, image: imgBuffer });
      } else {
        await sock2.sendMessage(found.chatId, { text: notaText });
      }
    }
    return;
  }
  // /lunasA1B2C3 atau /lunas A1B2C3
  if (lower.startsWith('/lunas')) {
    const parts = text.trim().split(/\s+/);
    let notaNum = '';
    
    const match = text.trim().match(/^\/lunas([A-Z0-9]{6})/i);
    if (match) {
      notaNum = match[1].toUpperCase();
    } else if (parts.length >= 2) {
      notaNum = parts[1].toUpperCase();
    } else {
      notaNum = text.trim().replace('/lunas', '').toUpperCase();
    }

    let found = null;
    if (notaNum) {
      found = findTransactionByNota(notaNum);
    } else {
      const all = getAllPending();
      const paying = all.find(p => p.txn.state === STATES.AWAITING_PAYMENT);
      if (paying) { found = paying; notaNum = paying.txn.data.notaNumber; }
    }
    if (!found) { sendMsg(chatId, 'Tidak ada order aktif untuk dilunasi atau nota tidak ditemukan.\nKetik /pending untuk melihat order aktif.'); return; }
    setTransaction(found.chatId, STATES.PAYMENT_VERIFIED);
    sendMsg(chatId, 'Nota *' + notaNum + '* ditandai LUNAS.\nNotifikasi dikirim ke customer.');
    const sock2 = getWASock();
    if (sock2) {
      sock2.sendMessage(found.chatId, { text: getReceiptMessage(found.chatId) });
    }
    return;
  }
  // /pending
  if (lower === '/pending') {
    const all = getAllPending();
    if (all.length === 0) { sendMsg(chatId, 'Tidak ada order aktif.'); return; }
    const lines = all.map(function(p) {
      const d = p.txn.data;
      return '• *' + (d.notaNumber || '?') + '* — ' + (d.name || '?') + ' (' + p.txn.state + ')';
    });
    sendMsg(chatId, '*Order Aktif (' + all.length + '):*\n' + lines.join('\n'));
    return;
  }
}

async function pollUpdates() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('https://api.telegram.org/bot' + TOKEN + '/getUpdates?offset=' + offset + '&timeout=2', {
      signal: controller.signal
    });
    clearTimeout(timeout);
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
    if (e.name !== 'AbortError') {
      log('error', 'telegram', 'Poll error', { error: e.message });
    }
  }
}

function startTelegramBot() {
  if (!TOKEN || !ADMIN_ID) { log('warn', 'telegram', 'Telegram bot not configured'); return; }
  log('info', 'telegram', 'Telegram control panel started');
  setInterval(pollUpdates, 3000);
}

module.exports = { startTelegramBot, setWAStatus, setWASockRef, sendMsg, sendPhotoMsg, sendQRToTelegram };
