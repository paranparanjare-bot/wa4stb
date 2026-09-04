# Generic AI-WhatsApp Engine 🚀

Engine WhatsApp bot berbasis Node.js menggunakan **Baileys**, terintegrasi dengan **AI (OpenAI / OpenRouter / Custom Gateway)**, dilengkapi **Knowledge Base (KB) berbasis file**, sistem **Lisensi**, serta **Admin Panel Mobile-Friendly (Dark Mode)**.

---

## 🌟 Mengapa Engine Ini?
1. **Full Generic & KB-First**: Tidak ada hardcoded bisnis. Anda tentukan alur order, harga, dan FAQ murni dari file teks (`.txt`).
2. **AI-Fallback Intelligent**: Bot menjawab dari KB. Jika tidak ditemukan, AI membantu. Jika AI tidak tahu, pesan diteruskan ke admin Telegram.
3. **Admin Panel Modern**: Kontrol penuh (Start/Stop, Edit KB, Config AI, License) dari browser tanpa menyentuh kode.
4. **License Protected**: Keamanan operasional bot terjamin.

---

## ⚙️ Cara Setup (Sama dengan INSTALL.md)
*Lihat file [INSTALL.md](./INSTALL.md) untuk panduan instalasi di Windows atau Server/STB.*

---

## 🧠 Konsep Dasar: "Knowledge Base Driven"

Engine ini menggunakan **Knowledge Base (KB)** di folder `/data/knowledge/` sebagai sumber kebenaran satu-satunya:
1. **Konfigurasi (`@config`)**: Gunakan prefix `@` untuk mengatur trigger (misal: `@order_trigger: pesan, beli`).
2. **Langkah Order (`@step`)**: Definisi urutan pemesanan (nama, alamat, dll) bisa diubah dinamis.
3. **Data (`SECTION`)**: Gunakan `## SECTION: ...` untuk memisahkan kategori informasi.

**Bot akan memproses semua file `.txt` di folder tersebut secara otomatis.**

---

## 🚀 Fitur Admin Panel
- **Status Monitoring**: Cek apakah WA, AI, dan Lisensi aktif.
- **Edit KB Real-time**: Perubahan di file teks langsung berlaku detik itu juga (tanpa restart bot).
- **AI Configurator**: Hubungkan ke API AI favorit Anda (OpenRouter sangat direkomendasikan).
- **Auto-Update**: Bot selalu sinkron dengan file KB.

---

## 📌 Maintenance & Perintah
- **PM2 (Linux/STB)**: `npx pm2 status`, `npx pm2 logs wa4stb`, `npx pm2 restart wa4stb`.
- **Bot-only Mode**: Jalankan `node src/index.js --bot-only` jika ingin menjalankan bot tanpa admin panel (misal di server VPS yang sudah aman).

---

*Dibuat untuk fleksibilitas total. Ganti KB-nya, ganti bisnisnya!*

