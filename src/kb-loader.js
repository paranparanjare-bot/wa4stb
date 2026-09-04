const fs = require('fs');
const path = require('path');
const { log, DATA_DIR } = require('./utils');

const KB_DIR = path.join(DATA_DIR, 'knowledge');

// ---- Cache berdasar mtime folder KB ----
let cache = { key: null, data: null };

function kbSignature() {
  try {
    const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.txt')).sort();
    return files.map(f => f + ':' + fs.statSync(path.join(KB_DIR, f)).mtimeMs).join('|');
  } catch (e) {
    return '';
  }
}

function emptyData() {
  return {
    raw: '',
    sections: [],
    config: {},
    steps: [],
    faq: [],
    products: [],
    info: [],
  };
}

function parseValue(v) {
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (/^\d+\.\d+$/.test(s)) return parseFloat(s);
  if (s === 'true') return true;
  if (s === 'false') return false;
  return s;
}

function parseList(v) {
  return String(v).split(',').map(x => x.trim()).filter(Boolean);
}

function parseStepLine(body) {
  // "<id>: <question> || <validation> || <saveAs>"
  const idx = body.indexOf(':');
  if (idx === -1) return null;
  const id = body.slice(0, idx).trim();
  const parts = body.slice(idx + 1).split('||').map(p => p.trim());
  return {
    id,
    question: parts[0] || '',
    validation: parts[1] || 'text',
    saveAs: parts[2] || id,
  };
}

function parseKb() {
  const sig = kbSignature();
  if (cache.key === sig && cache.data) return cache.data;

  const data = emptyData();
  let files = [];
  try {
    files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.txt')).sort();
  } catch (e) {
    cache = { key: sig, data };
    return data;
  }

  const raw = files
    .map(f => {
      try { return fs.readFileSync(path.join(KB_DIR, f), 'utf-8'); }
      catch (e) { return ''; }
    })
    .join('\n\n');
  data.raw = raw;

  // Split ke blok per file, lalu pisahkan header section.
  const blocks = raw.split(/\n\s*(?:##+\s*SECTION\s*[:|]\s*)/i);
  // blocks[0] = teks sebelum section pertama (raw bebas)
  const headerless = blocks.shift() || '';
  data.sections.push({ name: '_TOP', body: headerless });
  for (const b of blocks) {
    const nl = b.indexOf('\n');
    const name = (nl === -1 ? b : b.slice(0, nl)).trim().toUpperCase();
    const body = nl === -1 ? '' : b.slice(nl + 1);
    data.sections.push({ name, body });
  }

  // Proses tiap section
  for (const sec of data.sections) {
    const lines = sec.body.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*@([A-Za-z0-9_]+)\s*(?:\s+(\S+))?\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const sub = m[2];
      const val = m[3];
      if (key === 'step') {
        const step = parseStepLine((sub || '') + ':' + val);
        if (step) data.steps.push(step);
      } else if (key === 'product') {
        data.products.push(val.trim());
      } else if (key === 'info') {
        data.info.push(val.trim());
      } else if (key === 'faq') {
        data.faq.push(val.trim());
      } else {
        data.config[key] = val.trim();
      }
    }
  }

  // FAQ tambahan dari format Q:/A: bebas di seluruh raw
  const qaRe = /(?:^|\n)\s*(?:Q|Pertanyaan|Question)\s*[:\-]\s*(.+?)\n\s*(?:A|Jawaban|Answer)\s*[:\-]\s*(.+)/gis;
  let qm;
  while ((qm = qaRe.exec(raw)) !== null) {
    data.faq.push(qm[1].trim() + ' => ' + qm[2].trim());
  }

  // FAQ dari section FAQ (baris "Q: ... A: ...")
  for (const sec of data.sections) {
    if (sec.name !== 'FAQ') continue;
    const entries = sec.body.split(/\n\s*\n+/).filter(Boolean);
    for (const entry of entries) {
      const mm = entry.match(/Q\s*[:\-]\s*(.+?)\s*\n\s*A\s*[:\-]\s*(.+)/is);
      if (mm) data.faq.push(mm[1].trim() + ' => ' + mm[2].trim());
    }
  }

  cache = { key: sig, data };
  return data;
}

function getConfig(key, fallback = null) {
  const v = parseKb().config[key];
  return v === undefined || v === '' ? fallback : v;
}

function getConfigList(key, fallback = []) {
  const v = parseKb().config[key];
  if (v === undefined || v === '') return fallback;
  return parseList(v);
}

function getSteps() {
  return parseKb().steps;
}

function getRaw() {
  return parseKb().raw;
}

function getFaq() {
  return parseKb().faq;
}

function clearCache() {
  cache = { key: null, data: null };
}

module.exports = {
  parseKb,
  getConfig,
  getConfigList,
  getSteps,
  getRaw,
  getFaq,
  clearCache,
  parseValue,
};
