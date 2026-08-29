const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { log, DATA_DIR } = require('./utils');

const LICENSE_FILE = path.join(DATA_DIR, 'license.json');
const TRIAL_DAYS = 30;

function getEncryptionKey() {
  const key = process.env.LICENSE_KEY || 'default-secret-key-change-this';
  return crypto.createHash('sha256').update(key).digest();
}

function encryptValue(value) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptValue(encrypted) {
  try {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

function generateTrialKey() {
  const randomPart = crypto.randomBytes(12).toString('hex').toUpperCase();
  const datePart = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
  return `TRIAL-${randomPart}-${datePart}`;
}

function readLicense() {
  try {
    if (!fs.existsSync(LICENSE_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8'));
    return data;
  } catch (e) {
    log('warn', 'license-manager', 'Failed to read license', { error: e.message });
    return null;
  }
}

function writeLicense(data) {
  try {
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    log('error', 'license-manager', 'Failed to write license', { error: e.message });
    return false;
  }
}

function activateLicense(licenseKey) {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return { ok: false, error: 'Invalid license key format' };
  }

  const trimmed = licenseKey.trim().toUpperCase();
  
  const license = {
    key: trimmed,
    encryptedKey: encryptValue(trimmed),
    activatedAt: Date.now(),
    expiresAt: Date.now() + (TRIAL_DAYS * 24 * 60 * 60 * 1000),
    type: trimmed.startsWith('TRIAL-') ? 'trial' : 'premium',
    active: true,
  };

  writeLicense(license);
  log('info', 'license-manager', 'License activated', { type: license.type, expiresAt: new Date(license.expiresAt).toISOString() });
  
  return { 
    ok: true, 
    license: {
      key: trimmed,
      type: license.type,
      activatedAt: new Date(license.activatedAt).toISOString(),
      expiresAt: new Date(license.expiresAt).toISOString(),
      daysRemaining: Math.ceil((license.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)),
    }
  };
}

function getLicenseStatus() {
  const license = readLicense();
  
  if (!license) {
    return {
      active: false,
      status: 'no_license',
      message: 'No license activated. Please activate a license key to continue.',
      daysRemaining: 0,
    };
  }

  if (!license.active) {
    return {
      active: false,
      status: 'inactive',
      message: 'License is inactive.',
      daysRemaining: 0,
    };
  }

  const now = Date.now();
  const expiresAt = license.expiresAt;
  
  if (now > expiresAt) {
    license.active = false;
    writeLicense(license);
    return {
      active: false,
      status: 'expired',
      message: `License expired on ${new Date(expiresAt).toLocaleDateString()}. Please renew your license.`,
      daysRemaining: 0,
      expiredAt: new Date(expiresAt).toISOString(),
    };
  }

  const daysRemaining = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
  const warningDays = 7;
  const isWarning = daysRemaining <= warningDays;

  return {
    active: true,
    status: isWarning ? 'expiring_soon' : 'active',
    message: isWarning 
      ? `⚠️ License expiring in ${daysRemaining} days` 
      : `✅ License active`,
    key: license.key,
    type: license.type,
    daysRemaining,
    activatedAt: new Date(license.activatedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function isLicenseValid() {
  const status = getLicenseStatus();
  return status.active;
}

function deactivateLicense() {
  const license = readLicense();
  if (license) {
    license.active = false;
    writeLicense(license);
    log('info', 'license-manager', 'License deactivated');
    return { ok: true };
  }
  return { ok: false, error: 'No license to deactivate' };
}

module.exports = {
  generateTrialKey,
  activateLicense,
  getLicenseStatus,
  isLicenseValid,
  deactivateLicense,
  readLicense,
  writeLicense,
  TRIAL_DAYS,
};
