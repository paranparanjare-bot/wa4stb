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
3. Siapkan Bot Telegram via **@BotFather** dan dapatkan ID Anda via **@userinfobot**.

### Langkah-langkah:
1. Buka **PowerShell** atau **CMD**.
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
5. Isi `.env` (Token Telegram & Admin ID) menggunakan Notepad.
6. Jalankan bot:
   ```powershell
   npm start
   ```
7. Buka browser: `http://localhost:3000/admin` (Login default: `admin` / `admin`).

---

## 🐧 2. Linux Server / STB (Native)

### Persiapan:
Pastikan Node.js (v18+) dan Git sudah terinstall. Jika belum, gunakan pengelola paket (`apt`, `pkg`, dll).

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
5. Jalankan dengan PM2 agar stabil di background:
   ```bash
   npx pm2 start src/index.js --name wa4stb
   npx pm2 save
   ```
6. Akses Admin Panel lewat IP server: `http://<IP_SERVER>:3000/admin`.

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
   nano .env
   ```
   *(Isi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_ID`, lalu simpan dengan `Ctrl+O`, `Enter`, `Ctrl+X`)*
5. **Jalankan dengan PM2 (Daemon Mode):**
   ```bash
   npx pm2 start src/index.js --name wa4stb
   npx pm2 save
   npx pm2 startup
   ```
6. **Akses:** Buka browser di laptop/HP Anda, lalu buka `http://ip_server_anda:3000/admin`.

---

## 🧠 Konfigurasi Knowledge Base (KB)
Setelah login ke Admin Panel, buka tab **Edit Knowledge Base**. Gunakan format:
- `## SECTION: Nama` untuk kategori.
- `@greeting: Halo` untuk pesan pembuka.
- `@order_trigger: pesan` untuk pemicu pesanan.

---

*Dibuat untuk kemudahan instalasi di berbagai platform.*

