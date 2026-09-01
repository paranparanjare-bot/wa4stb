# WA-STB Bot (WhatsApp AI & License System)

Bot WhatsApp berbasis Node.js menggunakan **Baileys**, terintegrasi dengan **AI (OpenAI / OpenRouter / Custom Gateway)**, dilengkapi **Knowledge Base (KB)**, sistem **Lisensi**, serta **Admin Panel Mobile-Friendly (Dark Mode)**.

---

## Fitur Unggulan
1. **AI-First & KB Priority**: Bot memprioritaskan Knowledge Base lokal; jika tidak ditemukan, akan diteruskan ke AI. Jika AI tidak tahu, pesan otomatis diteruskan ke Telegram Admin.
2. **License System**: Dilindungi sistem lisensi aktif untuk keamanan operasional bot.
3. **Admin Panel Modern**: 
   - Start / Stop / QR Code (via Popup Modal) / Reset Session dalam satu baris menu horizontal.
   - Edit Knowledge Base langsung dari browser (dengan textarea besar).
   - Konfigurasi AI Gateway (URL, API Key, Model) yang otomatis menyimpan ke `.env`.
   - Manajemen Lisensi (Aktifkan / Logout / Cek Masa Aktif).
4. **PM2 Process Management**: Bot berjalan stabil di latar belakang server Linux/STB tanpa takut terputus saat SSH tertutup.

---

## 🛠️ Step-by-Step Instalasi & Konfigurasi (Untuk Pemula)

Ikuti langkah-langkah di bawah ini secara berurutan agar bot berhasil live:

### 1. Clone Repository
Masuk ke terminal server/STB Anda, lalu clone repository ini:
```bash
git clone https://github.com/paranparanjare-bot/wa4stb.git
cd wa4stb
```

### 2. Install Dependencies
Pastikan Node.js (versi 18+) sudah terinstall. Jalankan perintah:
```bash
npm install
```

### 3. Konfigurasi File Lingkungan (`.env`)
Buat file `.env` di root folder proyek dengan menyalin contoh berikut:
```env
TELEGRAM_BOT_TOKEN=12345678:xxxxxxxxxxxx-xxxxxxxxxx
TELEGRAM_ADMIN_ID=1234567890
ADMIN_PORT=3000
ADMIN_SESSION_SECRET=adminpassword
```
*(Catatan: Anda juga bisa mengisi bagian AI Config langsung lewat halaman Admin Panel di browser nantinya).*

### 4. Menjalankan Bot dengan PM2
Agar bot terus berjalan di latar belakang meskipun terminal SSH ditutup, gunakan PM2:
```bash
npx pm2 start src/index.js --name wa4stb
npx pm2 save
npx pm2 startup
```

---

## 🚀 Cara Penggunaan & Alur Kerja

### 1. Mengakses Admin Panel
Buka browser di HP atau laptop yang terhubung ke jaringan yang sama dengan server:
```text
http://<IP_SERVER_ANDA>:3000/admin
```
*(Contoh: `http://192.168.0.5:3000/admin`)*

- **Login Default**: 
  - Username: `admin`
  - Password: `admin`

### 2. Menghubungkan WhatsApp (Scan QR)
1. Setelah login ke Admin Panel, klik tombol **Start** pada menu utama.
2. Klik tombol **QR** untuk memunculkan *popup* QR Code WhatsApp.
3. Buka aplikasi WhatsApp di HP Anda -> **Linked Devices (Perangkat Tertaut)** -> **Link a Device**, lalu scan QR code yang muncul di layar admin panel.
4. Status WA akan berubah menjadi **Connected**.

### 3. Aktivasi Lisensi
Bot memerlukan lisensi valid agar dapat merespon pesan WhatsApp secara otomatis (*AI & KB*).
1. Untuk mendapatkan *License Code*, silakan lakukan request melalui WhatsApp ke: [wa.me/6285111507890](https://wa.me/6285111507890).
2. Masukkan kode tersebut ke dalam kolom **Aktivasi Lisensi** di Admin Panel, lalu klik **Aktifkan**.
3. Status lisensi akan berubah menjadi **Active** lengkap dengan sisa masa aktifnya.

### 4. Mengatur Knowledge Base (KB)
1. Buka bagian **Edit Knowledge Base** di Admin Panel.
2. Pilih file `.txt` yang ingin diedit dari dropdown (misal: `info-produk.txt` atau `business-profile.txt`).
3. Tulis informasi toko/produk Anda di kotak teks yang besar, lalu klik **Simpan KB**.
4. Bot akan otomatis menggunakan isi file tersebut sebagai acuan utama saat menjawab pertanyaan pelanggan.

---

## 📌 Maintenance & Perintah Penting PM2
- **Cek Status Bot**: `npx pm2 status`
- **Melihat Log Error/Aktivitas**: `npx pm2 logs wa4stb`
- **Restart Bot**: `npx pm2 restart wa4stb`
- **Stop Bot**: `npx pm2 stop wa4stb`
