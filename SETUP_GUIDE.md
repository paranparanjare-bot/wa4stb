# 🤖 WA-STB Bot - Complete Setup Guide

Complete guide to install, configure, and run the WhatsApp CS Bot from start to production.

---

## 📋 System Requirements

Before you begin, ensure you have:

- **Windows 10/11**, **macOS**, or **Linux**
- **Node.js v18 or higher** (Download: https://nodejs.org/)
- **Stable internet connection**
- **WhatsApp number** for the bot to use
- **Telegram account** for admin authentication
- **Telegram Bot Token** (create via @BotFather)

---

## 🚀 Step 1: Initial Installation

### A. Extract Project Files

1. Extract the `wa4stb` folder to an accessible location:
   - Windows: `C:\WhatsApp-Bot` or similar
   - Mac/Linux: `/Users/username/wa-bot` or similar

2. Open Command Prompt or Terminal in the project folder

### B. Install Dependencies

Run the installation command:

```bash
npm install
```

Wait for completion (usually 2-3 minutes depending on internet speed).

---

## 🔐 Step 2: Telegram Admin Setup

The bot uses Telegram for secure admin authentication. Follow these steps:

### A. Create Telegram Bot

1. Open Telegram and find `@BotFather`
2. Send `/start`
3. Send `/newbot` and follow the instructions
4. **Save the Bot Token** (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### B. Get Your Telegram User ID

1. Find `@userinfobot` on Telegram
2. Send `/start`
3. The bot will show your **User ID** (example: `788284460`)
4. **Save this User ID**

### C. Register Admin

1. Open `http://localhost:3000` in your browser
2. You'll see the **Register Admin** page
3. Enter:
   - **Telegram Bot Token**: From step A
   - **Telegram User ID**: From step B
4. Click **Save & Continue to OTP Login**

---

## 📝 Step 3: Setup Wizard - Business Configuration

After registration, you'll log in with OTP. The wizard guides you through 4 steps:

### A. Request OTP

1. Enter your Telegram User ID
2. Click **Generate OTP**
3. Check your Telegram - you'll receive a 6-digit code
4. Enter the code and click **Verify**

### B. Step 1: Business Information

Fill in your business details:

| Field | Example |
|-------|---------|
| Business Name | Bumbu Betutu Store |
| Full Address | Jl. Education No. 123, Banyuwangi |
| WhatsApp Number | 08123456789 |
| Operating Hours | 08:00 - 17:00 |

Click **Next →**

### C. Step 2: Products & Services

| Field | Example |
|-------|---------|
| Product/Service Type | Spice Mixes, Cooking Ingredients |
| Price Range | Rp 20,000 - 50,000 per package |
| Delivery Area | Entire Banyuwangi, Surrounding Districts |

Click **Next →**

### D. Step 3: Payment Methods

Select which payment methods you accept:

- ✓ Bank Transfer
- ✓ QRIS
- ✓ Cash
- □ E-Wallets (GoPay/OVO/Dana)

Optional: Add payment notes, then click **Next →**

### E. Step 4: FAQ Builder

Create a list of frequently asked questions. The wizard provides 3 default examples that you can:

- **Edit** the answers to match your business
- **Add** new questions using "+ Add Question" button
- **Remove** questions you don't need

**Good FAQ Examples:**

| Question | Answer |
|----------|--------|
| Do you offer bulk discounts? | For bulk purchases, please contact us via WhatsApp for special offers |
| What's the delivery time? | Typically 1-3 business days depending on location |
| Is there a warranty? | All products are authentic and guaranteed quality |
| Are you available on weekends? | We're open Monday-Friday 08:00-17:00 |

Click **✅ Complete Setup** when done.

---

## ▶️ Step 4: Run the Bot

### A. Start the System

In your terminal/command prompt, run:

```bash
npm start
```

You should see output like:

```
[INFO] [admin-server] Admin portal running at http://localhost:3000/admin
[INFO] [wa-handler] WhatsApp connected!
```

### B. Scan WhatsApp QR Code

1. Go to **http://localhost:3000/admin**
2. Click **Generate QR** button
3. Scan the QR code with the WhatsApp number you want to use for the bot
4. Wait for status to show **"WhatsApp connected!"**

### C. Test the Bot

1. Message your bot from another WhatsApp account
2. Send "Menu" or "Hello"
3. Bot should respond with your business menu
4. Try asking questions from your FAQ

---

## 🎛️ Step 5: Admin Dashboard

Access **http://localhost:3000/admin** to manage your bot:

### A. Bot Controls

- **Start Bot** - Activate WhatsApp connection
- **Stop Bot** - Deactivate bot (won't receive messages)
- **Generate QR** - Rescan if connection is lost
- **Reset WA Session** - Clear session if changing numbers

### B. Configuration

**AI Gateway** (optional):
- Configure if you have an external AI API
- Bot works fine with KB only if no AI is configured

**Telegram**:
- Update Bot Token and User ID if needed

**Business Profile & KB**:
- Edit your business information anytime
- Changes take effect immediately

**Knowledge Base**:
- Add or edit FAQ files
- Format: `Q: [question]` / `A: [answer]`

### C. Maintenance

- **Delete Log** - Clear daily logs
- **Delete Session** - Reset WhatsApp session (for troubleshooting)

---

## 🔍 Troubleshooting

### ❌ Bot Not Connecting to WhatsApp

**Solution:**
1. Check internet connection
2. Click **Generate QR** and rescan
3. If still failing, click **Reset WA Session** and scan new QR
4. Ensure WhatsApp number isn't logged in elsewhere

### ❌ OTP Not Received in Telegram

**Solution:**
1. Verify Bot Token and User ID are correct
2. Check Telegram inbox thoroughly
3. Click **Generate OTP** again

### ❌ Bot Not Responding to Messages

**Solution:**
1. Check Admin Dashboard - status should be "WhatsApp connected!"
2. Click **Start Bot** if status is offline
3. Bot only replies to group mentions in groups

### ❌ KB Changes Not Taking Effect

**Solution:**
1. KB reloads automatically, but you can restart:
   - Click **Stop Bot**
   - Wait 3 seconds
   - Click **Start Bot**

### ❌ WhatsApp Number Logged Out

**Solution:**
1. Click **Reset WA Session**
2. Scan new QR code
3. If persistent, check if number is logged in elsewhere

---

## 💡 Best Practices

### For Best Results

1. **Quality FAQ = Smarter Bot**
   - Add genuinely common questions
   - Write clear, professional answers
   - Update FAQ monthly

2. **Complete Business Info = Happy Customers**
   - Keep address, hours, contact always current
   - Update immediately if anything changes

3. **Monitor via Telegram**
   - Bot sends order notifications to Telegram
   - Receive real-time status updates

4. **Regular Backups**
   - Save FAQ and profile copies
   - Backup the `data/knowledge` folder regularly

### Operation Modes

| Mode | Command | Use Case |
|------|---------|----------|
| **Admin Mode** | `npm start` | Default - admin panel + bot |
| **Bot Only** | `npm start -- --bot-only` | Bot without admin panel |

---

## 📞 Support

If you encounter issues:

1. **Check Admin Panel Logs**
   - Click **Delete Log** to refresh
   - Check `/logs` folder for details

2. **Restart Bot**
   - Most issues resolve with restart
   - Stop Bot → wait 3 seconds → Start Bot

3. **Contact Support**
   - Reach out to developer via Telegram
   - Include screenshots of errors from Admin Panel

---

## ✅ Pre-Launch Checklist

- [ ] Node.js v18+ installed
- [ ] Project folder extracted
- [ ] `npm install` completed
- [ ] Telegram Bot Token obtained
- [ ] Telegram User ID noted
- [ ] Admin registration complete
- [ ] Setup Wizard completed
- [ ] `npm start` running without errors
- [ ] WhatsApp QR scanned
- [ ] Status shows "WhatsApp connected!"
- [ ] Test message received successfully
- [ ] FAQ customized for your business
- [ ] Admin Dashboard accessible at http://localhost:3000/admin

---

**Congratulations! Your bot is ready to serve customers! 🎉**

For advanced features, contact support.

---

*Documentation for WA-STB Bot v1.0.0*
