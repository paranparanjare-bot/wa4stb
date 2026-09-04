const { log, generateId, formatCurrency, formatDate } = require('./utils');
const kb = require('./kb-loader');

// Engine order generik berbasis KB. State machine dibangun dari @step di KB.
const transactions = new Map();
const notaIndex = new Map(); // notaNumber -> chatId

function getStepFlow() {
  const steps = kb.getSteps();
  return ['idle', ...steps.map(s => s.id), 'summary', 'nota_sent', 'awaiting_payment', 'payment_verified', 'completed', 'expired'];
}

function getTransaction(chatId) {
  return transactions.get(chatId) || { state: 'idle', data: {} };
}

function setTransaction(chatId, state, data = {}) {
  const existing = transactions.get(chatId) || { state: 'idle', data: {} };
  transactions.set(chatId, { state, data: { ...existing.data, ...data } });
}

function resetTransaction(chatId) {
  const txn = transactions.get(chatId);
  if (txn && txn.data.notaNumber) notaIndex.delete(txn.data.notaNumber);
  transactions.delete(chatId);
}

function createOrder(chatId) {
  const id = generateId('ORD');
  setTransaction(chatId, 'idle', { orderId: id });
  return id;
}

function generateNotaNumber() {
  const prefix = kb.getConfig('nota_prefix', 'ORD');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + '-' + result;
}

function findTransactionByNota(notaNumber) {
  const chatId = notaIndex.get(notaNumber);
  if (!chatId) return null;
  const txn = transactions.get(chatId);
  return txn ? { chatId, txn } : null;
}

// Total produk dihitung dari field harga dinamis di KB atau per-item.
function getTotalProduct(chatId) {
  const txn = getTransaction(chatId);
  const pricePer = kb.getConfig('price_per_item', null);
  let total = 0;
  if (pricePer !== null) {
    const num = parseInt(txn.data.quantity) || 0;
    total = num * pricePer;
  } else {
    for (const [k, v] of Object.entries(txn.data)) {
      if (['quantity', 'ongkir', 'total'].includes(k)) continue;
      const n = parseInt(v);
      if (!isNaN(n) && /qty|jumlah|item|pcs|sachet|unit|produk/i.test(k)) total += n;
    }
  }
  return total;
}

function getOrderedItems(chatId) {
  const txn = getTransaction(chatId);
  const steps = kb.getSteps();
  const lines = [];
  for (const s of steps) {
    const val = txn.data[s.saveAs];
    if (val === undefined || val === '') continue;
    lines.push('• ' + (s.question || s.id) + ': ' + val);
  }
  return lines.join('\n');

function getNotaMessage(chatId) {
  const txn = getTransaction(chatId);
  const d = txn.data;
  const totalProduct = getTotalProduct(chatId);
  const waNum = d.waNumber || chatId.replace(/@.*/, '');

  return [
    '📋 *NOTA SEMENTARA* — ' + d.notaNumber,
    '',
    'Customer: ' + (d.name || '-'),
    'WA: ' + waNum,
    getOrderedItems(chatId),
    'Total Produk: *' + formatCurrency(totalProduct) + '*',
    '',
    'Ongkir: _belum diisi_',
    '',
    'Ketik /ongkir ' + d.notaNumber + ' [nominal] untuk isi ongkir',
  ].join('\n');
}

function getFinalNotaMessage(chatId) {
  const txn = getTransaction(chatId);
  const d = txn.data;
  const totalProduct = getTotalProduct(chatId);
  const ongkir = parseInt(d.ongkir) || 0;
  const grandTotal = totalProduct + ongkir;
  const deadlineMin = kb.getConfig('payment_deadline_minutes', 180);
  const deadline = new Date(Date.now() + deadlineMin * 60 * 1000);
  const timeStr = deadline.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const payTemplate = kb.getConfig('payment_info', 'Silakan hubungi admin untuk metode pembayaran.');

  return [
    '📋 *NOTA PEMESANAN* — ' + d.notaNumber,
    '',
    'Nama: ' + (d.name || '-'),
    'WA: ' + (d.waNumber || chatId.replace(/@.*/, '')),
    getOrderedItems(chatId),
    '───────────────',
    'Total Produk: ' + formatCurrency(totalProduct),
    'Ongkir: ' + formatCurrency(ongkir),
    '*Grand Total: ' + formatCurrency(grandTotal) + '*',
    '',
    '💳 *CARA BAYAR:*',
    payTemplate,
    '',
    '⏰ Batas pembayaran: *' + timeStr + ' WIB*',
    '(Jika lewat ' + timeStr + ', pesanan otomatis hangus)',
    '',
    'Setelah bayar, kirim screenshot bukti bayar ya.',
  ].join('\n');
}

function getReceiptMessage(chatId) {
  const txn = getTransaction(chatId);
  const d = txn.data;
  const ongkir = parseInt(d.ongkir) || 0;
  const totalProduct = getTotalProduct(chatId);

  return [
    '✅ *PEMBAYARAN TERVERIFIKASI*',
    '',
    'Nota: ' + d.notaNumber,
    getOrderedItems(chatId),
    'Total: ' + formatCurrency(totalProduct + ongkir),
    '',
    'Terima kasih sudah order 🙏',
    'Pesanan Anda akan segera kami proses.',
  ].join('\n');
}

function getOrderSummary(chatId) {
  const txn = getTransaction(chatId);
  const d = txn.data;
  const totalProduct = getTotalProduct(chatId);

  return [
    'RINGKASAN PESANAN:',
    'Nama: ' + (d.name || '-'),
    getOrderedItems(chatId),
    'Total Harga Produk: ' + formatCurrency(totalProduct),
    '',
    'Apakah data ini sudah benar? (Jawab *YA* untuk lanjut, *BATAL* untuk batalkan)',
  ].join('\n');
}

function checkExpiredTransactions() {
  const now = Date.now();
  const expired = [];
  for (const [chatId, txn] of transactions) {
    if (txn.state === 'awaiting_payment' && txn.data.deadlineAt) {
      if (now > txn.data.deadlineAt) expired.push(chatId);
    }
  }
  return expired;
}

function expireTransaction(chatId) {
  const txn = transactions.get(chatId);
  if (txn && txn.data.notaNumber) notaIndex.delete(txn.data.notaNumber);
  transactions.set(chatId, { state: 'expired', data: txn ? txn.data : {} });
  return txn;
}

function getAllPending() {
  const pending = [];
  for (const [chatId, txn] of transactions) {
    if (['nota_sent', 'awaiting_payment', 'payment_verified'].includes(txn.state)) {
      pending.push({ chatId, txn });
    }
  }
  return pending;
}

module.exports = {
  getStepFlow,
  getTransaction, setTransaction, resetTransaction, createOrder,
  generateNotaNumber, findTransactionByNota, notaIndex,
  getTotalProduct, getOrderedItems, getNotaMessage, getFinalNotaMessage, getReceiptMessage, getOrderSummary,
  checkExpiredTransactions, expireTransaction, getAllPending,
};

}
