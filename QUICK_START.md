# ⚡ Quick Start - 5 Minutes to Bot Running

This is the fastest way to get your bot running.

## Prerequisites
- Node.js v18+ (https://nodejs.org/)
- Telegram account
- WhatsApp number

## 1️⃣ Get Telegram Credentials (2 min)

**Get Bot Token:**
1. Open Telegram → find @BotFather
2. Send `/newbot` and follow instructions
3. Copy the Bot Token

**Get Your User ID:**
1. Find @userinfobot on Telegram
2. Send `/start` 
3. Copy your User ID

## 2️⃣ Extract & Install (1 min)

```bash
# Extract wa4stb folder
cd wa4stb

# Install dependencies
npm install
```

## 3️⃣ Register Admin (1 min)

1. Open http://localhost:3000 in browser
2. Paste Bot Token and User ID
3. Click Save

## 4️⃣ Setup Wizard (1 min)

1. Login with OTP from Telegram (paste 6-digit code)
2. Fill 4-step setup wizard:
   - Business info
   - Products & pricing
   - Payment methods  
   - FAQ (edit the 3 defaults)
3. Click Complete

## 5️⃣ Run Bot

```bash
npm start
```

Wait for "WhatsApp connected!" message.

## Scan QR

1. Go to http://localhost:3000/admin
2. Click Generate QR
3. Scan with WhatsApp
4. Done!

---

**Send "Menu" to your bot - it should reply! 🎉**

---

For detailed setup guide, see [SETUP_GUIDE.md](SETUP_GUIDE.md) or [SETUP_GUIDE_ID.md](SETUP_GUIDE_ID.md)
