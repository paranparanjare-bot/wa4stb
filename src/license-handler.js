const fs = require('fs');
const path = require('path');
const os = require('os');
const { log } = require('./utils');
const DATA_DIR = path.join(__dirname, '..', 'data');
const LICENSE_FILE = path.join(DATA_DIR, 'license-state.json');

const SERVER_ID = os.hostname() + '-' + os.userInfo().username;
const LICENSE_API = 'https://wa-stb-license.paranparanjare.workers.dev';

let isLicensed = false;

async function checkLicense() {
  try {
    const data = fs.existsSync(LICENSE_FILE) ? JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8')) : null;
    if (!data || !data.key) {
      isLicensed = false;
      return;
    }

    const res = await fetch(`${LICENSE_API}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: data.key, server_id: SERVER_ID })
    });
    const result = await res.json();
    isLicensed = result.success;
    if (result.success && result.expires_at) {
      data.expires_at = result.expires_at;
      fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2));
    }
    if (!isLicensed) log('warn', 'license', 'License check failed: ' + result.message);
  } catch (e) {
    log('error', 'license', 'Check failed', { error: e.message });
  }
}

async function activateLicense(key) {
  try {
    const res = await fetch(`${LICENSE_API}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, server_id: SERVER_ID })
    });
    const result = await res.json();
    if (result.success) {
      const state = { key, expires_at: result.expires_at || new Date(Date.now() + 30*24*60*60*1000).toISOString() };
      fs.writeFileSync(LICENSE_FILE, JSON.stringify(state, null, 2));
      isLicensed = true;
    }
    return result;
  } catch (e) {
    return { success: false, message: 'Connection error' };
  }
}

async function revokeLicense() {
  try {
    const data = fs.existsSync(LICENSE_FILE) ? JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8')) : null;
    if (data && data.key) {
      await fetch(`${LICENSE_API}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: data.key })
      });
      fs.unlinkSync(LICENSE_FILE);
    }
    isLicensed = false;
    return { success: true, message: 'Lisensi berhasil di-logout dari server ini.' };
  } catch (e) {
    return { success: false, message: 'Gagal logout: ' + e.message };
  }
}

function getIsLicensed() { return isLicensed; }

// Check on startup immediately
if (fs.existsSync(LICENSE_FILE)) {
  isLicensed = true; // Optimistic start, verified by background check
}
checkLicense();
setInterval(checkLicense, 3600000); // Cek tiap 1 jam

module.exports = { checkLicense, activateLicense, revokeLicense, getIsLicensed };