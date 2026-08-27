const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOGS_DIR = path.join(__dirname, '..', 'logs');

function log(level, module, msg, data) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] [${module}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  console.log(line);
  const logFile = path.join(LOGS_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(logFile, line + '\n');
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

function searchKnowledgeBase(query) {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  if (!fs.existsSync(kbDir)) return null;
  const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.txt'));
  if (files.length === 0) return null;
  // Return all knowledge base contents so AI always has full context and doesn't hallucinate
  return files.map(f => `--- ${f} ---\n` + fs.readFileSync(path.join(kbDir, f), 'utf-8')).join('\n\n');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = { log, generateId, formatDate, formatCurrency, searchKnowledgeBase, ensureDir, DATA_DIR, LOGS_DIR };
