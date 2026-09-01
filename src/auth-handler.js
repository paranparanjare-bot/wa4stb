const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');

// Default salt untuk password hashing
const DEFAULT_SALT = 'salt_for_wa4stb_fixed';

function hashPassword(password) {
  const salt = DEFAULT_SALT;
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
  return hash;
}

function verifyPassword(password, hash) {
  const computeHash = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(computeHash), Buffer.from(hash));
}

function ensureAuthFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(AUTH_FILE)) {
    const defaultAuth = { users: { admin: hashPassword('admin') } };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(defaultAuth, null, 2), 'utf-8');
  }
}

function verifyLogin(username, password) {
  ensureAuthFile();
  const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  const storedHash = auth.users?.[username];
  if (!storedHash) return false;
  return verifyPassword(password, storedHash);
}

function changePassword(username, newPassword) {
  const newHash = hashPassword(newPassword);
  let auth = { users: {} };
  if (fs.existsSync(AUTH_FILE)) {
    try { auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8')); } catch (_) {}
  }
  auth.users[username] = newHash;
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), 'utf-8');
}

module.exports = { verifyLogin, changePassword, hashPassword, ensureAuthFile };