const fs = require('fs');
const path = require('path');
const os = require('os');
const { log } = require('./utils');
const DATA_DIR = path.join(__dirname, '..', 'data');
const LICENSE_FILE = path.join(DATA_DIR, 'license-state.json');

const SERVER_ID = os.hostname() + '-' + os.userInfo().username;
const CLOUDFLARE_API = 'https://wa-stb-license.paranparanjare.workers.dev';

let isLicensed = false;

async function checkLicense() {
  try {
    const data = fs.existsSync(LICENSE_FILE) ? JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8')) : null;
    if (!data || !data.key) {
      isLicensed = false;
      return;
    }

    const res = await fetch(`${CLOUDFLARE_API}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: data.key, server_id: SERVER_ID })
    });
    const result = await res.json();
    isLicensed = result.success;
    if (result.success) {
      isLicensed = true;
      const state = { 
        key: data.key, 
        expires_at: result.expires_at || new Date(Date.now() + 30*24*60*60*1000).toISOString() 
      };
      fs.writeFileSync(LICENSE_FILE, JSON.stringify(state, null, 2));
    }
    if (!isLicensed) log('warn', 'license', 'License check failed: ' + result.message);
  } catch (e) {
    log('error', 'license', 'Check failed', { error: e.message });
  }
}

async function activateLicense(key) {
  try {
    console.log('Activating key:', key, 'to', CLOUDFLARE_API);
    const res = await fetch(`${CLOUDFLARE_API}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, server_id: SERVER_ID })
    });
    const result = await res.json();
    if (result.success) {
      const state = { 
        key, 
        expires_at: result.expires_at || new Date(Date.now() + 30*24*60*60*1000).toISOString() 
      };
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
    let remoteResult = { success: true };
    if (data && data.key) {
      const response = await fetch(`${CLOUDFLARE_API}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: data.key })
      });
      const body = await response.json().catch(() => ({}));
      remoteResult = { success: response.ok && body.success !== false, message: body.message };
    }
    if (fs.existsSync(LICENSE_FILE)) fs.unlinkSync(LICENSE_FILE);
    isLicensed = false;
    if (!remoteResult.success) {
      return { success: false, message: 'Lisensi dihapus dari lokal, tetapi server lisensi menolak unbind: ' + (remoteResult.message || 'endpoint revoke tidak tersedia.') };
    }
    return { success: true, message: 'Lisensi berhasil di-logout dan di-unbind.' };
  } catch (e) {
    return { success: false, message: 'Gagal logout: ' + e.message };
  }
}

function getIsLicensed() { return isLicensed; }

if (fs.existsSync(LICENSE_FILE)) {
  isLicensed = true;
}
checkLicense();
setInterval(checkLicense, 3600000);

module.exports = { checkLicense, activateLicense, revokeLicense, getIsLicensed };