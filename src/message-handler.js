const { log, findKbAnswer, buildBusinessMenu, hasAIConfig, getAdminContactPhone } = require('./utils');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { askAI, NOT_FOUND_MARKER } = require('./ai-service');
const {
  getTransaction, setTransaction, resetTransaction, createOrder,
  generateNotaNumber, getOrderSummary, getNotaMessage, getFinalNotaMessage, getReceiptMessage,
  getStepFlow, getTotalProduct,
} = require('./transaction-manager');
const { saveReceipt, getQRISPath } = require('./media-manager');
const { sendMsg, sendPhotoMsg } = require('./telegram-handler');
const kb = require('./kb-loader');

function validateInput(validation, text) {
  if (validation === 'number') return /^\d+$/.test(text.replace(/\D/g, ''));
  if (validation === 'phone') return text.replace(/\D/g, '').length >= 8;
  if (validation === 'name') return text.trim().length >= 2;
  if (validation === 'address') return text.trim().length >= 5;
  return text.trim().length >= 1;
}

function normalizeValue(validation, text) {
  if (validation === 'phone' || validation === 'number') return text.replace(/\D/g, '');
  return text.trim();
}

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
  const flow = getStepFlow();
  const steps = kb.getSteps();
  const curState = txn.state;
  const stateIdx = flow.indexOf(curState);

  // --- Menu / sapaan ---
  const menuTriggers = kb.getConfigList('menu_trigger', ['menu', '/menu', 'halo', 'hai', 'hi', 'help', 'mulai']);
  if (menuTriggers.some(t => lower === t.toLowerCase())) {
    resetTransaction(from);
    await sock.sendMessage(from, { text: buildBusinessMenu() });
    return;
  }

  // --- Trigger order ---
  const orderTriggers = kb.getConfigList('order_trigger', ['pesan', 'order', '/order', 'beli']);
  if (stateIdx <= 0 && orderTriggers.some(t => lower === t.toLowerCase())) {
    resetTransaction(from);
    const waNumber = from.replace(/@.*/, '');
    createOrder(from);
    if (steps.length > 0) {
      const first = steps[0];
      setTransaction(from, first.id, { waNumber });
      await sock.sendMessage(from, { text: first.question });
    } else {
      await sock.sendMessage(from, { text: 'Maaf, alur pemesanan belum dikonfigurasi di Knowledge Base.' });
    }
    return;
  }

  // --- Batal ---
  const cancelTriggers = kb.getConfigList('cancel_trigger', ['batal', 'cancel', '/cancel']);
  if (cancelTriggers.some(t => lower === t.toLowerCase())) {
    resetTransaction(from);
    await sock.sendMessage(from, { text: 'Pesanan dibatalkan. Ketik *PESAN* jika ingin mulai ulang.' });
    return;
  }

  // --- Jalan di dalam flow order ---
  if (stateIdx > 0 && stateIdx < flow.length) {
    if (curState === 'summary') {
      const yes = kb.getConfigList('yes_keywords', ['ya', 'y', 'ok', 'confirm', 'konfirmasi', 'benar', 'setuju']);
      const no = kb.getConfigList('no_keywords', ['batal', 'cancel', 'salah', 'ubah']);
      if (yes.some(t => lower === t.toLowerCase())) {
        const notaNumber = generateNotaNumber();
        const deadlineMin = kb.getConfig('payment_deadline_minutes', 180);
        const deadlineAt = Date.now() + deadlineMin * 60 * 1000;
        setTransaction(from, 'nota_sent', { notaNumber, deadlineAt });
        await sock.sendMessage(from, { text: 'Pesanan dikonfirmasi\nNomor Nota: *' + notaNumber + '*\n\nMohon tunggu, admin sedang menghitung ongkir...' });
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        if (adminId) sendMsg(adminId, getNotaMessage(from));
        return;
      }
      if (no.some(t => lower === t.toLowerCase())) {
        resetTransaction(from);
        await sock.sendMessage(from, { text: 'Pesanan dibatalkan. Ketik *PESAN* jika ingin mulai ulang.' });
        return;
      }
      await sock.sendMessage(from, { text: 'Ketik *YA* untuk konfirmasi pesanan, atau *BATAL* jika ingin membatalkan' });
      return;
    }

    if (curState === 'nota_sent') {
      await sock.sendMessage(from, { text: 'Nota *' + (txn.data.notaNumber || '-') + '* sudah dikirim ke admin.\n\nMohon tunggu, admin sedang menghitung ongkir.' });
      return;
    }

    if (curState === 'awaiting_payment') {
      if (txn.data.deadlineAt && Date.now() > txn.data.deadlineAt) {
        resetTransaction(from);
        await sock.sendMessage(from, { text: 'Pesanan *' + (txn.data.notaNumber || '') + '* sudah melewati batas waktu pembayaran.\n\nSilakan ketik *PESAN* untuk membuat pesanan baru.' });
        return;
      }
      if (msg.message?.imageMessage) {
        setTransaction(from, 'completed', { paymentScreenshot: true });
        const adminId = process.env.TELEGRAM_ADMIN_ID;
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {});
          saveReceipt((txn.data.notaNumber || 'receipt') + '-' + Date.now() + '.jpg', buffer);
          if (adminId) {
            const caption = '📸 *Bukti bayar diterima*\nNota: *' + (txn.data.notaNumber || '-') + '*\nCustomer: ' + (txn.data.name || '-') + '\nWA: ' + (txn.data.waNumber || from.replace(/@.*/, '')) + '\n\nKetik `/lunas' + (txn.data.notaNumber || '') + '` untuk verifikasi';
            await sendPhotoMsg(adminId, buffer, caption);
          }
        } catch (e) { log('error', 'msg-handler', 'Forward screenshot failed', { error: e.message }); }
        await sock.sendMessage(from, { text: 'Bukti pembayaran diterima untuk Nota *' + txn.data.notaNumber + '*.\n\nAdmin akan memverifikasi. Mohon tunggu konfirmasi.' });
        return;
      }
      const remaining = (txn.data.deadlineAt || Date.now()) - Date.now();
      const mins = Math.max(0, Math.floor(remaining / 60000));
      await sock.sendMessage(from, { text: 'Mohon lakukan pembayaran dan kirim screenshot bukti bayar.\nSisa waktu: *' + mins + ' menit*' });
      return;
    }

    if (curState === 'completed') {
      await sock.sendMessage(from, { text: 'Pesanan sudah selesai. Ketik *PESAN* untuk order lagi.' });
      return;
    }

    if (curState === 'expired') {
      await sock.sendMessage(from, { text: 'Pesanan sebelumnya sudah hangus. Ketik *PESAN* untuk membuat pesanan baru.' });
      return;
    }

    const stepIdx = steps.findIndex(s => s.id === curState);
    if (stepIdx !== -1) {
      const step = steps[stepIdx];
      if (!validateInput(step.validation, text)) {
        await sock.sendMessage(from, { text: 'Mohon isi dengan benar ya. ' + step.question });
        return;
      }
      const data = {}; data[step.saveAs] = normalizeValue(step.validation, text);
      const nextStep = steps[stepIdx + 1];
      if (nextStep) {
        setTransaction(from, nextStep.id, data);
        await sock.sendMessage(from, { text: nextStep.question });
      } else {
        setTransaction(from, 'summary', data);
        await sock.sendMessage(from, { text: getOrderSummary(from) });
      }
      return;
    }
  }

  // --- AI chat & KB fallback with Telegram forward ---
  const { getIsLicensed } = require('./license-handler');
  if (!getIsLicensed()) return;

  const kbAnswer = findKbAnswer(text);
  if (kbAnswer) {
    await sock.sendMessage(from, { text: kbAnswer });
    return;
  }

  if (hasAIConfig()) {
    const answer = await askAI(text);
    if (answer.includes(NOT_FOUND_MARKER)) {
      const adminId = process.env.TELEGRAM_ADMIN_ID;
      const fallbackMsg = answer.replace(NOT_FOUND_MARKER, '').trim() || kb.getConfig('fallback_message', 'Maaf, informasi tersebut belum tersedia. Silakan hubungi admin kami.');
      if (adminId) {
        const senderWa = from.replace(/@.*/, '');
        sendMsg(adminId, `🚨 *Pertanyaan Customer Tidak Ditemukan di KB*\n\nDari: +${senderWa}\nPesan: "${text}"\n\nAI: "${answer}"\n\nSilakan balas langsung ke customer.`);
      }
      await sock.sendMessage(from, { text: fallbackMsg });
    } else {
      await sock.sendMessage(from, { text: answer });
    }
    return;
  }

  // Default fallback if no AI config
  const businessMenu = buildBusinessMenu();
  await sock.sendMessage(from, { text: businessMenu });
}

module.exports = { handleMessage };
