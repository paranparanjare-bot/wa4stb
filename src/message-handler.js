const { log, findKbAnswer, buildBusinessMenu, hasAIConfig, getAdminContactPhone } = require('./utils');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { askAI } = require('./ai-service');
const {
  STATES, getTransaction, setTransaction, resetTransaction, createOrder,
  getOrderSummary, getNotaMessage, getFinalNotaMessage, getReceiptMessage,
  generateNotaNumber, notaIndex, PAYMENT_DEADLINE_MS, expireTransaction,
} = require('./transaction-manager');
const { saveReceipt, getQRISPath } = require('./media-manager');
const { sendMsg, sendPhotoMsg } = require('./telegram-handler');

async function handleMessage(sock, chatId, msg) {
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  if (!text && !msg.message?.imageMessage) {
    const mime = msg.message?.mimetype || '';
    if (mime.startsWith('audio/') || mime.startsWith('video/') || mime.startsWith('sticker/')) {
      await sock.sendMessage(from, { text: 'Maaf, file ini tidak bisa diproses. Kirim foto atau dokumen PDF saja ya.' });
    }
    return;
  }
  if (isGroup) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentioned.some(j => j === sock.user?.id)) return;
  }
  const txn = getTransaction(from);
  const lower = text.toLowerCase().trim();

  if (['menu', '/menu', '/start', 'help', 'halo', 'hai', 'hi', '0'].includes(lower)) {
    resetTransaction(from);
    const businessMenu = buildBusinessMenu();
    await sock.sendMessage(from, {
      text: businessMenu
    });
    return;
  }

  switch (txn.state) {
    case STATES.NAME: {
      if (!text || lower.length < 2) { await sock.sendMessage(from, { text: 'Mohon ketik nama lengkapnya ya' }); return; }
      setTransaction(from, STATES.ADDRESS, { name: text });
      await sock.sendMessage(from, { text: 'Halo ' + text + ', senang bisa bantu\n\nBoleh ketik alamat lengkapnya untuk pengiriman?' });
      return;
    }
    case STATES.ADDRESS: {
      if (!text || lower.length < 5) { await sock.sendMessage(from, { text: 'Alamatnya kurang lengkap ya, boleh diketik ulang dengan detail' }); return; }
      setTransaction(from, STATES.PHONE, { address: text });
      await sock.sendMessage(from, { text: 'Baik, alamat sudah dicatat\n\nBoleh kasih nomor HP yang bisa dihubungi?' });
      return;
    }
    case STATES.PHONE: {
      if (!text || text.replace(/\D/g, '').length < 8) { await sock.sendMessage(from, { text: 'Nomor HP-nya sepertinya kurang lengkap, boleh ketik ulang?' }); return; }
      setTransaction(from, STATES.PEDAS, { phone: text });
      await sock.sendMessage(from, { text: 'Oke noted\n\nMau pesan bumbu varian PEDAS berapa sachet? (ketik angka, 0 jika tidak pesan)' });
      return;
    }
    case STATES.PEDAS: {
      const num = parseInt(text.replace(/\D/g, ''));
      if (isNaN(num) || num < 0) { await sock.sendMessage(from, { text: 'Mohon ketik angka ya, contoh: 2' }); return; }
      setTransaction(from, STATES.SEDANG, { pedas: String(num) });
      await sock.sendMessage(from, { text: 'PEDAS ' + num + ' sachet, noted\n\nLalu varian SEDANG berapa sachet? (ketik angka, 0 jika tidak pesan)' });
      return;
    }
    case STATES.SEDANG: {
      const num = parseInt(text.replace(/\D/g, ''));
      if (isNaN(num) || num < 0) { await sock.sendMessage(from, { text: 'Mohon ketik angka ya, contoh: 3' }); return; }
      const pedas = parseInt(txn.data.pedas) || 0;
      if (pedas === 0 && num === 0) {
        await sock.sendMessage(from, { text: 'Jumlah kedua varian 0, sepertinya belum ada pesanan nih. Mau pesan PEDAS berapa sachet?' });
        setTransaction(from, STATES.PEDAS); return;
      }
      setTransaction(from, STATES.EXPEDITION, { sedang: String(num) });
      await sock.sendMessage(from, { text: 'PEDAS ' + pedas + ', SEDANG ' + num + ', noted\n\nMau pakai ekspedisi apa?\n1. *JNT*\n2. *Grab/Gojek* (area Banyuwangi)\n3. *Ambil sendiri* (area Banyuwangi)\n\nKetik nama atau angka pilihan' });
      return;
    }
    case STATES.EXPEDITION: {
      let expedition = text;
      if (['1', 'jnt'].includes(lower)) expedition = 'JNT';
      else if (['2', 'grab', 'gojek'].includes(lower)) expedition = 'Grab/Gojek';
      else if (['3', 'ambil', 'ambil sendiri'].includes(lower)) expedition = 'Ambil sendiri';
      else { await sock.sendMessage(from, { text: 'Pilihannya: *JNT*, *Grab/Gojek*, atau *Ambil sendiri*\n\nKetik salah satu ya' }); return; }
      setTransaction(from, STATES.SUMMARY, { expedition });
      await sock.sendMessage(from, { text: getOrderSummary(from) });
      return;
    }
    case STATES.SUMMARY: {
      if (['ya', 'y', 'ok', 'confirm', 'konfirmasi', 'benar', 'setuju'].includes(lower)) {
        const notaNumber = generateNotaNumber();
        notaIndex.set(notaNumber, from);
        const deadlineAt = Date.now() + PAYMENT_DEADLINE_MS;
        setTransaction(from, STATES.NOTA_SENT, { notaNumber, deadlineAt });
        await sock.sendMessage(from, { text: 'Pesanan dikonfirmasi\nNomor Nota: *' + notaNumber + '*\n\nMohon tunggu, admin sedang menghitung ongkir...' });
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        if (adminId) sendMsg(adminId, getNotaMessage(from));
        return;
      }
      if (['batal', 'cancel', 'salah', 'ubah'].includes(lower)) {
        resetTransaction(from);
        await sock.sendMessage(from, { text: 'Pesanan dibatalkan. Ketik *PESAN* jika ingin mulai ulang.' });
        return;
      }
      await sock.sendMessage(from, { text: 'Ketik *YA* untuk konfirmasi pesanan, atau *BATAL* jika ingin membatalkan' });
      return;
    }
    case STATES.NOTA_SENT: {
      await sock.sendMessage(from, { text: 'Nota *' + (txn.data.notaNumber || '-') + '* sudah dikirim ke admin.\n\nMohon tunggu, admin sedang menghitung ongkir.' });
      return;
    }
    case STATES.AWAITING_PAYMENT: {
      if (txn.data.deadlineAt && Date.now() > txn.data.deadlineAt) {
        expireTransaction(from);
        await sock.sendMessage(from, { text: 'Pesanan *' + (txn.data.notaNumber || '') + '* sudah melewati batas waktu pembayaran (3 jam).\n\nSilakan ketik *PESAN* untuk membuat pesanan baru.' });
        return;
      }
      if (msg.message?.imageMessage) {
        setTransaction(from, STATES.COMPLETED, { paymentScreenshot: true });
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          saveReceipt((txn.data.notaNumber || 'receipt') + '-' + Date.now() + '.jpg', buffer);
          // Forward screenshot ke Telegram admin
          if (adminId) {
            const caption = '📸 *Bukti bayar diterima*\nNota: *' + (txn.data.notaNumber || '-') + '*\nCustomer: ' + (txn.data.name || '-') + '\nWA: ' + (txn.data.waNumber || from.replace(/@.*/, '')) + '\n\nKetik `/lunas' + (txn.data.notaNumber || '') + '` atau klik untuk verifikasi';
            await sendPhotoMsg(adminId, buffer, caption);
          }
        } catch (e) { log('error', 'msg-handler', 'Forward screenshot failed', { error: e.message }); }
        await sock.sendMessage(from, { text: 'Bukti pembayaran diterima untuk Nota *' + txn.data.notaNumber + '*\n\nAdmin akan memverifikasi. Mohon tunggu konfirmasi.' });
        return;
      }
      const remaining = txn.data.deadlineAt - Date.now();
      const mins = Math.max(0, Math.floor(remaining / 60000));
      await sock.sendMessage(from, { text: 'Mohon lakukan pembayaran dan kirim screenshot bukti bayar.\nSisa waktu: *' + mins + ' menit*\n\nCara bayar ada di nota sebelumnya.\nUpdate pengiriman: https://rebrand.ly/admin-br' });
      return;
    }
    case STATES.COMPLETED: {
      await sock.sendMessage(from, { text: 'Pesanan sudah selesai. Ketik *PESAN* untuk order lagi, atau chat admin: https://rebrand.ly/admin-br' });
      return;
    }
    case STATES.EXPIRED: {
      await sock.sendMessage(from, { text: 'Pesanan sebelumnya sudah hangus. Ketik *PESAN* untuk membuat pesanan baru.' });
      return;
    }
  }

  // Start order
  if (['pesan', 'order', '/order', 'beli'].includes(lower)) {
    resetTransaction(from);
    const waNumber = from.replace(/@.*/, '');
    createOrder(from);
    setTransaction(from, STATES.NAME, { waNumber });
    await sock.sendMessage(from, { text: 'Baik, mari mulai pesanan\n\nSilakan ketik *nama lengkap* nya ya' });
    return;
  }

  // Cancel
  if (['batal', 'cancel', '/cancel'].includes(lower)) {
    resetTransaction(from);
    await sock.sendMessage(from, { text: 'Pesanan dibatalkan. Ketik *PESAN* jika ingin mulai ulang.' });
    return;
  }

  // AI chat
  if (lower.startsWith('tanya ') || lower.startsWith('ai ') || lower.startsWith('!ai ')) {
    const question = text.replace(/^(tanya|ai|!ai)\s+/i, '');
    const kbAnswer = findKbAnswer(question);
    if (kbAnswer) {
      await sock.sendMessage(from, { text: kbAnswer });
      return;
    }
    if (hasAIConfig()) {
      const answer = await askAI(question);
      await sock.sendMessage(from, { text: answer });
      return;
    }
  }

  const kbAnswer = findKbAnswer(text);
  if (kbAnswer) {
    await sock.sendMessage(from, { text: `${kbAnswer}\n\n_ketik 0 untuk kembali ke menu_` });
    return;
  }

  // Default: if no KB answer, answer with menu and do NOT notify telegram admin to avoid noise/ambiguity
  const businessMenu = buildBusinessMenu();
  await sock.sendMessage(from, { text: businessMenu + '\n\n_ketik 0 untuk kembali ke menu_' });
}

module.exports = { handleMessage };
