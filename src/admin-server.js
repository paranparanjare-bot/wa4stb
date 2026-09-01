const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const { log } = require('./utils');
const { verifyLogin, changePassword } = require('./auth-handler');
const { getWAStatus, getLastQR } = require('./telegram-handler');
const app = express();
const port = Number(process.env.ADMIN_PORT || 3000);
const sessionSecret = process.env.ADMIN_SESSION_SECRET || 'wa-stb-admin-secret';
const DATA_DIR = path.join(__dirname, '..', 'data');
const VIEWS_DIR = path.join(__dirname, '..', 'views');

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: sessionSecret, resave: false, saveUninitialized: false, cookie: { maxAge: 7200000, httpOnly: true } }));

function listKbFiles() {
  const kbDir = path.join(DATA_DIR, 'knowledge');
  if (!fs.existsSync(kbDir)) return [];
  return fs.readdirSync(kbDir).filter(f => f.endsWith('.txt')).sort();
}

function readEnvAI() {
  const envPath = path.join(DATA_DIR, '..', '.env');
  if (!fs.existsSync(envPath)) return { aiUrl: '', apiKey: '', model: '' };
  const content = fs.readFileSync(envPath, 'utf8');
  const get = (key) => { const m = content.match(new RegExp('^' + key + '=(.*)', 'm')); return m ? m[1] : ''; };
  return { aiUrl: get('AI_API_URL'), apiKey: get('AI_API_KEY'), model: get('AI_MODEL') };
}

function readLicenseState() {
  const f = path.join(DATA_DIR, 'license-state.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch(e) { return null; }
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderAdminHtml(isConnected, qr, ai, lic) {
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
    .replace('AI_URL', esc(ai.aiUrl))
    .replace('AI_KEY', esc(ai.apiKey))
    .replace('AI_MODEL', esc(ai.model))
    .replace('LIC_STATUS', licStatus)
    .replace('LIC_KEY', lic ? esc(lic.key) : '')
    .replace('LIC_INFO', licInfo)
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

app.get('/admin', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  const rawStatus = getWAStatus();
  const isConnected = rawStatus === 'open' || rawStatus === 'connected';
  const qr = getLastQR();
  const ai = readEnvAI();
  const lic = readLicenseState();
  res.send(renderAdminHtml(isConnected, qr, ai, lic));
});

app.get('/admin/kb/get/:filename', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ error: 'Unauthorized' });
  const filepath = path.join(DATA_DIR, 'knowledge', req.params.filename);
  res.json({ content: fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf8') : '' });
});

app.post('/admin/auth/change-password', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ message: 'Login dulu' });
  changePassword(req.session.username, req.body.newPassword);
  res.json({ message: 'Password diganti' });
});

app.post('/admin/start', (req, res) => { const { startWA } = require('./wa-handler'); startWA(); res.redirect('/admin'); });
app.post('/admin/stop', (req, res) => { const { getSock } = require('./wa-handler'); if(getSock()){try{getSock().ws.close()}catch(e){}} res.redirect('/admin'); });

// OTP Reset Session
const OTP_STORE = {};
async function sendOtpToTelegram(otp) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;
  if (!TOKEN || !ADMIN_ID) return;
  try { await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: ADMIN_ID, text: `Reset Session OTP: ${otp}\nBerlaku 2 menit.` }) }); } catch(e) {}
}
app.post('/admin/reset-request-otp', async (req, res) => {
  if (!req.session.isAdmin) return res.json({ success: false, message: 'Unauthorized' });
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  OTP_STORE[otp] = { expires: Date.now() + 120000 };
  await sendOtpToTelegram(otp);
  res.json({ success: true });
});
app.post('/admin/verify-reset-otp', (req, res) => {
  if (!req.session.isAdmin) return res.json({ success: false, message: 'Unauthorized' });
  const entry = OTP_STORE[req.body.otp];
  if (!entry || Date.now() > entry.expires) { delete OTP_STORE[req.body.otp]; return res.json({ success: false, message: 'OTP salah / expired' }); }
  delete OTP_STORE[req.body.otp];
  const sessDir = path.join(DATA_DIR, 'sessions');
  if (fs.existsSync(sessDir)) { fs.rmSync(sessDir, { recursive: true, force: true }); fs.mkdirSync(sessDir, { recursive: true }); }
  res.json({ success: true });
});

app.put('/admin/kb/:filename', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ message: 'Unauthorized' });
  const filepath = path.join(DATA_DIR, 'knowledge', req.params.filename);
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

app.post('/admin/auth/activate-license', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { activateLicense } = require('./license-handler');
  const result = await activateLicense(req.body.key);
  res.json(result);
});

app.post('/admin/auth/revoke-license', async (req, res) => {
  if (!req.session.isAdmin) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { revokeLicense } = require('./license-handler');
  const result = await revokeLicense();
  res.json(result);
});

function startAdminServer() { app.listen(port, '0.0.0.0', () => log('info', 'admin', 'Running')); }
module.exports = { startAdminServer };