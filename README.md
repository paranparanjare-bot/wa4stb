markdown
12345678910111213141516
┌─────────────────┐
│ Bot Telegram │ ← Control Panel (scan QR, KB, laporan)
└────────┬────────┘
│
┌────────▼────────┐ ┌──────────────────┐
│ Bot WhatsApp │─────▶│ 9router Gateway │
│ (Baileys) │ │ localhost:20128 │
└────────┬────────┘ └──────────────────┘
│
┌────▼────┐
│ STB │ ← Docker container (256MB RAM, 0.5 CPU)
│ Armbian │
└─────────┘
123
wa-stb/
├── docker-compose.yml # Docker config dengan limitasi resource
├── .env # Environment variables
├── .gitignore # Git ignore rules
├── package.json # Dependencies & scripts
├── README.md # Dokumentasi ini
├── src/
│ ├── index.js # Entry point & initialization
│ ├── wa-handler.js # Handle koneksi WA, QR code, session management
│ ├── message-handler.js # Router pesan (CS, order, billing flow)
│ ├── ai-service.js # Integrasi 9router gateway (OpenAI compatible)
│ ├── media-manager.js # Download image, reject audio/video, auto-delete
│ ├── transaction-manager.js # State management transaksi (pending, paid, completed)
│ └── utils.js # Helper functions (format tanggal, generate ID, dll)
├── data/
│ ├── sessions/ # Baileys auth state (persistent, jangan dihapus)
│ ├── media/
│ │ ├── qris/ # QRIS image (persistent, tidak pernah dihapus)
│ │ └── receipts/ # Nota pembayaran (auto-delete setelah transaksi selesai)
│ └── knowledge/ # Knowledge base .txt files (update via Telegram bot)
└── logs/ # Log files untuk debugging
12345678910111213141516171819202122
Integrasi 9router AI Gateway
javascript
123456
Format Request (OpenAI Compatible):
javascript
1234567891011121314
📱 Flow Bisnis
1. Customer Service Flow
1234
2. Order Processing Flow
1. Customer ketik *PESAN* → Nama → Alamat → HP → Pedas → Sedang → Ekspedisi → Ringkasan
2. Customer jawab *YA* → bot generate *nota* (BR0827-001) → kirim ke Telegram admin + konfirmasi ke customer
3. Admin Telegram: `/ongkir BR0827-001 15000` → bot kirim final nota (produk+ongkir+cara bayar) ke customer
4. Customer bayar & kirim screenshot → bot konfirmasi → notifikasi ke admin Telegram
5. Admin Telegram: `/lunas BR0827-001` → bot kirim "verifikasi, sedang diproses" ke customer
6. Batas bayar 3 jam. Jika expire → hangus, customer start ulang
7. Update pengiriman: https://rebrand.ly/admin-br
3. Payment Verification Flow
Customer kirim bukti bayar (screenshot) → bot simpan & notif admin → admin /lunas → bot notif "sedang dikirim"
4. Media Handling Rules
BOLEH download:
✅ Image (JPG, PNG, WEBP) - untuk nota pembayaran
✅ Document (PDF) - opsional, untuk invoice
DILARANG download:
❌ Audio (voice note)
❌ Video
❌ Sticker (kecuali untuk testing)
Auto-Delete Logic:
javascript
1234
Persistent Files:
✅ data/media/qris/qris.jpg - QRIS image, tidak pernah dihapus
✅ data/sessions/ - Baileys auth state, jangan dihapus
✅ data/knowledge/*.txt - Knowledge base, update manual
🤖 Telegram Control Panel Commands

| Perintah | Deskripsi |
|----------|-----------|
| `/menu` | Lihat semua perintah |
| `/status` | Status koneksi WA |
| `/qr` | Dapatkan QR code scan ulang di Telegram |
| `/kb` | Lihat daftar knowledge base |
| `/kb_add [nama.txt]` | Tambah/update KB (kirim isi setelah perintah) |
| `/kb_del [nama.txt]` | Hapus file KB |
| `/ongkir [nota] [nominal]` | Set ongkir & kirim final nota ke customer (dukung `/ongkirBR0827-001 15000` tanpa spasi) |
| `/lunas [nota]` | Verifikasi pembayaran & notif ke customer |
| `/pending` | Lihat semua order aktif |
| `/logs` | Log hari ini |
| `/stats` | Statistik bot |

🔐 Environment Variables (.env)
bash
1234567891011121314151617181920212223
🐳 Docker Configuration
docker-compose.yml
yaml
123456789101112131415161718192021222324252627282930
Dockerfile
dockerfile
1234567891011121314151617181920212223
📝 Knowledge Base Format
File .txt di folder data/knowledge/ dengan format:
12345678
Bot akan search keyword di file .txt sebelum forward ke AI.
🚀 Deployment Workflow
Development (Laptop Windows)
bash
1234567891011121314151617
Production (STB Armbian)
bash
1234567891011121314151617181920
Update Production
bash
1234
🧪 Testing Checklist
Bot bisa scan QR code dan login
Session persistent setelah restart
Bot bisa terima dan balas pesan teks
Bot bisa download image (nota pembayaran)
Bot REJECT audio/video/sticker
Integrasi 9router AI berjalan (test dengan pertanyaan kompleks)
Knowledge base search berfungsi
Flow order processing berjalan (PESAN → SUMMARY → YA)
Bot generate nota & kirim ke Telegram admin
Admin bisa /ongkir & /lunas dari Telegram
Final nota dikirim ke customer (produk + ongkir + cara bayar)
3-hour deadline expire otomatis (setiap 5 menit check)
Telegram control panel: /menu /status /kb /logs /stats /pending
Auto-delete image setelah transaksi selesai
QRIS image tidak pernah terhapus
Logs tercatat dengan baik
Docker container tidak exceed 256MB RAM
Bot tetap running setelah STB restart
🐛 Troubleshooting
Bot tidak bisa connect WA
Check folder data/sessions/ ada dan writable
Delete data/sessions/ dan scan QR ulang
9router API error
Check 9router running: docker ps | grep 9router
Test API: curl http://localhost:20128/v1/models -H "Authorization: Bearer YOUR_API_KEY"
Check network: bot dan 9router harus di Docker network yang sama
Memory limit exceeded
Check logs: docker stats wa-bot-stb
Kurangi concurrent connections
Optimize knowledge base size
Image tidak terhapus
Check cronjob atau scheduler di media-manager.js
Manual delete: rm data/media/receipts/*.jpg
📊 Monitoring
bash
1234567891011
🔒 Security Notes
Jangan commit .env ke GitHub - sudah ada di .gitignore
Jangan commit data/sessions/ - berisi auth token WA
Rotate API key 9router secara berkala
Limit file upload size untuk mencegah DoS
Validate semua input dari user (sanitasi)
📚 Resources
Baileys Documentation
9router Documentation
Docker Node.js Best Practices
🤝 Support
Untuk pertanyaan atau issue, silakan buat issue di GitHub repository ini.
Last Updated: 2026-08-27
Version: 1.0.0
Author: AI Assistant + Cline"# wa-stb" 
