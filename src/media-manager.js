const fs = require('fs');
const path = require('path');
const { log, ensureDir, DATA_DIR } = require('./utils');

const RECEIPTS_DIR = path.join(DATA_DIR, 'media', 'receipts');
const QRIS_DIR = path.join(DATA_DIR, 'media', 'qris');
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
const AUTO_DELETE = process.env.AUTO_DELETE_RECEIPTS !== 'false';
const DELETE_DELAY = parseInt(process.env.RECEIPT_DELETE_DELAY_MS) || 300000; // 5 min

ensureDir(RECEIPTS_DIR);
ensureDir(QRIS_DIR);

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const BLOCKED_MIMES = ['audio/', 'video/', 'audio/ogg'];

function isAllowedMimeType(mimeType) {
  if (!mimeType) return false;
  if (BLOCKED_MIMES.some(b => mimeType.startsWith(b))) return false;
  return ALLOWED_MIMES.some(a => mimeType === a);
}

function getQRISPath() {
  const files = fs.readdirSync(QRIS_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  return files.length > 0 ? path.join(QRIS_DIR, files[0]) : null;
}

function saveReceipt(filename, buffer) {
  ensureDir(RECEIPTS_DIR);
  const filePath = path.join(RECEIPTS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  log('info', 'media-manager', 'Receipt saved', { filename });
  if (AUTO_DELETE) {
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          log('info', 'media-manager', 'Receipt auto-deleted', { filename });
        }
      } catch (e) {
        log('error', 'media-manager', 'Failed to delete receipt', { error: e.message });
      }
    }, DELETE_DELAY);
  }
  return filePath;
}

function cleanupOldReceipts() {
  try {
    const now = Date.now();
    const files = fs.readdirSync(RECEIPTS_DIR);
    for (const f of files) {
      const fp = path.join(RECEIPTS_DIR, f);
      const stat = fs.statSync(fp);
      if (now - stat.mtimeMs > DELETE_DELAY) {
        fs.unlinkSync(fp);
        log('info', 'media-manager', 'Cleaned old receipt', { file: f });
      }
    }
  } catch (e) {
    log('error', 'media-manager', 'Cleanup error', { error: e.message });
  }
}

module.exports = { isAllowedMimeType, getQRISPath, saveReceipt, cleanupOldReceipts, MAX_FILE_SIZE };
