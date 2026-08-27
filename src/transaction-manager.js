const { log, generateId, formatCurrency, formatDate } = require('./utils');

const transactions = new Map();
const notaIndex = new Map(); // notaNumber -> chatId
const PRICE_PER_SACHET = 10000;
const PAYMENT_DEADLINE_MS = 3 * 60 * 60 * 1000;
let notaCounter = 0;

const STATES = {
  IDLE: 'idle',
  NAME: 'name',
  ADDRESS: 'address',
  PHONE: 'phone',
  PEDAS: 'pedas',
  SEDANG: 'sedang',
  EXPEDITION: 'expedition',
  SUMMARY: 'summary',
  NOTA_SENT: 'nota_sent',
  AWAITING_PAYMENT: 'awaiting_payment',
  PAYMENT_VERIFIED: 'payment_verified',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
};

function getTransaction(chatId) {
  return transactions.get(chatId) || { state: STATES.IDLE, data: {} };
}

function setTransaction(chatId, state, data = {}) {
  const existing = transactions.get(chatId) || { state: STATES.IDLE, data: {} };
  transactions.set(chatId, { state, data: { ...existing.data, ...data } });
}

function resetTransaction(chatId) {
  const txn = transactions.get(chatId);
  if (txn && txn.data.notaNumber) notaIndex.delete(txn.data.notaNumber);
  transactions.delete(chatId);
}

function createOrder(chatId) {
  const id = generateId('ORD');
  setTransaction(chatId, STATES.NAME, { orderId: id });
  return id;
}

function generateNotaNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function findTransactionByNota(notaNumber) {
  const chatId = notaIndex.get(notaNumber);
  if (!chatId) return null;
  const txn = transactions.get(chatId);
  return txn ? { chatId, txn } : null;
}

function getTotalProduct(chatId) {
  const txn = getTransaction(chatId);
  const pedas = parseInt(txn.data.pedas) || 0;
  const sedang = parseInt(txn.data.sedang) || 0;
  return (pedas + sedang) * PRICE_PER_SACHET;
}

function getNotaMessage(chatId) {
  const txn = getTransaction(chatId);
  const d = txn.data;
  const pedas = parseInt(d.pedas) || 0;
  const sedang = parseInt(d.sedang) || 0;
  const totalProduct = getTotalProduct(chatId);

  return [
    '📋 *NOTA SEMENTARA* — ' + d.notaNumber,
    '',
    'Customer: ' + d.name,
    'WA: ' + (d.waNumber || chatId.replace(/@.*/, '')),
    'Alamat: ' + d.address,
    'No HP: ' + d.phone,
    '',
    'Pesanan:',
    '• Pedas × ' + pedas + ' = ' + formatCurrency(pedas * PRICE_PER_SACHET),
    '• Sedang × ' + sedang + ' = ' + formatCurrency(sedang * PRICE_PER_SACHET),
    'Total Produk: *' + formatCurrency(totalProduct) + '*',
    '',
    'Ekspedisi: ' + d.expedition,
    'Ongkir: _belum diisi_',
    '',
    'Ketik /ongkir' + d.notaNumber + ' [nominal] untuk isi ongkir',
  ].join('\n');
}

function getFinalNotaMessage(chatId) {
  const txn = getTransaction(chatId);
  const d = txn.data;
  const pedas = parseInt(d.pedas) || 0;
  const sedang = parseInt(d.sedang) || 0;
  const totalProduct = getTotalProduct(chatId);
  const ongkir = parseInt(d.ongkir) || 0;
  const grandTotal = totalProduct + ongkir;
  const deadline = new Date(Date.now() + PAYMENT_DEADLINE_MS);
  const timeStr = deadline.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return [
    '📋 *NOTA PEMESANAN* — ' + d.notaNumber,
    '',
    'Nama: ' + d.name,
    'Alamat: ' + d.address,
    'No HP: ' + d.phone,
    '',
    'Pesanan:',
    '• Pedas × ' + pedas + ' = ' + formatCurrency(pedas * PRICE_PER_SACHET),
    '• Sedang × ' + sedang + ' = ' + formatCurrency(sedang * PRICE_PER_SACHET),
    '───────────────',
    'Total Produk: ' + formatCurrency(totalProduct),
    'Ongkir: ' + formatCurrency(ongkir),
    '*Grand Total: ' + formatCurrency(grandTotal) + '*',
    '',
    'Ekspedisi: ' + d.expedition,
    '',
    '💳 *CARA BAYAR:*',
    'QRIS / Transfer BCA:',
    '• BCA: 1801084287 a.n Sri Renaningtyasasih',
    '• Wajib kirim bukti transfer/screenshot',
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
  const pedas = parseInt(d.pedas) || 0;
  const sedang = parseInt(d.sedang) || 0;
  const totalProduct = getTotalProduct(chatId);
  const ongkir = parseInt(d.ongkir) || 0;

  return [
    '✅ *PEMBAYARAN TERVERIFIKASI*',
    '',
    'Nota: ' + d.notaNumber,
    'Pesanan: ' + pedas + ' pcs Pedas, ' + sedang + ' pcs Sedang',
    'Total: ' + formatCurrency(totalProduct + ongkir),
    '',
    'Terima kasih sudah order di Bumbu BR Ayam Betetu 🙏',
    'Pesanan Anda akan segera kami proses dan dikirim.',
    'Update pengiriman: https://rebrand.ly/admin-br',
  ].join('\n');
}

function getOrderSummary(chatId) {
  const txn = getTransaction(chatId);
  const d = txn.data;
  const pedas = parseInt(d.pedas) || 0;
  const sedang = parseInt(d.sedang) || 0;
  const totalProduct = getTotalProduct(chatId);

  return [
    'RINGKASAN PESANAN:',
    'Nama: ' + (d.name || '-'),
    'Alamat: ' + (d.address || '-'),
    'No HP: ' + (d.phone || '-'),
    'Pesanan: ' + pedas + ' pcs Pedas, ' + sedang + ' pcs Sedang.',
    'Ekspedisi: ' + (d.expedition || '-'),
    'Total Harga Produk: ' + formatCurrency(totalProduct),
    '',
    'Apakah data ini sudah benar? (Jawab *YA* untuk lanjut, *BATAL* untuk batalkan)',
  ].join('\n');
}

function checkExpiredTransactions() {
  const now = Date.now();
  const expired = [];
  for (const [chatId, txn] of transactions) {
    if (txn.state === STATES.AWAITING_PAYMENT && txn.data.deadlineAt) {
      if (now > txn.data.deadlineAt) expired.push(chatId);
    }
  }
  return expired;
}

function expireTransaction(chatId) {
  const txn = transactions.get(chatId);
  if (txn && txn.data.notaNumber) notaIndex.delete(txn.data.notaNumber);
  transactions.set(chatId, { state: STATES.EXPIRED, data: txn ? txn.data : {} });
  return txn;
}

function getAllPending() {
  const pending = [];
  for (const [chatId, txn] of transactions) {
    if ([STATES.NOTA_SENT, STATES.AWAITING_PAYMENT, STATES.PAYMENT_VERIFIED].includes(txn.state)) {
      pending.push({ chatId, txn });
    }
  }
  return pending;
}

module.exports = {
  STATES, PRICE_PER_SACHET, PAYMENT_DEADLINE_MS,
  getTransaction, setTransaction, resetTransaction, createOrder,
  generateNotaNumber, findTransactionByNota, notaIndex,
  getTotalProduct, getNotaMessage, getFinalNotaMessage, getReceiptMessage, getOrderSummary,
  checkExpiredTransactions, expireTransaction, getAllPending,
};
