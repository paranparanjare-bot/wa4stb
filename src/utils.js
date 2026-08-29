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

function getKbFiles() {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  if (!fs.existsSync(kbDir)) return [];
  return fs.readdirSync(kbDir).filter(f => f.endsWith('.txt')).sort();
}

function findKbAnswer(query) {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  if (!fs.existsSync(kbDir)) return null;
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;

  const profileFile = path.join(kbDir, 'business-profile.txt');
  const profileText = fs.existsSync(profileFile) ? fs.readFileSync(profileFile, 'utf-8').trim() : '';

  const genericMenuTriggers = ['menu', 'mulai', 'halo', 'hai', 'hi', 'help', 'bantu', 'siapa kamu', 'cs'];
  if (genericMenuTriggers.some(token => q.includes(token))) {
    return profileText ? buildBusinessMenu() : 'Selamat datang. Bot masih dalam mode KB-only, silakan lengkapi profil usaha di admin panel.';
  }
  const numericMenuMap = {
    '1': 'nama usaha',
    '2': 'alamat',
    '3': 'kontak',
    '4': 'produk',
    '5': 'harga',
    '6': 'pengiriman',
    '7': 'pembayaran',
    '8': 'jam operasional',
    '9': 'faq',
  };

  if (numericMenuMap[q]) {
    const targetField = numericMenuMap[q];
    if (profileText) {
      const match = profileText.match(new RegExp(`${targetField.replace(/\s+/g, '\\s*')}[:\\-]?\\s*(.+)`, 'i'));
      if (match) return match[1].trim();
    }
  }

  const fieldMatchers = {
    'nama usaha': ['nama usaha', 'siapa nama usaha', 'siapa usaha', 'nama toko', 'usaha ini'],
    alamat: ['alamat', 'lokasi', 'dimana', 'tempat', 'domisili'],
    produk: ['produk', 'jenis produk', 'barang', 'layanan', 'kategori'],
    harga: ['harga', 'biaya', 'tarif', 'rate', 'paket', 'promo'],
    pengiriman: ['pengiriman', 'ongkir', 'kirim', 'delivery', 'antar'],
    pembayaran: ['pembayaran', 'bayar', 'metode bayar', 'transfer', 'qris', 'cash'],
    kontak: ['kontak', 'wa', 'nomor', 'hubungi', 'whatsapp'],
    'jam operasional': ['jam operasional', 'jam buka', 'operasional', 'buka'],
    faq: ['faq', 'pertanyaan umum', 'tanya', 'pertanyaan'],
  };

  if (profileText) {
    const directField = Object.entries(fieldMatchers).find(([, aliases]) => aliases.some(alias => q.includes(alias)));
    if (directField) {
      const [label, aliases] = directField;
      const match = profileText.match(new RegExp(`${label.replace(/\s+/g, '\\s*')}[:\\-]?\\s*(.+)`, 'i'));
      if (match) return match[1].trim();
      for (const alias of aliases) {
        if (q.includes(alias)) {
          const fallback = profileText.split(/\n+/).find(line => line.toLowerCase().includes(alias.split(' ')[0].slice(0, 3)) || line.toLowerCase().includes(alias.toLowerCase().split(' ')[0]));
          if (fallback) return fallback.split(/[:\-]/).slice(1).join(':').trim();
        }
      }
    }
  }

  const files = getKbFiles();
  if (files.length === 0) return null;

  const exactRules = [
    ['nama usaha', 'nama usaha', 'siapa nama usaha', 'usaha ini'],
    ['alamat', 'lokasi', 'dimana', 'tempat'],
    ['produk', 'jenis produk', 'barang', 'layanan'],
    ['harga', 'biaya', 'tarif', 'rate'],
    ['pengiriman', 'ongkir', 'kirim', 'delivery'],
    ['pembayaran', 'bayar', 'metode bayar', 'transfer'],
    ['kontak', 'wa', 'nomor', 'hubungi'],
    ['jam operasional', 'jam buka', 'operasional'],
    ['faq', 'pertanyaan umum'],
  ];

  for (const file of files) {
    const filePath = path.join(kbDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    const entries = content.split(/\n\s*\n+/).filter(Boolean);
    for (const entry of entries) {
      const match = entry.match(/(?:Q|Pertanyaan|Question)\s*[:\-]?\s*(.+?)\s*\n(?:A|Jawaban|Answer)\s*[:\-]?\s*(.+)/is);
      if (!match) continue;
      const question = String(match[1]).trim().toLowerCase();
      const answer = String(match[2]).trim();
      const score = [question.includes(q), q.includes(question), ...exactRules.filter(([keyword, ...aliases]) => aliases.some(alias => q.includes(alias) && question.includes(alias))).map(() => true)].some(Boolean);
      if (score || question.includes(q) || q.includes(question)) {
        return answer;
      }
    }

    for (const [label, ...aliases] of exactRules) {
      if (aliases.some(alias => q.includes(alias))) {
        const fieldMatch = content.match(new RegExp(`${label}[:\-]?\\s*(.+)`, 'i')) || content.match(new RegExp(`(?:${aliases.join('|')})[:\-]?\\s*(.+)`, 'i'));
        if (fieldMatch) return fieldMatch[1].trim();
      }
    }
  }

  const faqPath = path.join(kbDir, 'custom-faq.txt');
  if (fs.existsSync(faqPath)) {
    const faqText = fs.readFileSync(faqPath, 'utf-8');
    const faqPairs = faqText.split(/\n\s*\n+/).filter(Boolean);
    for (const pair of faqPairs) {
      const match = pair.match(/Q\s*[:\-]?\s*(.+?)\s*\nA\s*[:\-]?\s*(.+)/is);
      if (!match) continue;
      const qText = String(match[1]).trim().toLowerCase();
      const answer = String(match[2]).trim();
      if (q.includes(qText) || qText.includes(q)) return answer;
    }
  }

  return null;
}

function buildBusinessMenu() {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  const profilePath = path.join(kbDir, 'business-profile.txt');
  const profileText = fs.existsSync(profilePath) ? fs.readFileSync(profilePath, 'utf-8').trim() : '';

  const businessName = profileText ? (profileText.match(/nama usaha[:\-]?\s*(.+)/i)?.[1]?.trim() || 'Toko Kami') : 'Toko Kami';
  const hours = profileText ? (profileText.match(/jam operasional[:\-]?\s*(.+)/i)?.[1]?.trim() || 'Senin-Sabtu 08:00-17:00') : 'Senin-Sabtu 08:00-17:00';
  const phone = getAdminContactPhone();
  const adminLink = phone ? `wa.me/${phone}` : '';
  
  const lines = [
    `Selamat datang Kak...`,
    `Saya CS ${businessName} siap membantu, ketik nomor dibawah ini untuk info selanjutnya:`,
    ``,
    `1. Profil Usaha`,
    `2. Alamat`,
    `3. Kontak`,
    `4. Produk / Layanan`,
    `5. Harga`,
    `6. Pengiriman`,
    `7. Pembayaran`,
    `8. Jam Operasional`,
    `9. FAQ / Tanya Jawab`,
  ];

  if (adminLink) {
    lines.push(``);
    lines.push(`Hubungi admin pada jam kerja ${hours} WIB di ${adminLink}`);
  }

  return lines.join('\n');
}

function searchKnowledgeBase(query) {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  if (!fs.existsSync(kbDir)) return null;
  const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.txt'));
  if (files.length === 0) return null;
  return files.map(f => `--- ${f} ---\n` + fs.readFileSync(path.join(kbDir, f), 'utf-8')).join('\n\n');
}

function getAdminContactPhone() {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  const profilePath = path.join(kbDir, 'business-profile.txt');
  if (!fs.existsSync(profilePath)) return '';
  const text = fs.readFileSync(profilePath, 'utf-8');
  const match = text.match(/kontak[:\-]?\s*(.+)/i);
  if (!match) return '';
  let raw = match[1].trim().replace(/\D/g, '');
  if (raw.startsWith('0')) {
    raw = '62' + raw.slice(1);
  } else if (!raw.startsWith('62') && raw.length > 5) {
    raw = '62' + raw;
  }
  return raw;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hasAIConfig() {
  const apiUrl = process.env.AI_API_URL || '';
  const apiKey = process.env.AI_API_KEY || '';
  const model = process.env.AI_MODEL || '';
  return !!(apiUrl && apiKey && model && apiUrl !== 'http://localhost:20128');
}

module.exports = { log, generateId, formatDate, formatCurrency, searchKnowledgeBase, findKbAnswer, buildBusinessMenu, getKbFiles, ensureDir, hasAIConfig, getAdminContactPhone, DATA_DIR, LOGS_DIR };

