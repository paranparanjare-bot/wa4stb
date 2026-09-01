const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOGS_DIR = path.join(__dirname, '..', 'logs');

function log(level, module, msg, data) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] [${module}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  console.log(line);
  const logFile = path.join(LOGS_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  try {
    fs.appendFileSync(logFile, line + '\n');
  } catch (e) {}
}

function generateId(prefix = 'TX') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

function formatDate(date = new Date()) {
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatCurrency(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

function readKnowledgeBase() {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  if (!fs.existsSync(kbDir)) return '';
  const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.txt'));
  return files.map(f => fs.readFileSync(path.join(kbDir, f), 'utf-8')).join('\n\n');
}

function getKbFiles() {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  if (!fs.existsSync(kbDir)) return [];
  return fs.readdirSync(kbDir).filter(f => f.endsWith('.txt')).sort();
}

// Universal KB search without rigid hardcoded keyword fragments
function findKbAnswer(query) {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  if (!fs.existsSync(kbDir)) return null;
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;

  const genericMenuTriggers = ['menu', 'mulai', 'halo', 'hai', 'hi', 'help', 'bantu', 'siapa kamu', 'cs', 'selamat pagi', 'selamat siang', 'selamat malam'];
  if (genericMenuTriggers.some(token => q === token || q.includes(token))) {
    return null; // Biarkan AI yang menyapa secara natural
  }

  const files = getKbFiles();
  if (files.length === 0) return null;

  // Cari di dalam file FAQ atau teks KB berdasarkan kecocokan pertanyaan
  for (const file of files) {
    const filePath = path.join(kbDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Cek format Q&A
    const entries = content.split(/\n\s*\n+/).filter(Boolean);
    for (const entry of entries) {
      const match = entry.match(/(?:Q|Pertanyaan|Question)\s*[:\-]?\s*(.+?)\s*\n(?:A|Jawaban|Answer)\s*[:\-]?\s*(.+)/is);
      if (!match) continue;
      const question = String(match[1]).trim().toLowerCase();
      const answer = String(match[2]).trim();
      if (q.includes(question) || question.includes(q)) {
        return answer;
      }
    }
  }

  return null;
}

function searchKnowledgeBase(query) {
  const kbText = readKnowledgeBase();
  return kbText ? kbText : null;
}

function buildBusinessMenu() {
  return 'Halo! Ada yang bisa saya bantu terkait produk atau layanan kami?';
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function hasAIConfig() {
  const apiUrl = process.env.AI_API_URL || '';
  const apiKey = process.env.AI_API_KEY || '';
  const model = process.env.AI_MODEL || '';
  return !!(apiUrl && apiKey && model && apiUrl !== 'http://localhost:20128');
}

function getAdminContactPhone() {
  const contact = process.env.BUSINESS_CONTACT || '';
  return contact.replace(/\D/g, '');
}

module.exports = {
  log,
  generateId,
  formatDate,
  formatCurrency,
  readKnowledgeBase,
  searchKnowledgeBase,
  findKbAnswer,
  buildBusinessMenu,
  getKbFiles,
  ensureDir,
  hasAIConfig,
  getAdminContactPhone,
  DATA_DIR,
  LOGS_DIR,
};
