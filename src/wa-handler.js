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
let reconnectTimer = null;
let isConnecting = false;

async function startWA() {
  if (isConnecting) return;
  if (sock && sock.ws?.readyState === 1) return;

  isConnecting = true;
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['WA-STB-Bot', 'Chrome', '4.0'],
    markOnlineOnConnect: true,
    downloadHistory: false,
    syncFullHistory: false,
    patchMessageBeforeSending: (msg) => {
      const jstring = JSON.stringify(msg);
      const regex = new RegExp('145441339', 'g');
      msg.message = JSON.parse(jstring.replace(regex, '0'));
      return msg;
    },
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      try {
        log('info', 'wa-handler', 'QR Code received');
        qrcode.generate(qr, { small: true });
        setWAStatus('waiting_qr');
        // Simpan QR sebagai gambar PNG untuk admin panel
        const QRCode = require('qrcode');
        const qrPath = path.join(DATA_DIR, '..', 'public', 'qr-tmp.png');
        await QRCode.toFile(qrPath, qr, { width: 300, margin: 2 });
        log('info', 'wa-handler', 'QR PNG saved');
        await sendQRToTelegram(qr);
      } catch (e) {
        log('error', 'wa-handler', 'QR failed', { error: e.message });
      }
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        isConnecting = false;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        log('warn', 'wa-handler', 'Logged out, need re-scan');
        setWAStatus('logged_out');
        sendMsg(process.env.TELEGRAM_ADMIN_ID, 'WhatsApp logged out! Need re-scan QR.');
        return;
      }

      if (reason === DisconnectReason.connectionReplaced || reason === 440) {
        isConnecting = false;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        sock = null;
        log('warn', 'wa-handler', 'Connection replaced: another WhatsApp session is active. Clear stale session and re-scan QR.');
        setWAStatus('session_conflict');
        sendMsg(process.env.TELEGRAM_ADMIN_ID, 'WhatsApp connection replaced. Another WhatsApp session is active on this number. Close the old session or clear the WA auth folder, then scan the QR again.');
        return;
      }

      log('warn', 'wa-handler', `Disconnected (${reason}), reconnecting...`);
      setWAStatus('reconnecting');
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          isConnecting = false;
          startWA();
        }, 3000);
      }
    }
    if (connection === 'open') {
      isConnecting = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      log('info', 'wa-handler', 'WhatsApp connected!');
      setWAStatus('open');
      sendMsg(process.env.TELEGRAM_ADMIN_ID, 'WhatsApp connected!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg || !msg.key) continue;
      if (msg.key.fromMe) continue;

      log('info', 'wa-handler', `Pesan masuk diterima`, { 
        remoteJid: msg.key.remoteJid,
        fromMe: msg.key.fromMe,
        body: msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'non-text'
      });

      try {
        await handleMessage(sock, msg.key.remoteJid, msg);
        log('info', 'wa-handler', `Pesan berhasil diproses untuk ${msg.key.remoteJid}`);
      } catch (e) {
        log('error', 'wa-handler', 'handleMessage failed', { error: e.message, from: msg.key.remoteJid });
        sendMsg(process.env.TELEGRAM_ADMIN_ID, 'Bot error: ' + e.message);
      }
    }
  });

  return sock;
}

function getSock() { return sock; }

module.exports = { startWA, getSock };
