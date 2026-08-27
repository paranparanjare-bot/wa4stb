const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, isJidUser, jidNormalizedUser } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const path = require('path');
const { log, DATA_DIR } = require('./utils');
const { getQRISPath } = require('./media-manager');
const { handleMessage } = require('./message-handler');
const { setWAStatus, sendMsg, sendQRToTelegram } = require('./telegram-handler');

// Fix: Hardcode SESSION_DIR to 'sessions' directly under DATA_DIR, avoiding any conditional bugs
const SESSION_DIR = path.join(DATA_DIR, 'sessions');
let sock = null;

async function startWA() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['WA-STB-Bot', 'Chrome', '4.0'],
    markOnlineOnConnect: true,
    downloadHistory: true, // Diubah ke true agar event sync/history masuk
    syncFullHistory: true, // Diubah ke true agar pesan diterima dengan baik
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      try {
        log('info', 'wa-handler', 'QR Code received, scan with WhatsApp');
        qrcode.generate(qr, { small: true });
        setWAStatus('waiting_qr');
        await sendQRToTelegram(qr);
      } catch (e) {
        log('error', 'wa-handler', 'QR generation/send failed', { error: e.message });
      }
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        log('warn', 'wa-handler', 'Logged out, need re-scan');
        setWAStatus('logged_out');
        sendMsg(process.env.TELEGRAM_ADMIN_ID, 'WhatsApp logged out! Need re-scan QR.');
      } else {
        log('warn', 'wa-handler', `Disconnected (${reason}), reconnecting...`);
        setWAStatus('reconnecting');
        setTimeout(startWA, 3000);
      }
    }
    if (connection === 'open') {
      log('info', 'wa-handler', 'WhatsApp connected!');
      setWAStatus('open');
      sendMsg(process.env.TELEGRAM_ADMIN_ID, 'WhatsApp connected!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      log('info', 'wa-handler', `Pesan masuk diterima`, { 
        remoteJid: msg.key.remoteJid,
        fromMe: msg.key.fromMe,
        body: msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'non-text'
      });

      // Lepas dulu filter isJidUser untuk memastikan apakah JID user terfilter
      if (!msg.key.fromMe) {
        try {
          await handleMessage(sock, msg.key.remoteJid, msg);
          log('info', 'wa-handler', `Pesan berhasil diproses untuk ${msg.key.remoteJid}`);
        } catch (e) {
          log('error', 'wa-handler', 'handleMessage failed', { error: e.message, from: msg.key.remoteJid });
          sendMsg(process.env.TELEGRAM_ADMIN_ID, 'Bot error: ' + e.message);
        }
      }
    }
  });

  return sock;
}

function getSock() { return sock; }

module.exports = { startWA, getSock };
