## Fresh Install di Windows 10 (Dari Nol)

### 1. Install Node.js v18 LTS

Download dari: **https://nodejs.org/en/download**

Pilih **Windows Installer (.msi) 64-bit**, versi **LTS** ( minimal v18 atau v20 Rekomndasi v.22.23.2 LTS).

Jalankan installer:
- ✅ Add to PATH (default centang)
- ✅ Install
- ✅ Finish

Buka **PowerShell / CMD**, verifikasi:
```powershell
node -v
# harus: v18.x.x atau v20.x.x atau diatasnya

npm -v
# harus: 9.x.x atau 10.x.x
```

###Jika ada Masalah: PowerShell blokir script (.ps1) karena execution policy default **Restricted**.

### Fix

Jalankan PowerShell **as Administrator** (klik kanan PowerShell → Run as Administrator):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Ketik `Y` lalu Enter.
Lalu tutup PowerShell

---

Kembali ke PowerShell biasa (user biasa):

```powershell
npm -v
# seharusnya sudah jalan normal
```

---

**Kenapa `RemoteSigned`?**
- Script lokal tetap jalan
- Script dari internet harus di-sign (aman)
- Tidak perlu admin di masa depan
- Tidak mengubah policy global sistem

> Ini setting sekali, tidak perlu diulang.

---

### 2. Install Git

Download dari: **https://git-scm.com/download/win**
Pilih : Click here to download
Jalankan installer, tinggal next-next-next, semua default OK.

---

### 3. Clone & Setup

```powershell
# Clone repo
git clone https://github.com/paranparanjare-bot/wa4stb.git
cd wa4stb

# Install dependencies
npm install

# Buat file .env
copy .env.example .env
```

---

### 4. Isi `.env`

Buka `.env` di Notepad/VS Code:

```env
BOT_NAME=WA-STB-Bot
TELEGRAM_BOT_TOKEN=token_dari_BotFather
TELEGRAM_ADMIN_ID=id_anda
AI_API_URL=
AI_API_KEY=
AI_MODEL=
LICENSE_KEY=your-super-secret-encryption-key-here
AUTO_DELETE_RECEIPTS=true
RECEIPT_DELETE_DELAY_MS=300000
MAX_FILE_SIZE_MB=10
LOG_LEVEL=info
```

> **Telegram Bot Token**: chat @BotFather → `/newbot` → ikuti instruksi
> **Telegram User ID**: chat @userinfobot → kirim apa saja → dapat ID angka

---

### 5. Jalankan

```powershell
npm start
```

---

### 6. Buka Admin Panel

Browser → **http://localhost:3000/admin**

Alur:
1. **Registrasi** → Telegram Bot Token & User ID
2. **Login** → OTP masuk ke Telegram
3. **Setup** → isi profil usaha (nama, alamat, produk, harga, dll)
4. **Tab WhatsApp** → klik Generate QR → scan dengan HP
5. ✅ Bot aktif!

### Mode Alternatif

| Perintah | Fungsi |
|---|---|
| `npm start` | Admin mode (panel + Telegram, WA manual start) |
| `node src/index.js --bot-only` | Bot-only mode (WA langsung jalan tanpa admin panel) |

### Troubleshooting

| Masalah | Solusi |
|---|---|
| Port 3000 sudah dipakai | Set `ADMIN_PORT=3080` di `.env` |
| QR scan gagal / timeout | Hapus folder `data/sessions/`, restart, scan ulang |
| `node_modules` error | Hapus `node_modules` & `package-lock.json`, lalu `npm install` ulang |
| Telegram OTP tidak masuk | Cek `TELEGRAM_BOT_TOKEN` & `TELEGRAM_ADMIN_ID` benar |
### 
