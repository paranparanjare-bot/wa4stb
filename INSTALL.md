# Panduan Instalasi WA-STB Engine 🚀

Pilih panduan instalasi sesuai dengan perangkat yang Anda gunakan:

- **[1. Panduan untuk Windows (Lokal / PC / Laptop)](#-1-windows-local--pc)**
- **[2. Panduan untuk Linux Server / STB (Native)](#-2-linux-server--stb-native)**
- **[3. Panduan via SSH (VPS / Remote Server)](#-3-via-ssh-vps--remote-server)**

---

## 💻 1. Windows (Local / PC)

### Persiapan:
1. Install **Node.js LTS** dari [nodejs.org](https://nodejs.org/). Centang opsi tambahan jika ada.
2. Install **Git** dari [git-scm.com](https://git-scm.com/).
3. Siapkan Bot Telegram via **@BotFather** dan dapatkan ID Anda via **@userinfobot** (lihat bagian **[Cara Mendapatkan Token & User ID Telegram](#-tutorial-mendapatkan-token-user-id-telegram)** di bawah).

### Langkah-langkah:

#### **Cara Membuka PowerShell/CMD:**
- **Metode 1 (Mudah):** Buka File Explorer, navigasi ke folder yang ingin Anda gunakan, kemudian:
  - Tahan **Shift** + Klik kanan di folder kosong → Pilih **"Open PowerShell window here"** atau **"Open Command Prompt window here"**
- **Metode 2:** Tekan **Windows + R**, ketik `powershell` atau `cmd`, tekan **Enter**
- **Metode 3:** Buka Start Menu, cari `PowerShell`, klik kanan → **"Run as Administrator"**

#### **Instalasi Bot:**
1. Buka **PowerShell** atau **CMD** (lihat cara di atas).
2. Clone dan masuk ke folder:
   ```powershell
   git clone https://github.com/paranparanjare-bot/wa4stb.git
   cd wa4stb
   ```
3. Install dependencies:
   ```powershell
   npm install
   ```
4. Buat file `.env`:
   ```powershell
   copy .env.example .env
   ```
   > **💡 CATATAN:** Anda bisa melewati langkah mengisi `.env` secara manual di sini. File `.env` akan otomatis dikonfigurasi saat Anda login ke **Admin Page** (langkah 7). Lanjut ke langkah berikutnya jika ingin cara yang lebih mudah.

5. *(Opsional)* Jika ingin mengisi `.env` secara manual, buka file `.env` dengan **Notepad** dan isi sesuai kebutuhan (Token Telegram, Admin ID, dll).
6. Jalankan bot:
   ```powershell
   npm start
   ```
7. Buka browser: `http://localhost:3000/admin` (Login awal: `admin` / `admin`).
8. **Segera ganti password default** di bagian **Ganti Password Admin** sebelum bot digunakan.
9. Untuk mengisi konfigurasi (Token Telegram, dll), masuk ke tab **Settings/Pengaturan** di Admin Panel.

---

## 🐧 2. Linux Server / STB (Native)

### Persiapan: Install Node.js dan Git

Jika **Node.js (v18+)** dan **Git** belum terinstall, ikuti langkah di bawah sesuai sistem operasi Anda:

#### **Untuk Debian/Ubuntu/Linux Mint:**

1. **Update package manager:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install Node.js (v20 LTS - Recommended):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
   
   Verifikasi instalasi:
   ```bash
   node --version
   npm --version
   ```

3. **Install Git:**
   ```bash
   sudo apt-get install -y git
   ```
   
   Verifikasi instalasi:
   ```bash
   git --version
   ```

#### **Untuk CentOS/RHEL/Fedora:**

1. **Install Node.js (v20 LTS):**
   ```bash
   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo yum install -y nodejs
   ```

2. **Install Git:**
   ```bash
   sudo yum install -y git
   ```

#### **Untuk Alpine Linux (Minimal OS):**

1. **Install Node.js dan Git:**
   ```bash
   apk add --no-cache nodejs npm git
   ```

### Langkah-langkah:
1. Buka terminal Linux / STB.
2. Clone repository:
   ```bash
   git clone https://github.com/paranparanjare-bot/wa4stb.git
   cd wa4stb
   ```
3. Install package:
   ```bash
   npm install
   ```
4. Buat file `.env`:
   ```bash
   cp .env.example .env
   ```
   > **💡 CATATAN:** Anda bisa melewati langkah mengisi `.env` secara manual di sini. File `.env` akan otomatis dikonfigurasi saat Anda login ke **Admin Page**. Lanjut ke langkah berikutnya jika ingin cara yang lebih mudah.

5. *(Opsional)* Jika ingin mengisi `.env` secara manual, buka file dengan text editor:
   ```bash
   nano .env
   ```
   Isi konfigurasi yang diperlukan, kemudian simpan dengan `Ctrl+O`, `Enter`, `Ctrl+X`.

6. Jalankan dengan PM2 agar stabil di background:
   ```bash
   npx pm2 start src/index.js --name wa4stb
   npx pm2 save
   ```
7. Akses Admin Panel lewat IP server: `http://<IP_SERVER>:3000/admin`. Login awal `admin` / `admin`, lalu segera ganti password.
8. Untuk mengisi konfigurasi (Token Telegram, dll), masuk ke tab **Settings/Pengaturan** di Admin Panel.

---

## 🔐 3. Via SSH (VPS / Remote Server)

Jika Anda meremote server cloud (DigitalOcean, AWS, Contabo, dll) atau STB via SSH dari perangkat lain:

### Langkah-langkah:
1. **Login ke Server via SSH:**
   ```bash
   ssh root@ip_server_anda
   ```
2. **Install Node.js & Git (Debian/Ubuntu):**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
3. **Clone & Install Bot:**
   ```bash
   git clone https://github.com/paranparanjare-bot/wa4stb.git
   cd wa4stb
   npm install
   ```
4. **Konfigurasi Environment:**
   ```bash
   cp .env.example .env
   ```
   > **💡 CATATAN:** Anda bisa melewati langkah mengisi `.env` secara manual di sini. File `.env` akan otomatis dikonfigurasi saat Anda login ke **Admin Page**. Lanjut ke langkah berikutnya jika ingin cara yang lebih mudah.

   *(Opsional)* Jika ingin mengisi `.env` secara manual:
   ```bash
   nano .env
   ```
   Isi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_ID`, dan parameter lainnya, kemudian simpan dengan `Ctrl+O`, `Enter`, `Ctrl+X`.

5. **Jalankan dengan PM2 (Daemon Mode):**
   ```bash
   npx pm2 start src/index.js --name wa4stb
   npx pm2 save
   npx pm2 startup
   ```
6. **Akses:** Buka browser di laptop/HP Anda, lalu buka `http://ip_server_anda:3000/admin`.
7. Untuk mengisi konfigurasi (Token Telegram, dll), masuk ke tab **Settings/Pengaturan** di Admin Panel.

---

## 📱 Tutorial: Mendapatkan Token & User ID Telegram

Sebelum menjalankan bot, Anda memerlukan **Bot Token** dan **Admin User ID** dari Telegram. Berikut cara mendapatkannya:

### Langkah 1: Buat Bot di @BotFather

1. Buka Telegram dan cari **@BotFather** (bot resmi Telegram untuk membuat bot).
2. Klik **Start** atau ketik `/start`.
3. Ketik `/newbot` untuk membuat bot baru.
4. Ikuti instruksi:
   - **Berikan nama bot** (contoh: `MyWABot`).
   - **Berikan username bot** (harus unik, contoh: `my_wa_bot_2024`). Username harus diakhiri dengan `_bot` atau `Bot`.
5. **BotFather akan memberikan Bot Token** (contoh: `123456789:ABCDefGHijKLmNoPQRStUVwXYZ`).
6. **Simpan Bot Token ini** - Anda akan membutuhkannya di langkah konfigurasi.

### Langkah 2: Dapatkan User ID Admin Anda

1. Buka Telegram dan cari **@userinfobot**.
2. Klik **Start** atau ketik `/start`.
3. Bot akan menampilkan **ID Anda** (contoh: `1234567890`).
4. **Simpan User ID ini** - ini adalah ADMIN ID yang akan Anda gunakan.

### Langkah 3: Input ke WA-STB

Setelah instalasi selesai:
- Masuk ke **Admin Page**: `http://localhost:3000/admin` (atau IP server Anda).
- Buka tab **Settings/Pengaturan**.
- Isi field:
  - **TELEGRAM_BOT_TOKEN**: Paste Bot Token dari @BotFather.
  - **TELEGRAM_ADMIN_ID**: Paste User ID dari @userinfobot.
- **Simpan konfigurasi**.

---

## 🔑 Tutorial: Mendapatkan API Key (OpenAI / AI Services)

Jika Anda ingin menggunakan AI untuk merespons pesan otomatis, Anda memerlukan API Key dari layanan AI. Berikut pilihan gratis dan berbayar:

### Opsi 1: OpenAI API (Berbayar)

**Keuntungan:** Akurat, Support GPT-4, Stabil  
**Biaya:** Pay-as-you-go (mulai dari $0.01 per 1000 tokens)

**Cara mendapatkan:**
1. Buka [platform.openai.com](https://platform.openai.com/).
2. Daftar akun (gunakan email atau login via Google/Microsoft).
3. Verifikasi email Anda.
4. Buka **Billing** → **Add payment method** (Tambahkan kartu kredit).
5. Setelah pembayaran diatur, buka **API keys** → **Create new secret key**.
6. **Simpan API Key** (hanya ditampilkan sekali).
7. Masuk ke Admin Panel WA-STB → **Settings** → Isi field **OPENAI_API_KEY**.

**Estimasi biaya:** Sekitar $0.50-$2 per 100 percakapan (tergantung panjang pesan).

---

### Opsi 2: Google Gemini API (Gratis + Berbayar)

**Keuntungan:** Gratis untuk penggunaan dasar, Mudah setup  
**Biaya:** Gratis (limited) atau $0.075 per 1 juta input tokens (berbayar)

**Cara mendapatkan:**
1. Buka [ai.google.dev](https://ai.google.dev/).
2. Klik **Get API Key** → **Create API Key in new Google Cloud project**.
3. Tunggu hingga project selesai dibuat (beberapa detik).
4. **Copy API Key** yang ditampilkan.
5. Masuk ke Admin Panel WA-STB → **Settings** → Isi field **GOOGLE_API_KEY** (jika ada).

**Limit gratis:** 60 request per menit, cukup untuk bot percobaan.

---

### Opsi 3: Ollama (Gratis - Local)

**Keuntungan:** Gratis sepenuhnya, Berjalan offline, Privacy terjaga  
**Kekurangan:** Memerlukan resource CPU/GPU cukup besar

**Cara setup:**
1. Download **Ollama** dari [ollama.ai](https://ollama.ai/).
2. Install dan jalankan.
3. Di terminal, jalankan:
   ```bash
   ollama run mistral
   ```
   Ini akan download model AI gratis (~4GB).
4. Ollama akan berjalan di `http://localhost:11434`.
5. Update konfigurasi di Admin Panel untuk mengarah ke local Ollama API.

---

### Opsi 4: Claude API (Anthropic) - Berbayar

**Keuntungan:** Sangat akurat, Konteks panjang, Good for reasoning  
**Biaya:** $0.003 per 1K input tokens / $0.015 per 1K output tokens

**Cara mendapatkan:**
1. Buka [console.anthropic.com](https://console.anthropic.com/).
2. Daftar akun (gunakan email atau login).
3. Buka **Billing** → Tambahkan payment method.
4. Buka **API Keys** → **Create Key**.
5. **Copy API Key** dan simpan.
6. Masuk ke Admin Panel WA-STB → **Settings** → Isi field **CLAUDE_API_KEY** (jika ada).

---

### 💡 Rekomendasi untuk Pemula:
- **Budget terbatas?** → Gunakan **Google Gemini (Gratis)**.
- **Hasil terbaik?** → Gunakan **OpenAI API** (investasi kecil, hasil bagus).
- **Offline/Privacy?** → Gunakan **Ollama** (gratis, tapi perlu resource).

---

## ⚠️ Penting: Manajemen Lisensi (License Management)

**BOT TIDAK AKAN MERESPONS CHAT JIKA LISENSI TIDAK DIAKTIFKAN!**

Setelah bot berhasil dijalankan dan Anda masuk ke Admin Panel, **Anda HARUS mengaktifkan lisensi** agar bot bisa merespons pesan dari pengguna.

### Langkah Mengaktifkan Lisensi:

1. **Masuk ke Admin Panel:** `http://localhost:3000/admin` (atau IP server Anda).
2. Buka tab **Lisensi** atau **License Management**.
3. Di halaman lisensi, Anda akan melihat opsi:
   - **Dapatkan Kode Gratis** (Free License Code) - Tombol yang sudah tersedia
   - **Input Kode Lisensi Berbayar** (jika memiliki kode dari License Hub)

### Opsi 1: Menggunakan Lisensi Gratis (Direkomendasikan untuk Testing)

1. Klik tombol **"Dapatkan Kode Gratis"** atau **"Get Free License"** di Admin Panel.
2. Sistem akan otomatis:
   - Generate kode lisensi gratis untuk Anda
   - Mengaktifkan lisensi secara langsung
   - Menampilkan status lisensi yang sudah aktif (biasanya berwarna hijau)
3. **Bot sekarang siap merespons pesan!** ✅

**Durasi gratis:** Tergantung kebijakan (biasanya 30 hari atau unlimited dengan fitur terbatas).

### Opsi 2: Menggunakan Lisensi Berbayar

Jika Anda ingin menggunakan lisensi berbayar dengan fitur lebih lengkap:

1. **Hubungi kami untuk mendapatkan Kode Lisensi:**
   - 📱 Telegram: **[@BR_digitalcreative](https://t.me/BR_digitalcreative)**
   - Informasikan kebutuhan Anda dan dapatkan paket lisensi yang sesuai
   - Admin akan memberikan **Kode Lisensi** untuk aktivasi

2. Di tab **Lisensi** Admin Panel, paste kode di field **"Kode Lisensi"** atau **"License Code"**.
3. Klik **"Aktifkan Lisensi"** atau **"Activate License"**.
4. Tunggu proses validasi (biasanya instan).
5. Jika berhasil, status akan berubah hijau dan menampilkan informasi lisensi Anda.

### Troubleshooting Lisensi:

| Masalah | Solusi |
|--------|--------|
| Bot tidak merespons sama sekali | Pastikan lisensi sudah aktif (status hijau di tab Lisensi) |
| Tombol "Dapatkan Kode Gratis" tidak muncul | Refresh halaman atau logout/login ulang |
| Kode lisensi tidak valid | Periksa apakah kode sudah pernah dipakai di device lain, atau hubungi admin |
| Lisensi expired | Dapatkan kode baru atau perpanjang di tab Lisensi |

---

## 🧠 Konfigurasi Knowledge Base (KB)
Setelah login ke Admin Panel, buka tab **Edit Knowledge Base**. Gunakan format:
- `## SECTION: Nama` untuk kategori.
- `@greeting: Halo` untuk pesan pembuka.
- `@order_trigger: pesan` untuk pemicu pesanan.

---

*Dibuat untuk kemudahan instalasi di berbagai platform.*

