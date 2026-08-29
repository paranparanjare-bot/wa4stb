const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

function parseEnvFile(filePath = ENV_PATH) {
  if (!fs.existsSync(filePath)) return {};

  const content = fs.readFileSync(filePath, 'utf-8');
  const result = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result[key] = value.replace(/^['"]|['"]$/g, '');
  }

  return result;
}

function applyEnvValues(values = {}) {
  const next = { ...process.env, ...values };
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) delete next[key];
    else process.env[key] = String(next[key]);
  }
  return next;
}

function writeEnvConfig(nextValues = {}) {
  const current = parseEnvFile();
  const merged = { ...current, ...nextValues };

  const lines = [];
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null) continue;
    lines.push(`${key}=${String(value)}`);
  }

  fs.writeFileSync(ENV_PATH, `${lines.join('\n')}\n`, 'utf-8');
  applyEnvValues(nextValues);
  return { ...current, ...nextValues };
}

function getRuntimeConfig() {
  return { ...process.env };
}

module.exports = {
  ENV_PATH,
  parseEnvFile,
  writeEnvConfig,
  applyEnvValues,
  getRuntimeConfig,
};
