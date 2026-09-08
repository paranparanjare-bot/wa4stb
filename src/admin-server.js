const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { log } = require('./utils');
const { verifyLogin, changePassword } = require('./auth-handler');
const { getWAStatus, getLastQR } = require('./telegram-handler');
const app = express();
const port = Number(process.env.ADMIN_PORT || 3000);
const licenseHubUrl = (process.env.LICENSE_HUB_URL || 'https://auth-portal-sckh.onrender.com').replace(/\/$/, '');
const DATA_DIR = path.join(__dirname, '..', 'data');
const VIEWS_DIR = path.join(__dirname, '..', 'views');
const sessionSecretFile = path.join(DATA_DIR, 'admin-session-secret');
let sessionSecret = process.env.ADMIN_SESSION_SECRET || '';
if (!sessionSecret) {
  try {
    sessionSecret = fs.existsSync(sessionSecretFile) ? fs.readFileSync(sessionSecretFile, 'utf8').trim() : '';
    if (!sessionSecret) {
      sessionSecret = crypto.randomBytes(32).toString('hex');
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(sessionSecretFile, sessionSecret, 'utf8');
    }
  } catch (e) {
    sessionSecret = crypto.randomBytes(32).toString('hex');
  }
}

class FileSessionStore extends session.Store {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.backupPath = filePath + '.bak';
    try {
      if (fs.existsSync(this.filePath) && !fs.existsSync(this.backupPath)) {
        JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        fs.copyFileSync(this.filePath, this.backupPath);
      }
    } catch (e) {}
  }

  readSessions() {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (e) {
      try {
        return fs.existsSync(this.backupPath) ? JSON.parse(fs.readFileSync(this.backupPath, 'utf8')) : {};
      } catch (backupError) {
        return {};
      }
    }
  }

  writeSessions(sessions) {
    const tempPath = this.filePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(sessions), 'utf8');
    fs.renameSync(tempPath, this.filePath);
    fs.copyFileSync(this.filePath, this.backupPath);
  }

  get(sid, callback) {
    const record = this.readSessions()[sid];
    if (!record || (record.cookie?.expires && new Date(record.cookie.expires) <= new Date())) {
      return callback(null, null);
    }
    callback(null, record);
  }

  set(sid, sessionData, callback) {
    const sessions = this.readSessions();
    sessions[sid] = sessionData;
    this.writeSessions(sessions);
    callback?.(null);
  }

  destroy(sid, callback) {
    const sessions = this.readSessions();
    delete sessions[sid];
    this.writeSessions(sessions);
    callback?.(null);
  }

  touch(sid, sessionData, callback) {
    this.set(sid, sessionData, callback);
  }
}

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: sessionSecret, store: new FileSessionStore(path.join(DATA_DIR, 'admin-sessions.json')), resave: false, saveUninitialized: false, rolling: true, cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true } }));

app.use('/admin', (req, res, next) => {
  if (req.path === '/login' || req.path === '/login-submit') return next();
  if (!req.session.isAdmin) {
    if (req.path === '/') return res.redirect('/admin/login');
    if (req.accepts('json')) return res.status(401).json({ message: 'Login dulu' });
    return res.redirect('/admin/login');
  }
  next();
});

function listKbFiles() {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  if (!fs.existsSync(kbDir)) return [];
  return fs.readdirSync(kbDir, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.txt')).map(entry => entry.name).sort();
}

function getKbPath(filename) {
  const safeName = String(filename || '');
  if (path.basename(safeName) !== safeName || !safeName.endsWith('.txt')) return null;
  return path.join(path.resolve(DATA_DIR, 'knowledge'), safeName);
}

function readEnvAI() {
  const envPath = path.join(DATA_DIR, '..', '.env');
  if (!fs.existsSync(envPath)) return { aiUrl: '', apiKey: '', model: '' };
  const content = fs.readFileSync(envPath, 'utf8');
  const get = (key) => {
    const matches = [...content.matchAll(new RegExp('^\\s*' + key + '=(.*)$', 'gm'))];
    return matches.length ? matches[matches.length - 1][1].trim() : '';
  };
  return { aiUrl: get('AI_API_URL'), apiKey: get('AI_API_KEY'), model: get('AI_MODEL') };
}

function readEnvTelegram() {
  const envPath = path.join(DATA_DIR, '..', '.env');
  if (!fs.existsSync(envPath)) return { token: '', adminId: '' };
  const content = fs.readFileSync(envPath, 'utf8');
  const get = (key) => {
    const matches = [...content.matchAll(new RegExp('^\\s*' + key + '=(.*)$', 'gm'))];
    return matches.length ? matches[matches.length - 1][1].trim() : '';
  };
  return { token: get('TELEGRAM_BOT_TOKEN'), adminId: get('TELEGRAM_ADMIN_ID') };
}

function readLicenseState() {
  const f = path.join(DATA_DIR, 'license-state.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch(e) { return null; }
}

function isLicenseActive(lic) {
  return Boolean(lic && lic.key && lic.expires_at && new Date(lic.expires_at) > new Date());
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderAdminHtml(isConnected, qr, ai, tg, lic) {
  const licenseActive = isLicenseActive(lic);
  let licStatus = '<span style="color:#ef4444">Tidak Aktif</span>';
  let licInfo = 'Lisensi belum diaktifkan';
  if (lic) {
    const now = new Date();
    const exp = new Date(lic.expires_at);
    if (now > exp) {
      licStatus = '<span style="color:#ef4444">Expired</span>';
      licInfo = 'Expired: ' + exp.toLocaleDateString('id-ID');
    } else {
      const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      licStatus = '<span style="color:#10b981">Active</span>';
      licInfo = 'Berakhir: ' + exp.toLocaleDateString('id-ID') + ' (Sisa: ' + diff + ' hari)';
    }
  }
  const statusDisplay = isConnected ? 'Connected' : 'Disconnected';
  const rawHtml = fs.readFileSync(path.join(VIEWS_DIR, 'admin.html'), 'utf8');
  return rawHtml
    .replace('STATUS_DISPLAY', statusDisplay)
    .replace('DISABLE_START', isConnected ? 'disabled' : '')
    .replace('DISABLE_STOP', !isConnected ? 'disabled' : '')
    .replace('QR_QRIMG', (fs.existsSync(path.join(__dirname, '..', 'public', 'qr-tmp.png')) ? '<img src="/qr-tmp.png?t=' + Date.now() + '" style="width:250px;max-width:100%;border-radius:8px">' : '<p style="color:#666">QR tidak tersedia. Klik Start Bot dulu.</p>'))
    .replace('TELEGRAM_TOKEN', esc(tg.token))
    .replace('TELEGRAM_ADMIN_ID', esc(tg.adminId))
    .replace('AI_URL', esc(ai.aiUrl))
    .replace('AI_KEY', esc(ai.apiKey))
    .replace('AI_MODEL', esc(ai.model))
    .replace('LIC_STATUS', licStatus)
    .replace('LIC_KEY', lic ? esc(lic.key) : '')
    .replace('LIC_INFO', licInfo)
    .replace('DISABLE_REVOKE_LICENSE', licenseActive ? '' : 'disabled')
    .replace('KB_OPTIONS', listKbFiles().map(f => '<option value="'+esc(f)+'">'+esc(f)+'</option>').join(''));
}

app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.send('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Login Admin</title><style>body{background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.card{background:#1e293b;padding:20px;border-radius:12px;width:90%;max-width:350px}input{width:100%;padding:10px;margin:8px 0;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:6px;box-sizing:border-box}button{width:100%;padding:10px;background:#3b82f6;border:none;border-radius:6px;color:#fff;font-weight:bold;cursor:pointer;margin-top:10px}</style></head><body><div class="card"><h2>Login Admin</h2><form method="POST" action="/admin/login-submit"><input name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button type="submit">Masuk</button></form></div></body></html>');
});

app.post('/admin/login-submit', (req, res) => {
  const { username, password } = req.body;
  if (verifyLogin(username, password)) { req.session.isAdmin = true; req.session.username = username; return res.redirect('/admin'); }
  res.send('Login gagal. <a href="/admin/login">Kembali</a>');
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.get('/admin', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const rawStatus = getWAStatus();
  const isConnected = rawStatus === 'open' || rawStatus === 'connected';
  const qr = getLastQR();
  const ai = readEnvAI();
  const tg = readEnvTelegram();
  const lic = readLicenseState();
  res.send(renderAdminHtml(isConnected, qr, ai, tg, lic));
});

app.get('/admin/kb/get/:filename', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const filepath = getKbPath(req.params.filename);
  if (!filepath) return res.status(400).json({ error: 'Invalid KB filename' });
  res.json({ content: fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf8') : '' });
});

app.post('/admin/auth/change-password', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ message: 'Login dulu' });
  changePassword(req.session.username, req.body.newPassword);
  res.json({ message: 'Password diganti' });
});

app.post('/admin/start', async (req, res) => {
  const { startWA, getSock } = require('./wa-handler');
  const { setWASockRef } = require('./telegram-handler');
  try {
    await startWA();
    setWASockRef(getSock);
  } catch (e) {
    log('error', 'admin', 'Failed to start WhatsApp', { error: e.message });
  }
  res.redirect('/admin');
});
app.post('/admin/stop', async (req, res) => {
  const { stopWA } = require('./wa-handler');
  try {
    await stopWA();
  } catch (e) {
    log('error', 'admin', 'Failed to stop WhatsApp', { error: e.message });
  }
  res.redirect('/admin');
});

// OTP Reset Session
let resetOtpEntry = null;
async function sendOtpToTelegram(otp) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;
  if (!TOKEN || !ADMIN_ID) return { success: false, message: 'Telegram Bot Token dan Admin ID belum dikonfigurasi.' };
  try {
    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_ID, text: `Reset Session OTP: ${otp}\nBerlaku 2 menit.` })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) return { success: false, message: result.description || 'Telegram menolak pengiriman OTP.' };
    return { success: true };
  } catch (e) {
    return { success: false, message: 'Gagal menghubungi Telegram: ' + e.message };
  }
}
app.post('/admin/reset-request-otp', async (req, res) => {
  if (!req.session.isAdmin) return res.json({ success: false, message: 'Unauthorized' });
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const result = await sendOtpToTelegram(otp);
  if (!result.success) return res.status(502).json(result);
  resetOtpEntry = { otp, expires: Date.now() + 120000 };
  res.json({ success: true, message: 'OTP terkirim ke Telegram.' });
});
app.post('/admin/verify-reset-otp', async (req, res) => {
  if (!req.session.isAdmin) return res.json({ success: false, message: 'Unauthorized' });
  const submittedOtp = String(req.body?.otp || '').trim();
  const entry = resetOtpEntry;
  if (!entry || submittedOtp !== entry.otp || Date.now() > entry.expires) {
    if (entry && Date.now() > entry.expires) resetOtpEntry = null;
    return res.json({ success: false, message: 'OTP salah / expired' });
  }
  resetOtpEntry = null;
  const { stopWA } = require('./wa-handler');
  await stopWA();
  const sessDir = path.join(DATA_DIR, 'sessions');
  if (fs.existsSync(sessDir)) { fs.rmSync(sessDir, { recursive: true, force: true }); fs.mkdirSync(sessDir, { recursive: true }); }
  const qrPath = path.join(__dirname, '..', 'public', 'qr-tmp.png');
  if (fs.existsSync(qrPath)) fs.rmSync(qrPath, { force: true });
  res.json({ success: true });
});

app.put('/admin/kb/:filename', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ message: 'Unauthorized' });
  const filepath = getKbPath(req.params.filename);
  if (!filepath) return res.status(400).json({ message: 'Invalid KB filename' });
  fs.writeFileSync(filepath, req.body.content);
  res.json({ message: 'KB saved' });
});

app.post('/admin/config/ai', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ message: 'Unauthorized' });
  const { aiUrl, apiKey, model } = req.body;
  const envPath = path.join(DATA_DIR, '..', '.env');
  let c = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const set = (k, v) => { if (c.match(new RegExp('^' + k + '='))) c = c.replace(new RegExp('^' + k + '=.*$', 'm'), k + '=' + v); else c += '\n' + k + '=' + v; };
  set('AI_API_URL', aiUrl); set('AI_API_KEY', apiKey); set('AI_MODEL', model);
  fs.writeFileSync(envPath, c.trim() + '\n');
  res.json({ message: 'AI Config saved to .env' });
});

app.post('/admin/config/telegram', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ message: 'Unauthorized' });
  const token = String(req.body.token || '').trim();
  const adminId = String(req.body.adminId || '').trim();
  const envPath = path.join(DATA_DIR, '..', '.env');
  let c = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const set = (k, v) => {
    const lines = c.split(/\r?\n/).filter(line => !new RegExp('^\\s*' + k + '=').test(line));
    lines.push(k + '=' + v);
    c = lines.join('\n');
  };
  set('TELEGRAM_BOT_TOKEN', token); set('TELEGRAM_ADMIN_ID', adminId);
  fs.writeFileSync(envPath, c.trim() + '\n');
  process.env.TELEGRAM_BOT_TOKEN = token;
  process.env.TELEGRAM_ADMIN_ID = adminId;
  res.json({ success: true, message: 'Telegram Config saved to .env' });
});

app.post('/admin/auth/activate-license', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { activateLicense } = require('./license-handler');
  const result = await activateLicense(req.body.key);
  res.json(result);
});

app.post('/admin/auth/revoke-license', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    const { revokeLicense } = require('./license-handler');
    const result = await revokeLicense();
    res.status(result.success ? 200 : 502).json(result);
  } catch (e) {
    log('error', 'admin', 'Failed to revoke license', { error: e.message });
    res.status(500).json({ success: false, message: 'Gagal logout lisensi: ' + e.message });
  }
});

app.post('/admin/auth/request-license', async (req, res) => {
    if (!req.session.isAdmin) return res.status(401).json({ success: false, message: 'Unauthorized' });
    try {
        const r = await fetch(licenseHubUrl + '/admin/send-license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetTelegramId: 'AdminDashboard' })
        });
        const d = await r.json();
        res.json(d);
    } catch(e) {
        res.json({ success: false, message: 'Gagal menghubungi License Hub: ' + e.message });
    }
});

function startAdminServer() { app.listen(port, '0.0.0.0', () => log('info', 'admin', 'Running')); }
module.exports = { startAdminServer };