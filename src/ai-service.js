const fetch = require('node-fetch');
const { log, searchKnowledgeBase } = require('./utils');

const API_URL = process.env.AI_API_URL || 'http://localhost:20128';
const API_KEY = process.env.AI_API_KEY || '';
const MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';
const SYSTEM_PROMPT = `Kamu adalah asisten customer service (CS) untuk produk Bumbu Ayam Betutu BR yang ramah, profesional, dan selalu menyapa customer dengan sebutan 'Kak'. 
Jawab pertanyaan dalam Bahasa Indonesia dengan singkat, jelas, dan natural.
PENTING: 
1. Gunakan informasi dari knowledge base secara mutlak jika relevan. Jangan mengarang informasi jika tidak ada.
2. JANGAN PERNAH menyertakan catatan teknis, kode pemrograman, format python, catatan 'skipped', 'ponytail', atau komentar developer apa pun. Berbicaralah murni sebagai manusia / customer service toko.`;

async function askAI(userMessage) {
  const kbResult = searchKnowledgeBase(userMessage);
  let systemPrompt = SYSTEM_PROMPT;
  if (kbResult) {
    systemPrompt += `\n\nBerikut adalah informasi dari knowledge base yang relevan:\n${kbResult}`;
  }

  try {
    const res = await fetch(`${API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
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
    return 'Maaf, saya tidak bisa memproses pesan saat ini. Silakan coba lagi.';
  } catch (err) {
    log('error', 'ai-service', 'API request failed', { error: err.message });
    return 'Maaf, layanan AI sedang tidak tersedia. Silakan coba lagi nanti.';
  }
}

module.exports = { askAI };
