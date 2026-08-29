const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { log, DATA_DIR, LOGS_DIR } = require('./utils');
const { parseEnvFile, writeEnvConfig } = require('./config-store');
const { getWAStatus, getLastQR, sendQRToTelegram } = require('./telegram-handler');
const { activateLicense, getLicenseStatus } = require('./license-manager');

const app = express();
const port = Number(process.env.ADMIN_PORT || 3000);
const sessionSecret = process.env.ADMIN_SESSION_SECRET || 'wa-stb-admin-secret';
const OTP_TTL_MS = 5 * 60 * 1000;
const QR_COOLDOWN_MS = 90 * 1000;
const ROOT_DIR = path.join(__dirname, '..');
const SETUP_STATE_PATH = path.join(DATA_DIR, 'admin-state.json');
const otpStore = new Map();
const waResetOtpStore = new Map();
const runtimeState = { running: false, pid: null, command: '', child: null };

function readSetupState() {
  try {
    if (!fs.existsSync(SETUP_STATE_PATH)) return { setupComplete: false, onboardingComplete: false };
    const parsed = JSON.parse(fs.readFileSync(SETUP_STATE_PATH, 'utf-8'));
    return { setupComplete: !!parsed.setupComplete, onboardingComplete: !!parsed.onboardingComplete };
  } catch (e) {
    return { setupComplete: false, onboardingComplete: false };
  }
}

function writeSetupState(payload = { setupComplete: true, onboardingComplete: false }) {
  fs.writeFileSync(SETUP_STATE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  return payload;
}

function isOnboardingComplete() {
  const state = readSetupState();
  return !!state.onboardingComplete;
}

function getKbDir() {
  return path.join(DATA_DIR, 'knowledge');
}

function ensureKbDir() {
  const dir = getKbDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listKbFiles() {
  ensureKbDir();
  return fs.readdirSync(getKbDir()).filter(f => f.endsWith('.txt')).sort();
}

function readCurrentEnv() {
  return parseEnvFile();
}

function isSetupComplete() {
  const env = readCurrentEnv();
  const state = readSetupState();
  return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_ID && state.setupComplete);
}

function getConfigForWeb() {
  const env = readCurrentEnv();
  return {
    AI_API_URL: env.AI_API_URL || '',
    AI_API_KEY: env.AI_API_KEY || '',
    AI_MODEL: env.AI_MODEL || '',
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_ADMIN_ID: env.TELEGRAM_ADMIN_ID || '',
  };
}

function sanitizeText(value) {
  return String(value ?? '').trim();
}

function readBusinessProfileField(label) {
  const filePath = path.join(ensureKbDir(), 'business-profile.txt');
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(new RegExp(`${label}[:\-]?\\s*(.+)`, 'i'));
  return match ? match[1].trim() : '';
}

function readBusinessFaq() {
  const filePath = path.join(ensureKbDir(), 'custom-faq.txt');
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function generateOtpForTelegram(userId) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(String(userId), { code, createdAt: Date.now() });
  return code;
}

async function sendTelegramOtp(chatId, otp) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🔐 Admin OTP login\n\nKode verifikasi Anda: *${otp}*\n\nKode ini berlaku 5 menit.`,
        parse_mode: 'Markdown',
      }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch (e) {
    log('error', 'admin-server', 'Send OTP telegram failed', { error: e.message });
    return false;
  }
}

function getBotRuntimeInfo() {
  return {
    running: runtimeState.running,
    pid: runtimeState.pid,
    command: runtimeState.command,
  };
}

function startBotProcess() {
  if (runtimeState.running) {
    return { ok: false, message: 'Bot WhatsApp sudah aktif.' };
  }
  try {
    const { startWA } = require('./wa-handler');
    startWA();
    runtimeState.running = true;
    return { ok: true, message: 'WhatsApp started' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function stopBotProcess() {
  try {
    const { getSock } = require('./wa-handler');
    const sock = getSock();
    if (sock) { sock.ws.close(); }
    runtimeState.running = false;
    return { ok: true, message: 'WhatsApp stopped' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function getQrCooldownRemaining(req) {
  const lastAt = Number(req.session.lastQrAt || 0);
  if (!lastAt) return 0;
  const remaining = QR_COOLDOWN_MS - (Date.now() - lastAt);
  return Math.max(0, remaining);
}

function clearWASessionFiles() {
  const sessionDir = path.join(DATA_DIR, 'sessions');
  if (!fs.existsSync(sessionDir)) return;
  for (const file of fs.readdirSync(sessionDir)) {
    const filePath = path.join(sessionDir, file);
    if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
  }
}

function renderRegisterPage(message = '') {
  const errorHtml = message ? `<div class="message error">${message}</div>` : '';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Register Admin</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .card { width: min(460px, 92vw); background: #111827; border: 1px solid #334155; border-radius: 16px; padding: 28px; box-shadow: 0 12px 32px rgba(0,0,0,.28); }
      h2 { margin: 0 0 12px; }
      label { display: block; margin-top: 14px; font-weight: bold; }
      input, button { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px; border: 1px solid #475569; background: #020817; color: #f8fafc; }
      button { background: #2563eb; border: none; cursor: pointer; font-weight: bold; margin-top: 18px; }
      .message { margin-top: 14px; padding: 10px 12px; border-radius: 10px; font-size: 14px; }
      .error { background: rgba(220,38,38,.15); color: #fecaca; border: 1px solid rgba(248,113,113,.4); }
      .muted { margin-top: 12px; color: #cbd5e1; font-size: 13px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Registrasi Admin</h2>
      <form method="POST" action="/admin/register">
        <label>Token Bot Telegram</label>
        <input name="telegramToken" placeholder="contoh: 863...:AA..." required />

        <label>User ID Telegram</label>
        <input name="userId" placeholder="contoh: 788284460" required />

        <button type="submit">Simpan & lanjutkan ke OTP Login</button>
      </form>
      ${errorHtml}
      <div class="muted">Setelah registrasi, admin login cukup klik "Generate OTP" dan verifikasi di Telegram.</div>
    </div>
  </body>
</html>`;
}

function renderLoginPage(req, message = '') {
  const env = readCurrentEnv();
  const userId = sanitizeText(req?.session?.telegramUserId || env.TELEGRAM_ADMIN_ID || '');
  const msgHtml = message ? `<div class="message error">${message}</div>` : '';
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Login</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .card { width: min(430px, 92vw); background: #111827; border: 1px solid #334155; border-radius: 16px; padding: 26px; box-shadow: 0 12px 32px rgba(0,0,0,.28); }
      h2 { margin: 0 0 12px; }
      label { display: block; margin-top: 12px; font-weight: bold; }
      input, button { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px; border: 1px solid #475569; background: #020817; color: #f8fafc; }
      button { background: #2563eb; border: none; cursor: pointer; font-weight: bold; }
      .message { margin-top: 14px; padding: 10px 12px; border-radius: 10px; font-size: 14px; }
      .error { background: rgba(220,38,38,.15); color: #fecaca; border: 1px solid rgba(248,113,113,.4); }
      .success { background: rgba(34,197,94,.15); color: #bbf7d0; border: 1px solid rgba(74,222,128,.4); }
      .muted { font-size: 13px; color: #cbd5e1; margin-top: 12px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Login Admin</h2>
      <div id="otp-step">
        <label>Telegram User ID</label>
        <input id="userId" value="${userId}" placeholder="Contoh: 788284460" />
        <button id="requestOtpBtn" type="button">Generate OTP</button>
      </div>
      <div id="verify-step" style="display:none; margin-top: 18px;">
        <label>OTP Telegram</label>
        <input id="otpCode" placeholder="Masukkan kode 6 digit" maxlength="6" />
        <button id="verifyBtn" type="button">Verifikasi</button>
      </div>
      ${msgHtml}
      <div class="muted">OTP dikirim ke Telegram admin yang sudah tersimpan.</div>
    </div>

    <script>
      const userIdInput = document.getElementById('userId');
      const otpInput = document.getElementById('otpCode');
      const requestOtpBtn = document.getElementById('requestOtpBtn');
      const verifyBtn = document.getElementById('verifyBtn');
      const verifyStep = document.getElementById('verify-step');

      requestOtpBtn.addEventListener('click', async () => {
        const userId = userIdInput.value.trim();
        if (!userId) { alert('User ID Telegram wajib diisi'); return; }
        requestOtpBtn.disabled = true; requestOtpBtn.textContent = 'Mengirim...';
        const res = await fetch('/admin/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        const data = await res.json();
        requestOtpBtn.disabled = false; requestOtpBtn.textContent = 'Generate OTP';
        if (!res.ok) { alert(data.message || 'Gagal mengirim OTP'); return; }
        verifyStep.style.display = 'block';
        otpInput.focus();
      });

      verifyBtn.addEventListener('click', async () => {
        const userId = userIdInput.value.trim();
        const otpCode = otpInput.value.trim();
        if (!userId || !otpCode) { alert('User ID dan OTP wajib diisi'); return; }
        verifyBtn.disabled = true; verifyBtn.textContent = 'Memverifikasi...';
        const res = await fetch('/admin/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, code: otpCode })
        });
        const data = await res.json();
        verifyBtn.disabled = false; verifyBtn.textContent = 'Verifikasi';
        if (!res.ok) { alert(data.message || 'OTP tidak valid'); return; }
        window.location.href = '/admin';
      });
    </script>
  </body>
</html>`;
}

function renderSetupWizard(step = 1, message = '') {
  const msgHtml = message ? `<div class="message error">${message}</div>` : '';
  const baseStyle = `
    body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }
    .wizard { max-width: 600px; margin: 0 auto; }
    .card { background: #111827; border: 1px solid #334155; border-radius: 16px; padding: 28px; margin-bottom: 20px; }
    .progress { display: flex; gap: 8px; margin-bottom: 24px; }
    .progress-step { flex: 1; height: 8px; border-radius: 4px; background: #334155; }
    .progress-step.active { background: #2563eb; }
    .progress-step.completed { background: #22c55e; }
    h2 { margin: 0 0 4px; font-size: 24px; }
    .subtitle { color: #cbd5e1; margin-bottom: 20px; font-size: 14px; }
    label { display: block; margin-top: 16px; font-weight: bold; font-size: 14px; }
    input, textarea, select { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px; border: 1px solid #475569; background: #020817; color: #f8fafc; margin-top: 6px; font-family: inherit; }
    textarea { min-height: 100px; resize: vertical; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .btn-group { display: flex; gap: 10px; margin-top: 24px; }
    .btn { flex: 1; padding: 12px 16px; border-radius: 10px; border: none; cursor: pointer; font-weight: bold; font-size: 14px; }
    .btn-primary { background: #2563eb; color: #f8fafc; }
    .btn-secondary { background: #334155; color: #f8fafc; }
    .message { margin-bottom: 16px; padding: 12px 14px; border-radius: 10px; font-size: 13px; background: rgba(220,38,38,.15); color: #fecaca; border: 1px solid rgba(248,113,113,.4); }
    .faq-item { background: #020817; border: 1px solid #334155; border-radius: 10px; padding: 14px; margin-top: 10px; }
    .faq-item label { margin-top: 8px; }
    .faq-item input { font-size: 12px; }
    .btn-remove { background: #991b1b; color: #f8fafc; padding: 8px 12px; font-size: 12px; margin-top: 8px; }
    .muted { color: #cbd5e1; font-size: 12px; margin-top: 6px; }
  `;

  if (step === 1) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Setup Wizard - Business Info</title>
    <style>${baseStyle}</style>
  </head>
  <body>
    <div class="wizard">
      <div class="progress">
        <div class="progress-step active"></div>
        <div class="progress-step"></div>
        <div class="progress-step"></div>
        <div class="progress-step"></div>
      </div>
      <div class="card">
        <h2>📋 Info Bisnis</h2>
        <div class="subtitle">Langkah 1 dari 4 - Isi data dasar usaha Anda</div>
        ${msgHtml}
        <form method="POST" action="/admin/setup/step1">
          <label>Nama Usaha / Bisnis *</label>
          <input name="business_name" placeholder="Contoh: Toko Bumbu Betutu" required />
          <div class="muted">Nama bisnis akan ditampilkan sebagai pembuka menu bot</div>
          
          <label>Alamat Lengkap *</label>
          <input name="business_address" placeholder="Contoh: Jl. Raya No. 123" required />
          
          <div class="row">
            <div>
              <label>Nomor WhatsApp *</label>
              <input name="business_contact" type="tel" placeholder="Contoh: 08123456789" required />
            </div>
            <div>
              <label>Jam Operasional *</label>
              <input name="business_hours" placeholder="Contoh: 08:00 - 17:00" required />
            </div>
          </div>
          
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">Lanjut &rarr;</button>
          </div>
        </form>
      </div>
    </div>
  </body>
</html>`;
  }

  if (step === 2) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Setup Wizard - Products & Services</title>
    <style>${baseStyle}</style>
  </head>
  <body>
    <div class="wizard">
      <div class="progress">
        <div class="progress-step completed"></div>
        <div class="progress-step active"></div>
        <div class="progress-step"></div>
        <div class="progress-step"></div>
      </div>
      <div class="card">
        <h2>🛍️ Produk & Layanan</h2>
        <div class="subtitle">Langkah 2 dari 4 - Jelaskan produk / layanan Anda</div>
        ${msgHtml}
        <form method="POST" action="/admin/setup/step2">
          <label>Jenis Produk / Layanan *</label>
          <input name="business_products" placeholder="Contoh: Bumbu Masak, Spice Mix" required />
          <div class="muted">Deskripsi singkat tentang apa yang Anda jual</div>
          
          <label>Rentang Harga *</label>
          <input name="business_price" placeholder="Contoh: Rp 20.000 - 50.000 per paket" required />
          
          <label>Area Pengiriman / Jangkauan *</label>
          <input name="business_delivery" placeholder="Contoh: Seluruh Banyuwangi, Area Kabupaten" required />
          <div class="muted">Tuliskan area mana saja yang Anda layani</div>
          
          <div class="btn-group">
            <button type="button" class="btn btn-secondary" onclick="history.back()">&larr; Kembali</button>
            <button type="submit" class="btn btn-primary">Lanjut &rarr;</button>
          </div>
        </form>
      </div>
    </div>
  </body>
</html>`;
  }

  if (step === 3) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Setup Wizard - Payment Methods</title>
    <style>${baseStyle}</style>
  </head>
  <body>
    <div class="wizard">
      <div class="progress">
        <div class="progress-step completed"></div>
        <div class="progress-step completed"></div>
        <div class="progress-step active"></div>
        <div class="progress-step"></div>
      </div>
      <div class="card">
        <h2>💳 Metode Pembayaran</h2>
        <div class="subtitle">Langkah 3 dari 4 - Bagaimana customer bisa bayar?</div>
        ${msgHtml}
        <form method="POST" action="/admin/setup/step3">
          <label>
            <input type="checkbox" name="payment_transfer" value="on" checked /> Transfer Bank
          </label>
          
          <label>
            <input type="checkbox" name="payment_qris" value="on" /> QRIS
          </label>
          
          <label>
            <input type="checkbox" name="payment_cash" value="on" checked /> Cash / Tunai
          </label>
          
          <label>
            <input type="checkbox" name="payment_gopay" value="on" /> GoPay / OVO / Dana
          </label>
          
          <label>Catatan Pembayaran (opsional)</label>
          <textarea name="payment_notes" placeholder="Contoh: Pembayaran harus lunas sebelum barang dikirim."></textarea>
          
          <div class="btn-group">
            <button type="button" class="btn btn-secondary" onclick="history.back()">&larr; Kembali</button>
            <button type="submit" class="btn btn-primary">Lanjut &rarr;</button>
          </div>
        </form>
      </div>
    </div>
  </body>
</html>`;
  }

  if (step === 4) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Setup Wizard - FAQ Builder</title>
    <style>${baseStyle}</style>
  </head>
  <body>
    <div class="wizard">
      <div class="progress">
        <div class="progress-step completed"></div>
        <div class="progress-step completed"></div>
        <div class="progress-step completed"></div>
        <div class="progress-step active"></div>
      </div>
      <div class="card">
        <h2>❓ Pertanyaan Umum (FAQ)</h2>
        <div class="subtitle">Langkah 4 dari 4 - Tambahkan pertanyaan yang sering ditanya</div>
        <div class="muted">Bot akan menjawab otomatis dari FAQ yang Anda buat. Minimalkan pertanyaan berulang!</div>
        ${msgHtml}
        <form id="faqForm" method="POST" action="/admin/setup/complete">
          <div id="faqContainer"></div>
          
          <button type="button" class="btn btn-secondary" onclick="addFaqItem()" style="margin-top: 16px;">+ Tambah Pertanyaan</button>
          
          <div class="btn-group" style="margin-top: 24px;">
            <button type="button" class="btn btn-secondary" onclick="history.back()">&larr; Kembali</button>
            <button type="submit" class="btn btn-primary">✅ Selesaikan Setup</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      const defaultFaqs = [
        { q: 'Apakah ada diskon untuk pembelian dalam jumlah banyak?', a: 'Untuk pembelian grosir, mohon hubungi via WhatsApp untuk penawaran khusus.' },
        { q: 'Berapa lama proses pengiriman?', a: 'Pengiriman biasanya 1-3 hari kerja tergantung lokasi.' },
        { q: 'Apakah produk bisa direturn?', a: 'Ya, return dapat dilakukan dalam kondisi barang masih bagus dan dalam 3 hari penerimaan.' },
      ];

      function addFaqItem(question = '', answer = '') {
        const container = document.getElementById('faqContainer');
        const id = Date.now();
        const html = \`
          <div class="faq-item" data-id="\${id}">
            <label>Pertanyaan</label>
            <input type="text" name="faq_q_\${id}" value="\${question}" placeholder="Contoh: Apa itu produk Anda?" />
            <label>Jawaban</label>
            <textarea name="faq_a_\${id}" placeholder="Contoh: Produk kami adalah...">\${answer}</textarea>
            <button type="button" class="btn btn-remove" onclick="removeFaqItem(\${id})">🗑️ Hapus</button>
          </div>
        \`;
        container.insertAdjacentHTML('beforeend', html);
      }

      function removeFaqItem(id) {
        const item = document.querySelector(\`[data-id="\${id}"]\`);
        if (item) item.remove();
      }

      // Initialize with default FAQs
      defaultFaqs.forEach(f => addFaqItem(f.q, f.a));
    </script>
  </body>
</html>`;
  }

  return `<!doctype html><html><body>Unknown step</body></html>`;
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 30 * 60 * 1000 },
}));

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

app.get('/admin/register', (req, res) => {
  if (isSetupComplete()) {
    return res.redirect('/admin/login');
  }
  return res.send(renderRegisterPage());
});

app.post('/admin/register', (req, res) => {
  const token = sanitizeText(req.body.telegramToken || '');
  const userId = sanitizeText(req.body.userId || '');

  if (!token || !userId) {
    return res.status(400).send(renderRegisterPage('Token bot Telegram dan User ID wajib diisi.'));
  }

  writeEnvConfig({ TELEGRAM_BOT_TOKEN: token, TELEGRAM_ADMIN_ID: userId });
  writeSetupState({ setupComplete: true, onboardingComplete: false });
  req.session.telegramUserId = userId;
  return res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
  // Bypass login OTP untuk akses lokal/terpercaya
  req.session.isAdmin = true;
  return res.redirect('/admin');
});

app.post('/admin/request-otp', async (req, res) => {
  const userId = sanitizeText(req.body.userId || '');
  if (!userId) {
    return res.status(400).json({ ok: false, message: 'User ID Telegram wajib diisi.' });
  }

  const adminId = sanitizeText(process.env.TELEGRAM_ADMIN_ID || readCurrentEnv().TELEGRAM_ADMIN_ID || '');
  if (adminId && userId !== adminId) {
    return res.status(403).json({ ok: false, message: 'User ID tidak cocok dengan admin Telegram yang terdaftar.' });
  }

  const otp = generateOtpForTelegram(userId);
  const sent = await sendTelegramOtp(userId, otp);
  if (!sent) {
    return res.status(500).json({ ok: false, message: 'Gagal mengirim OTP ke Telegram.' });
  }

  req.session.telegramUserId = userId;
  return res.json({ ok: true, message: 'OTP berhasil dikirim ke Telegram admin.' });
});

app.post('/admin/verify-otp', (req, res) => {
  const userId = sanitizeText(req.body.userId || req.session.telegramUserId || '');
  const code = sanitizeText(req.body.code || '');

  if (!userId || !code) {
    return res.status(400).json({ ok: false, message: 'User ID dan kode OTP wajib diisi.' });
  }

  const saved = otpStore.get(userId);
  if (!saved || !saved.code) {
    return res.status(400).json({ ok: false, message: 'OTP tidak ditemukan atau sudah kadaluwarsa.' });
  }

  if (Date.now() - saved.createdAt > OTP_TTL_MS) {
    otpStore.delete(userId);
    return res.status(400).json({ ok: false, message: 'OTP sudah kadaluwarsa. Minta lagi.' });
  }

  if (String(saved.code) !== String(code)) {
    return res.status(400).json({ ok: false, message: 'Kode OTP salah.' });
  }

  otpStore.delete(userId);
  req.session.telegramUserId = userId;
  req.session.isAdmin = true;
  return res.json({ ok: true, message: 'Login berhasil.' });
});

app.get('/admin/setup', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  return res.send(renderSetupWizard(1));
});

app.post('/admin/setup/step1', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).send('Unauthorized');
  const name = sanitizeText(req.body.business_name);
  const address = sanitizeText(req.body.business_address);
  const contact = sanitizeText(req.body.business_contact);
  const hours = sanitizeText(req.body.business_hours);
  
  if (!name || !address || !contact || !hours) {
    return res.send(renderSetupWizard(1, 'Semua field wajib diisi'));
  }
  
  req.session.setupData = req.session.setupData || {};
  req.session.setupData.business_name = name;
  req.session.setupData.business_address = address;
  req.session.setupData.business_contact = contact;
  req.session.setupData.business_hours = hours;
  res.redirect('/admin/setup/step2');
});

app.get('/admin/setup/step2', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  return res.send(renderSetupWizard(2));
});

app.post('/admin/setup/step2', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).send('Unauthorized');
  const products = sanitizeText(req.body.business_products);
  const price = sanitizeText(req.body.business_price);
  const delivery = sanitizeText(req.body.business_delivery);
  
  if (!products || !price || !delivery) {
    return res.send(renderSetupWizard(2, 'Semua field wajib diisi'));
  }
  
  req.session.setupData = req.session.setupData || {};
  req.session.setupData.business_products = products;
  req.session.setupData.business_price = price;
  req.session.setupData.business_delivery = delivery;
  res.redirect('/admin/setup/step3');
});

app.get('/admin/setup/step3', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  return res.send(renderSetupWizard(3));
});

app.post('/admin/setup/step3', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).send('Unauthorized');
  req.session.setupData = req.session.setupData || {};
  req.session.setupData.payment_methods = {
    transfer: !!req.body.payment_transfer,
    qris: !!req.body.payment_qris,
    cash: !!req.body.payment_cash,
    gopay: !!req.body.payment_gopay,
  };
  req.session.setupData.payment_notes = sanitizeText(req.body.payment_notes || '');
  res.redirect('/admin/setup/step4');
});

app.get('/admin/setup/step4', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  return res.send(renderSetupWizard(4));
});

app.post('/admin/setup/complete', (req, res) => {
  if (!req.session.isAdmin) return res.status(401).send('Unauthorized');
  
  const setupData = req.session.setupData || {};
  const kbDir = ensureKbDir();
  
  const profileLines = [
    `Nama usaha: ${setupData.business_name || ''}`,
    `Alamat: ${setupData.business_address || ''}`,
    `Kontak: ${setupData.business_contact || ''}`,
    `Produk: ${setupData.business_products || ''}`,
    `Harga: ${setupData.business_price || ''}`,
    `Pengiriman: ${setupData.business_delivery || ''}`,
    `Jam operasional: ${setupData.business_hours || ''}`,
  ].filter(line => !line.endsWith(': '));
  
  if (profileLines.length > 0) {
    fs.writeFileSync(path.join(kbDir, 'business-profile.txt'), profileLines.join('\n'), 'utf-8');
  }
  
  const faqLines = [];
  for (const key in req.body) {
    if (key.startsWith('faq_q_')) {
      const id = key.replace('faq_q_', '');
      const q = sanitizeText(req.body[key]);
      const a = sanitizeText(req.body[`faq_a_${id}`] || '');
      if (q && a) {
        faqLines.push(`Q: ${q}\nA: ${a}`);
      }
    }
  }
  
  if (faqLines.length > 0) {
    fs.writeFileSync(path.join(kbDir, 'custom-faq.txt'), faqLines.join('\n\n'), 'utf-8');
  }
  
  writeSetupState({ setupComplete: true, onboardingComplete: true });
  delete req.session.setupData;
  
  res.redirect('/admin');
});

app.get('/admin', (req, res) => {
  if (!isSetupComplete()) {
    return res.redirect('/admin/register');
  }

  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }

  if (!isOnboardingComplete()) {
    return res.redirect('/admin/setup');
  }

  const envConfig = getConfigForWeb();
  const kbFiles = listKbFiles();
  const options = kbFiles.map(file => `<option value="${file}">${file}</option>`).join('');
  const waStatus = getWAStatus();
  const qrReady = !!getLastQR() || waStatus === 'waiting_qr';
  const qrDisabled = waStatus === 'open' || !qrReady || getQrCooldownRemaining(req) > 0;
  const botReadyLabel = runtimeState.running ? 'Running' : 'Stopped';
  const primaryAction = runtimeState.running ? 'Stop Bot' : 'Start Bot';
  const qrButtonText = waStatus === 'open' ? 'WA Connected' : (getQrCooldownRemaining(req) > 0 ? 'Tunggu cooldown QR' : 'Generate QR');

  res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Panel</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }
      .container { max-width: 1100px; margin: auto; }
      .card { background: #111827; border: 1px solid #334155; border-radius: 16px; padding: 20px; margin-bottom: 18px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
      label { display: block; margin: 10px 0 8px; font-weight: bold; }
      input, textarea, select, button { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px; border: 1px solid #475569; background: #020817; color: #f8fafc; }
      textarea { min-height: 180px; }
      .row { display: flex; gap: 10px; flex-wrap: wrap; }
      .btn { cursor: pointer; font-weight: bold; }
      .primary { background: #2563eb; border: none; }
      .danger { background: #991b1b; border: none; }
      .success { background: #15803d; border: none; }
      .muted { color: #cbd5e1; font-size: 13px; }
      .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
      .status { padding: 10px 12px; border-radius: 10px; background: rgba(37,99,235,.14); border: 1px solid rgba(96,165,250,.4); display: inline-block; }
      .badge { display: inline-block; margin-left: 10px; font-size: 12px; background: rgba(34,197,94,.18); color: #bbf7d0; border: 1px solid rgba(74,222,128,.35); padding: 6px 8px; border-radius: 999px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card toolbar">
        <div>
          <h2 style="margin:0;">Admin Panel</h2>
          <div class="status">WA Status: <strong>${waStatus}</strong> <span class="badge">${botReadyLabel}</span></div>
        </div>
        <div class="row">
          <form method="POST" action="${runtimeState.running ? '/admin/stop' : '/admin/start'}">
            <button class="btn ${runtimeState.running ? 'danger' : 'primary'}" type="submit">${primaryAction}</button>
          </form>
          <form method="POST" action="/admin/generate-qr">
            <button class="btn primary" type="submit" ${qrDisabled ? 'disabled' : ''}>${qrButtonText}</button>
          </form>

          <button id="showQrModalBtn" class="btn primary" type="button">Lihat QR Code</button>

          <!-- Modal QR Code -->
          <div id="qrModal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:9999; align-items:center; justify-content:center;">
            <div style="background:#111827; border:1px solid #334155; border-radius:16px; padding:28px; width:min(400px, 92vw); text-align:center; box-shadow:0 12px 32px rgba(0,0,0,0.4);">
              <h3 style="margin:0 0 16px; color:#f8fafc;">Scan QR WhatsApp</h3>
              <div style="background:white; padding:10px; border-radius:10px; display:inline-block;">
                <img id="modalQrImg" src="/admin/qr-image" style="max-width:280px; display:block;" onerror="this.src=''"/>
              </div>
              <p class="muted" style="margin-top:14px;">QR diperbarui otomatis setiap 5 detik.</p>
              <button id="closeQrModal" class="btn danger" type="button" style="margin-top:10px; width:100%;">Tutup</button>
            </div>
          </div>

          <script>
            const qrModal = document.getElementById('qrModal');
            const showQrModalBtn = document.getElementById('showQrModalBtn');
            const closeQrModal = document.getElementById('closeQrModal');
            const modalQrImg = document.getElementById('modalQrImg');
            let qrInterval = null;

            showQrModalBtn.addEventListener('click', () => {
              qrModal.style.display = 'flex';
              modalQrImg.src = '/admin/qr-image?t=' + Date.now();
              qrInterval = setInterval(() => {
                if (qrModal.style.display === 'flex') {
                  modalQrImg.src = '/admin/qr-image?t=' + Date.now();
                }
              }, 5000);
            });

            closeQrModal.addEventListener('click', () => {
              qrModal.style.display = 'none';
              if (qrInterval) clearInterval(qrInterval);
            });
          </script>
          <button id="resetWaBtn" class="btn danger" type="button">Reset WA Session</button>
          <form method="POST" action="/admin/delete-log"><button class="btn danger" type="submit">Delete Log</button></form>
          <form method="POST" action="/admin/delete-session"><button class="btn danger" type="submit">Delete Session</button></form>
          <a href="/admin/logout" style="text-decoration:none;display:block;"><button class="btn" type="button">Logout</button></a>
        </div>
      </div>
      <div id=\"resetOtpModal\" style=\"display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;\">
        <div style=\"background:#111827;border:1px solid #334155;border-radius:16px;padding:28px;width:min(420px,92vw);box-shadow:0 12px 32px rgba(0,0,0,0.28);\">
          <h3 style=\"margin:0 0 16px;color:#f8fafc;\">Masukkan Kode OTP Reset WA</h3>
          <p style=\"color:#cbd5e1;margin:0 0 16px;font-size:14px;\">OTP telah dikirim ke Telegram admin. Masukkan kode 6 digit untuk konfirmasi reset session WA.</p>
          <input id=\"resetOtpCode\" type=\"text\" placeholder=\"Contoh: 123456\" style=\"width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #475569;background:#020817;color:#f8fafc;margin:0 0 16px;\" maxlength=\"6\">
          <div style=\"display:flex;gap:10px;\">
            <button id=\"resetOtpSubmit\" type=\"button\" style=\"flex:1;padding:12px;background:#2563eb;border:none;color:#f8fafc;border-radius:10px;cursor:pointer;font-weight:bold;\">Konfirmasi</button>
            <button id=\"resetOtpCancel\" type=\"button\" style=\"flex:1;padding:12px;background:#475569;border:none;color:#f8fafc;border-radius:10px;cursor:pointer;font-weight:bold;\">Batal</button>
          </div>
        </div>
      </div>
      <form method="POST" action="/admin/config">
        <div class="card">
          <h3>🔐 License Activation</h3>
          <div id="licenseStatus" style="margin-bottom: 16px; padding: 12px; border-radius: 10px; background: rgba(34,197,94,.15); color: #bbf7d0; border: 1px solid rgba(74,222,128,.35); display: none;">
            <strong id="licenseStatusText">✅ License Active</strong><br/>
            <small id="licenseStatusDetails" style="color: #cbd5e1; margin-top: 4px; display: block;"></small>
          </div>
          <div id="licenseWarning" style="margin-bottom: 16px; padding: 12px; border-radius: 10px; background: rgba(220,38,38,.15); color: #fecaca; border: 1px solid rgba(248,113,113,.4); display: none;">
            <strong id="licenseWarningText">⚠️ License Issue</strong><br/>
            <small id="licenseWarningDetails" style="color: #cbd5e1; margin-top: 4px; display: block;"></small>
          </div>
          <label>License Key</label>
          <input id="licenseKeyInput" type="text" placeholder="Paste your license key here (e.g., TRIAL-XXXXX...)" style="width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px; border: 1px solid #475569; background: #020817; color: #f8fafc; margin: 6px 0 12px; font-family: monospace;" />
          <button type="button" id="activateLicenseBtn" class="btn" style="background: #2563eb; border: none; color: #f8fafc; padding: 12px; border-radius: 10px; cursor: pointer; font-weight: bold; width: 100%; margin-bottom: 16px;">Activate License</button>
          <div class="muted">Get your free 30-day trial key or purchase license. Contact support for trial activation.</div>
        </div>

        <div class="card">
          <h3>Gateway & AI</h3>
          <div class="grid">
            <div>
              <label>Gateway</label>
              <input name="AI_API_URL" value="${envConfig.AI_API_URL || ''}" placeholder="http://host:20128" />
            </div>
            <div>
              <label>API Key</label>
              <input name="AI_API_KEY" value="${envConfig.AI_API_KEY || ''}" placeholder="sk-..." />
            </div>
            <div>
              <label>Model</label>
              <input name="AI_MODEL" value="${envConfig.AI_MODEL || ''}" placeholder="gpt-3.5-turbo / combo" />
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Telegram</h3>
          <div class="grid">
            <div>
              <label>Token Telegram</label>
              <input name="TELEGRAM_BOT_TOKEN" value="${envConfig.TELEGRAM_BOT_TOKEN || ''}" placeholder="795...:AA..." />
            </div>
            <div>
              <label>User ID</label>
              <input name="TELEGRAM_ADMIN_ID" value="${envConfig.TELEGRAM_ADMIN_ID || ''}" placeholder="788284460" />
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Profil Usaha & KB Awal</h3>
          <div class="grid">
            <div>
              <label>Nama usaha</label>
              <input name="business_name" placeholder="Nama usaha" value="${readBusinessProfileField('nama usaha') || ''}" />
            </div>
            <div>
              <label>Alamat usaha</label>
              <input name="business_address" placeholder="Alamat usaha" value="${readBusinessProfileField('alamat') || ''}" />
            </div>
            <div>
              <label>Kontak / WhatsApp</label>
              <input name="business_contact" placeholder="08xxxx" value="${readBusinessProfileField('kontak') || ''}" />
            </div>
            <div>
              <label>Jenis produk / layanan</label>
              <input name="business_products" placeholder="Produk / layanan" value="${readBusinessProfileField('produk') || ''}" />
            </div>
            <div>
              <label>Harga / paket</label>
              <input name="business_price" placeholder="Harga / paket" value="${readBusinessProfileField('harga') || ''}" />
            </div>
            <div>
              <label>Pengiriman / area</label>
              <input name="business_delivery" placeholder="Area pengiriman" value="${readBusinessProfileField('pengiriman') || ''}" />
            </div>
            <div>
              <label>Pembayaran</label>
              <input name="business_payment" placeholder="Transfer / cash / QRIS" value="${readBusinessProfileField('pembayaran') || ''}" />
            </div>
            <div>
              <label>Jam operasional</label>
              <input name="business_hours" placeholder="Jam operasional" value="${readBusinessProfileField('jam operasional') || ''}" />
            </div>
          </div>
          <label>FAQ Custom (format: Q: ... / A: ...)</label>
          <textarea name="business_faq" placeholder="Q: Lokasi?\nA: Kami di ...\n\nQ: Harga?\nA: Mulai dari ...">${readBusinessFaq() || ''}</textarea>
          <div class="muted">Bagian ini akan dibuat menjadi KB awal dan menu default untuk mode tanpa AI.</div>
        </div>

        <div class="card">
          <h3>Knowledge Base</h3>
          <label>File KB</label>
          <select id="kbFileSelect" name="knowledge_file">
            <option value="">-- pilih file KB --</option>
            ${options}
          </select>
          <label>Isi knowledge base</label>
          <textarea id="kbContent" name="knowledge_content" placeholder="Tulis isi knowledge base..."></textarea>
          <div class="muted">Pilih file di atas untuk memuat isi. Simpan akan menimpa file yang dipilih atau membuat yang baru.</div>
        </div>

        <div class="card">
          <button class="btn primary" type="submit">Simpan Konfigurasi</button>
        </div>
      </form>
    </div>

    <script>
      const kbSelect = document.getElementById('kbFileSelect');
      const kbContent = document.getElementById('kbContent');

      kbSelect.addEventListener('change', async () => {
        const file = kbSelect.value;
        if (!file) {
          kbContent.value = '';
          return;
        }
        const response = await fetch('/admin/kb/' + encodeURIComponent(file));
        if (!response.ok) {
          kbContent.value = '';
          return;
        }
        kbContent.value = await response.text();
      });

      const resetWaBtn = document.getElementById('resetWaBtn');
      if (resetWaBtn) {
        resetWaBtn.addEventListener('click', async () => {
          const confirmed = confirm('Reset WA session akan menghapus auth sesi aktif. Lanjutkan?');
          if (!confirmed) return;

          const otpReq = await fetch('/admin/request-wa-reset-otp', { method: 'POST' });
          const otpData = await otpReq.json();
          if (!otpReq.ok) {
            alert(otpData.message || 'Gagal mengirim OTP reset WA.');
            return;
          }

          const resetOtpModal = document.getElementById('resetOtpModal');
          const resetOtpCode = document.getElementById('resetOtpCode');
          if (resetOtpModal && resetOtpCode) {
            resetOtpCode.value = '';
            resetOtpModal.style.display = 'flex';
            resetOtpCode.focus();
          }
        });
      }

      const resetOtpSubmit = document.getElementById('resetOtpSubmit');
      const resetOtpCancel = document.getElementById('resetOtpCancel');
      const resetOtpCode = document.getElementById('resetOtpCode');
      const resetOtpModal = document.getElementById('resetOtpModal');

      if (resetOtpCancel) {
        resetOtpCancel.addEventListener('click', () => {
          if (resetOtpModal) resetOtpModal.style.display = 'none';
          resetOtpCode.value = '';
        });
      }

      if (resetOtpSubmit) {
        resetOtpSubmit.addEventListener('click', async () => {
          const code = resetOtpCode.value.trim();
          if (!code) {
            alert('Kode OTP wajib diisi.');
            return;
          }

          resetOtpSubmit.disabled = true;
          resetOtpSubmit.textContent = 'Memproses...';

          const resetRes = await fetch('/admin/reset-wa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
          });
          const resetData = await resetRes.json();
          resetOtpSubmit.disabled = false;
          resetOtpSubmit.textContent = 'Konfirmasi';

          if (!resetRes.ok) {
            alert(resetData.message || 'Reset WA gagal.');
            if (resetOtpModal) resetOtpModal.style.display = 'none';
            return;
          }

          alert('WA session berhasil direset. Silakan klik Start Bot lagi untuk scan QR baru.');
          if (resetOtpModal) resetOtpModal.style.display = 'none';
          window.location.reload();
        });

        resetOtpCode.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            resetOtpSubmit.click();
          }
        });
      }
    </script>
  </body>
</html>`);
});

app.get('/admin/kb/:file', (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const fileName = sanitizeText(req.params.file);
  const filePath = path.join(ensureKbDir(), fileName);
  if (!fileName.endsWith('.txt') || !fs.existsSync(filePath)) {
    return res.status(404).send('File KB tidak ditemukan.');
  }

  return res.send(fs.readFileSync(filePath, 'utf-8'));
});

app.post('/admin/start', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const { startWA } = require('./wa-handler');
    await startWA();
    runtimeState.running = true;
    return res.redirect('/admin');
  } catch (e) {
    return res.status(400).send('Gagal start WA: ' + e.message);
  }
});

app.post('/admin/stop', (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).send('Unauthorized');
  }

  const result = stopBotProcess();
  if (!result.ok) {
    return res.status(400).send(result.message);
  }

  return res.redirect('/admin');
});

app.get('/admin/qr-image', async (req, res) => {
  const QRCode = require('qrcode');
  const qr = getLastQR();
  if (!qr) {
    return res.status(404).send('QR code belum tersedia. Pastikan bot WhatsApp sudah di-start.');
  }
  try {
    const buffer = await QRCode.toBuffer(qr, { width: 350, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    return res.send(buffer);
  } catch (e) {
    return res.status(500).send('Gagal generate QR image: ' + e.message);
  }
});

app.post('/admin/config', (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).send('Unauthorized');
  }

  const profileLines = [
    `Nama usaha: ${sanitizeText(req.body.business_name)}`,
    `Alamat: ${sanitizeText(req.body.business_address)}`,
    `Kontak: ${sanitizeText(req.body.business_contact)}`,
    `Produk: ${sanitizeText(req.body.business_products)}`,
    `Harga: ${sanitizeText(req.body.business_price)}`,
    `Pengiriman: ${sanitizeText(req.body.business_delivery)}`,
    `Pembayaran: ${sanitizeText(req.body.business_payment)}`,
    `Jam operasional: ${sanitizeText(req.body.business_hours)}`,
  ].filter(line => !line.endsWith(': '));

  if (profileLines.length > 0) {
    fs.writeFileSync(path.join(ensureKbDir(), 'business-profile.txt'), profileLines.join('\n'), 'utf-8');
  }

  const faqText = String(req.body.business_faq ?? '').trim();
  if (faqText) {
    fs.writeFileSync(path.join(ensureKbDir(), 'custom-faq.txt'), faqText, 'utf-8');
  }

  const payload = {
    AI_API_URL: sanitizeText(req.body.AI_API_URL),
    AI_API_KEY: sanitizeText(req.body.AI_API_KEY),
    AI_MODEL: sanitizeText(req.body.AI_MODEL),
    TELEGRAM_BOT_TOKEN: sanitizeText(req.body.TELEGRAM_BOT_TOKEN),
    TELEGRAM_ADMIN_ID: sanitizeText(req.body.TELEGRAM_ADMIN_ID),
  };

  const kbFile = sanitizeText(req.body.knowledge_file || 'knowledge.txt');
  const kbText = req.body.knowledge_content ?? '';

  if (kbFile) {
    const filename = kbFile.endsWith('.txt') ? kbFile : `${kbFile}.txt`;
    fs.writeFileSync(path.join(ensureKbDir(), filename), String(kbText), 'utf-8');
  }

  const cleaned = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== ''));
  if (Object.keys(cleaned).length > 0) {
    writeEnvConfig(cleaned);
  }

  return res.redirect('/admin');
});

app.post('/admin/delete-log', (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).send('Unauthorized');
  }

  try {
    if (fs.existsSync(LOGS_DIR)) {
      for (const file of fs.readdirSync(LOGS_DIR)) {
        fs.unlinkSync(path.join(LOGS_DIR, file));
      }
    }
    return res.redirect('/admin');
  } catch (e) {
    log('error', 'admin-server', 'Delete log failed', { error: e.message });
    return res.status(500).send('Delete log failed');
  }
});

app.post('/admin/delete-session', (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const sessionDir = path.join(DATA_DIR, 'sessions');
    if (fs.existsSync(sessionDir)) {
      for (const file of fs.readdirSync(sessionDir)) {
        const filePath = path.join(sessionDir, file);
        if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
      }
    }
    return res.redirect('/admin');
  } catch (e) {
    log('error', 'admin-server', 'Delete session failed', { error: e.message });
    return res.status(500).send('Delete session failed');
  }
});

app.post('/admin/request-wa-reset-otp', (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const userId = sanitizeText(req.session.telegramUserId || readCurrentEnv().TELEGRAM_ADMIN_ID || '');
  if (!userId) {
    return res.status(400).json({ ok: false, message: 'User ID admin tidak ditemukan.' });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  waResetOtpStore.set(String(userId), { code: otp, createdAt: Date.now() });

  sendTelegramOtp(userId, otp).then((sent) => {
    if (!sent) {
      waResetOtpStore.delete(String(userId));
      return res.status(500).json({ ok: false, message: 'Gagal mengirim OTP reset WA ke Telegram.' });
    }
    return res.json({ ok: true, message: 'OTP reset WA berhasil dikirim ke Telegram admin.' });
  }).catch((e) => {
    log('error', 'admin-server', 'Send WA reset OTP failed', { error: e.message });
    waResetOtpStore.delete(String(userId));
    return res.status(500).json({ ok: false, message: 'Gagal mengirim OTP reset WA.' });
  });
});

app.post('/admin/reset-wa', (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }

  const userId = sanitizeText(req.session.telegramUserId || readCurrentEnv().TELEGRAM_ADMIN_ID || '');
  const code = sanitizeText(req.body.code || '');

  if (!userId || !code) {
    return res.status(400).json({ ok: false, message: 'Kode OTP WA reset wajib diisi.' });
  }

  const saved = waResetOtpStore.get(String(userId));
  if (!saved || !saved.code) {
    return res.status(400).json({ ok: false, message: 'OTP reset WA tidak ditemukan atau sudah kadaluwarsa.' });
  }

  if (Date.now() - saved.createdAt > OTP_TTL_MS) {
    waResetOtpStore.delete(String(userId));
    return res.status(400).json({ ok: false, message: 'OTP reset WA sudah kadaluwarsa. Minta lagi.' });
  }

  if (String(saved.code) !== String(code)) {
    return res.status(400).json({ ok: false, message: 'Kode OTP reset WA salah.' });
  }

  waResetOtpStore.delete(String(userId));

  try {
    if (runtimeState.running && runtimeState.pid) {
      stopBotProcess();
    }
    clearWASessionFiles();
    return res.json({ ok: true, message: 'WA session berhasil direset.' });
  } catch (e) {
    log('error', 'admin-server', 'Reset WA failed', { error: e.message });
    return res.status(500).json({ ok: false, message: 'Reset WA gagal.' });
  }
});

async function startAdminServer() {
  const server = app.listen(port, () => {
    log('info', 'admin-server', `Admin portal running at http://localhost:${port}/admin`);
  });
  return server;
}

module.exports = { app, startAdminServer, generateOtpForTelegram, sendTelegramOtp };
