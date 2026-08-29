# 🤖 Panduan Lengkap Setup Bot WhatsApp CS Universal

Dokumen ini memandu cara menginstal dan menggunakan bot WhatsApp CS Universal dari awal hingga siap layanan.

---

## 📋 Persyaratan Sistem

Sebelum memulai, pastikan Anda memiliki:

- **Windows 10/11** atau **Linux/Mac**
- **Node.js versi 18+** (Download dari https://nodejs.org/)
- **Koneksi Internet stabil**
- **Nomor WhatsApp** yang akan digunakan untuk bot
- **Akun Telegram** untuk admin login
- **Bot Token Telegram** (buat dari @BotFather di Telegram)

---

## 🚀 Langkah 1: Instalasi Awal

### A. Download dan Extract Files

1. Download folder `wa4stb` dari server/cloud storage
2. Extract ke lokasi yang mudah diakses, misalnya: `C:\Bot WhatsApp` atau `~/wa-bot`
3. Buka folder tersebut

### B. Install Dependencies

1. **Buka Command Prompt / Terminal** di folder wa4stb
   - **Windows**: Tekan `Win + R`, ketik `cmd`, tekan Enter, cd ke folder
   - **Mac/Linux**: Buka Terminal, cd ke folder

2. **Jalankan perintah instalasi:**
   ```bash
   npm install
   ```
   Tunggu hingga selesai (±2 menit, tergantung kecepatan internet)

---

## 🔐 Langkah 2: Setup Admin Telegram

Bot membutuhkan akun Telegram admin untuk keamanan dan komunikasi. Ikuti langkah:

### A. Buat Bot Telegram

1. Buka Telegram dan cari `@BotFather`
2. Kirim pesan `/start`
3. Kirim `/newbot` dan ikuti petunjuk untuk membuat bot baru
4. Catat **Bot Token** yang diberikan (contoh: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### B. Dapatkan User ID Anda

1. Cari bot `@userinfobot` di Telegram
2. Kirim `/start`
3. Bot akan menampilkan User ID Anda (contoh: `788284460`)
4. Catat User ID ini

### C. Buka Admin Panel

1. Buka browser, ke `http://localhost:3000`
2. Anda akan melihat halaman **Register Admin**
3. Masukkan:
   - **Bot Token Telegram**: Dari step A (hash panjang)
   - **User ID Telegram**: Dari step B (angka saja)
4. Klik **Simpan & lanjutkan ke OTP Login**

---

## 📝 Langkah 3: Setup Wizard (Isi Info Bisnis)

Setelah registrasi, Anda akan diminta Login dengan OTP. Ikuti ini:

### A. Request OTP

1. Di halaman login, masukkan User ID Telegram Anda
2. Klik tombol **Generate OTP**
3. Periksa Telegram Anda, bot akan mengirim kode 6 digit
4. Masukkan kode tersebut, klik **Verifikasi**

### B. Setup Wizard - Step 1: Info Bisnis

Anda akan melihat form dengan 4 langkah. **Step 1** meminta data dasar:

| Field | Contoh Isian |
|-------|-------------|
| Nama Usaha | Toko Bumbu Betutu |
| Alamat Lengkap | Jl. Pendidikan No. 123, Banyuwangi |
| Nomor WhatsApp | 08123456789 |
| Jam Operasional | 08:00 - 17:00 |

Isi dengan data bisnis Anda, klik **Lanjut →**

### C. Step 2: Produk & Layanan

| Field | Contoh Isian |
|-------|-------------|
| Jenis Produk/Layanan | Bumbu Masakan, Rempah-Rempahan |
| Rentang Harga | Rp 20.000 - 50.000 per paket |
| Area Pengiriman | Seluruh Banyuwangi, Area Kabupaten |

Isi semua field, klik **Lanjut →**

### D. Step 3: Metode Pembayaran

Pilih metode pembayaran yang Anda terima (bisa pilih lebih dari satu):

- ✓ Transfer Bank
- ✓ QRIS  
- ✓ Cash / Tunai
- □ GoPay / OVO / Dana

Opsional: Tambahkan catatan pembayaran, klik **Lanjut →**

### E. Step 4: FAQ Builder

Di sini Anda membuat daftar pertanyaan umum yang sering ditanya customer. 

**Sudah ada 3 template default, Anda bisa:**
- **Edit** jawaban sesuai bisnis Anda
- **Tambah** pertanyaan baru dengan tombol "+ Tambah Pertanyaan"
- **Hapus** pertanyaan yang tidak perlu

**Contoh FAQ yang bagus:**
| Pertanyaan | Jawaban |
|-----------|---------|
| Apakah ada diskon untuk pembelian banyak? | Untuk pembelian grosir, hubungi kami via WhatsApp untuk penawaran khusus |
| Berapa lama pengiriman? | Pengiriman 1-3 hari kerja tergantung lokasi |
| Apakah ada garansi? | Produk kami dijamin original dan berkualitas |
| Jam operasional berapa? | Kami buka Senin-Jumat 08:00-17:00 |

Setelah selesai, klik **✅ Selesaikan Setup**

---

## ▶️ Langkah 4: Jalankan Bot

### A. Start Admin Server & Bot

Di Command Prompt/Terminal (folder wa4stb), jalankan:

```bash
npm start
```

Anda akan melihat pesan seperti:

```
[INFO] [admin-server] Admin portal running at http://localhost:3000/admin
[INFO] [wa-handler] WhatsApp connected!
```

### B. Scan QR Code WhatsApp

1. Bot akan meminta Anda untuk scan QR code WhatsApp
2. Klik tombol **Generate QR** di Admin Panel
3. Scan dengan nomor WhatsApp yang akan digunakan bot
4. Tunggu sampai status berubah menjadi **"WhatsApp connected!"**

### C. Test Bot

1. Kirim pesan "Halo" atau "Menu" ke bot dari WhatsApp lain
2. Bot akan merespons dengan menu yang sudah Anda setup
3. Coba tanya "Jam berapa?" atau pertanyaan dari FAQ Anda

---

## 🎛️ Langkah 5: Admin Panel - Menu Utama

Setelah bot running, Anda bisa akses **http://localhost:3000/admin** untuk:

### A. Kontrol Bot

- **Start Bot** - Nyalakan WhatsApp connection
- **Stop Bot** - Matikan bot (chat tidak diterima)
- **Generate QR** - Scan ulang jika terjadi error
- **Reset WA Session** - Jika perlu ganti nomor WhatsApp

### B. Edit Konfigurasi

**Gateway & AI** (opsional):
- Jika Anda punya AI API, bisa konfigurasi di sini
- Bot tetap bekerja meski tidak ada AI (berdasarkan KB)

**Telegram**:
- Bisa update token & user ID di sini

**Profil Usaha & KB**:
- Edit data bisnis Anda kapan saja
- Bot akan langsung gunakan data terbaru tanpa restart

**Knowledge Base**:
- Tambah/edit file custom FAQ atau knowledge base
- Format: `Q: [pertanyaan]` / `A: [jawaban]`

### C. Manajemen Data

- **Delete Log** - Hapus file log harian
- **Delete Session** - Reset sesi WhatsApp (kalau butuh scan ulang)

---

## 🔍 Troubleshooting - Masalah Umum

### ❌ Bot Tidak Connect Ke WhatsApp

**Solusi:**
1. Cek koneksi internet
2. Klik **Generate QR** dan scan ulang
3. Jika masih error, klik **Reset WA Session** kemudian scan QR baru
4. Pastikan nomor WhatsApp belum login di device lain

### ❌ OTP Tidak Masuk di Telegram

**Solusi:**
1. Pastikan Bot Token dan User ID benar
2. Cek Telegram, ada di mana OTP (mungkin di folder lain)
3. Klik **Generate OTP** lagi

### ❌ Bot Tidak Balas Pesan

**Solusi:**
1. Cek di Admin Panel apakah status **"WhatsApp connected!"**
2. Coba klik **Start Bot** jika status offline
3. Pesan dalam group? Bot hanya balas jika di-mention

### ❌ KB Tidak Update Meskipun Sudah Edit

**Solusi:**
1. KB auto-reload, tapi restart bot jika perlu:
   - Klik **Stop Bot** 
   - Tunggu 3 detik
   - Klik **Start Bot**

### ❌ Nomor WhatsApp Keluar (Logged Out)

**Solusi:**
1. Klik **Reset WA Session**
2. Scan QR baru
3. Jika tetap tidak connect, cek apakah nomor sudah login di WhatsApp Web atau device lain

---

## 💡 Tips & Best Practices

### Tips Untuk Hasil Optimal

1. **FAQ Berkualitas** = Bot Lebih Cerdas
   - Tambahkan pertanyaan yang benar-benar sering ditanya
   - Jawab dengan jelas dan professional
   - Update FAQ setiap bulan

2. **Info Bisnis Lengkap** = Customer Puas
   - Pastikan alamat, jam, kontak selalu akurat
   - Update jika ada perubahan operasional

3. **Monitor Pesan** via Telegram
   - Bot mengirim notifikasi order penting ke Telegram Anda
   - Terima real-time update status bot

4. **Backup Data Bisnis**
   - Simpan copy FAQ dan profil di tempat aman
   - Backup folder `data/knowledge` secara berkala

### Mode Operasi

Bot memiliki 2 mode:

| Mode | Cara Jalankan | Kapan Gunakan |
|------|---------------|----------------|
| **Admin Mode** | `npm start` | Default, admin panel + bot bersamaan |
| **Bot Only** | `npm start -- --bot-only` | Jika ingin bot saja tanpa admin panel |

---

## 📞 Dukungan & Kontak

Jika ada pertanyaan atau masalah:

1. **Cek Admin Panel Logs**
   - Klik **Delete Log** untuk refresh log
   - Lihat `/logs` folder untuk detail error

2. **Restart Bot**
   - Sering kali masalah terselesai dengan restart
   - Stop Bot → tunggu 3 detik → Start Bot

3. **Contact Support**
   - Hubungi developer via Telegram untuk bantuan
   - Sertakan screenshot error dari admin panel

---

## ✅ Checklist Final - Bot Siap Operasional

- [ ] Node.js terinstal (v18+)
- [ ] Folder wa4stb sudah di-extract
- [ ] `npm install` sudah selesai
- [ ] Bot Token Telegram sudah didapat dari @BotFather
- [ ] User ID Telegram sudah dicatat
- [ ] Admin Panel registration selesai
- [ ] Setup Wizard 4 langkah sudah dikerjakan
- [ ] `npm start` berjalan tanpa error
- [ ] WhatsApp QR sudah di-scan
- [ ] Status WhatsApp: "WhatsApp connected!"
- [ ] Test pesan "Menu" berhasil balasan
- [ ] FAQ sudah disesuaikan dengan bisnis
- [ ] Admin bisa akses http://localhost:3000/admin

---

**Selamat! Bot Anda sudah siap melayani customer! 🎉**

Untuk info lebih lanjut tentang fitur lanjutan, silakan hubungi support.

---

*Dokumentasi ini berlaku untuk WA-STB Bot v1.0.0*
