const fetch = require('node-fetch');
const { log, searchKnowledgeBase, findKbAnswer } = require('./utils');

const SYSTEM_PROMPT = `Kamu adalah asisten customer service ramah yang mewakili toko. 
Sapa customer dengan "Selamat datang Kak". 
Gunakan Bahasa Indonesia natural, singkat, dan profesional.
PENTING:
1. Jawab pertanyaan berdasarkan informasi Knowledge Base yang diberikan.
2. Jika informasi tidak ada di Knowledge Base, JANGAN MENGARANG. Jawab: "Mohon maaf jawaban belum tersedia, silahkan hubungi admin kami di wa.me/${process.env.BUSINESS_CONTACT_WA || 'nomor-admin'}" dan informasikan bahwa customer menunggu jawaban.
3. JANGAN PERNAH menyertakan kode teknis atau catatan developer. Berbicaralah murni sebagai CS.`;

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
    return 'Maaf, saat ini bot berjalan dalam mode KB-only. Silakan cek menu utama atau isi data usaha di admin panel.';
  }

  const kbResult = searchKnowledgeBase(userMessage);
  let systemPrompt = SYSTEM_PROMPT;
  const { apiUrl, apiKey, model } = getAIConfig();
  if (kbResult) {
    systemPrompt += `\n\nBerikut adalah informasi dari knowledge base yang relevan:\n${kbResult}`;
  }

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
        max_tokens: 500,
        temperature: 0.7,
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

module.exports = { askAI, hasAIConfig, getAIConfig };
