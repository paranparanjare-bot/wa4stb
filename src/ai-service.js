const fetch = require('node-fetch');
const { log, searchKnowledgeBase, findKbAnswer } = require('./utils');
const kb = require('./kb-loader');

const NOT_FOUND_MARKER = '%%KB_TIDAK_TAHU%%';

const SYSTEM_PROMPT = `Kamu adalah asisten cerdas yang mewakili sesebuah organisasi/usaha.
Tugasmu HANYA menjawab berdasarkan informasi di KNOWLEDGE BASE (KB) yang diberikan di bawah.
Aturan mutlak:
1. Gunakan bahasa yang natural, ramah, dan seperti manusia sungguhan (sesuaikan dengan bahasa pengguna, utamanya Bahasa Indonesia).
2. JANGAN MENGARANG. Jangan menambah fakta, harga, nomor, alamat, atau janji yang tidak ada di KB.
3. Jika pertanyaan TIDAK DAPAT dijawab dari KB, balas TEPAT dengan teks berikut TANPA tambahan apapun:
${NOT_FOUND_MARKER}
4. Ikuti semua aturan/alur yang tertulis di KB (termasuk cara memesan, redirect nomor, dll) - jangan buat alur sendiri.
5. Jangan pernah menyertakan kode teknis, catatan developer, atau menyebut bahwa kamu adalah AI/model.`;

function getAIConfig() {
  return {
    apiUrl: process.env.AI_API_URL || 'http://localhost:20128',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'combo',
  };
}

function hasAIConfig() {
  const { apiUrl, apiKey, model } = getAIConfig();
  return !!(apiUrl && apiKey && model && apiUrl !== 'http://localhost:20128');
}

async function askAI(userMessage) {
  const kbAnswer = findKbAnswer(userMessage);
  if (!hasAIConfig()) {
    if (kbAnswer) return kbAnswer;
    return 'Maaf, saat ini bot berjalan dalam mode KB-only. Silakan cek menu utama atau isi data di admin panel.';
  }

  const kbText = searchKnowledgeBase(userMessage) || '(tidak ada KB)';
  let systemPrompt = SYSTEM_PROMPT.replace('NOT_FOUND_MARKER', NOT_FOUND_MARKER);
  systemPrompt += `\n\n===== KNOWLEDGE BASE =====\n${kbText}\n===== AKHIR KB =====`;

  const { apiUrl, apiKey, model } = getAIConfig();
  try {
    const res = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 600,
        temperature: 0.6,
        stream: false,
      }),
    });
    const data = await res.json();
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content.trim();
    }
    log('error', 'ai-service', 'No choices in response', data);
    return kbAnswer || 'Maaf, saya tidak bisa memproses pesan saat ini. Silakan coba lagi.';
  } catch (err) {
    log('error', 'ai-service', 'API request failed', { error: err.message });
    return kbAnswer || 'Maaf, layanan AI sedang tidak tersedia. Silakan coba lagi nanti.';
  }
}

module.exports = { askAI, hasAIConfig, getAIConfig, NOT_FOUND_MARKER };
