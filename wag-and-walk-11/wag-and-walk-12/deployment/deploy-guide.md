# Wag & Walk — Deployment Guide

## Prerequisites

- Ubuntu 22.04 VPS (2 GB RAM minimum, e.g. DigitalOcean Droplet or AWS EC2 t3.small)
- Domain name pointing to your server IP
- MongoDB Atlas account (free tier works for launch)
- Stripe account (test keys for staging, live keys for production)
- Gmail account or SMTP service (e.g. SendGrid) for transactional email
- Node.js 20+ and npm installed

---

## 1 · Server setup

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx and certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Create app directory
sudo mkdir -p /var/www/wag-and-walk
sudo chown $USER:$USER /var/www/wag-and-walk
```

---

## 2 · Clone and install

```bash
cd /var/www/wag-and-walk
git clone https://github.com/your-org/wag-and-walk.git .
npm install --omit=dev
```

---

## 3 · Environment variables

```bash
cp .env.example .env
nano .env
```

Fill in every value. Critical fields:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random 64-char string — `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Stripe secret key (live: `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe dashboard → Webhooks |
| `CLIENT_URL` | `https://wagandwalk.com` |
| `EMAIL_USER` / `EMAIL_PASS` | SMTP credentials |

---

## 4 · Seed the database

```bash
NODE_ENV=production node database/seed-data.js
```

---

## 5 · Nginx config

```bash
sudo cp deployment/nginx.conf /etc/nginx/sites-available/wagandwalk
sudo ln -s /etc/nginx/sites-available/wagandwalk /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6 · SSL with Let's Encrypt

```bash
sudo certbot --nginx -d wagandwalk.com -d www.wagandwalk.com
# Follow prompts — certbot will auto-update your nginx config

# Auto-renew (runs twice daily)
sudo systemctl enable certbot.timer
```

---

## 7 · Process manager with PM2

```bash
npm install -g pm2

# Start the app
pm2 start backend/server.js --name wag-and-walk --env production

# Save so it restarts on reboot
pm2 save
pm2 startup systemd
# Run the command PM2 prints

# Useful commands
pm2 status         # view running apps
pm2 logs           # tail logs
pm2 restart all    # restart after deploy
pm2 monit          # live metrics
```

---

## 8 · Stripe webhook

1. Go to **Stripe Dashboard → Developers → Webhooks**
2. Add endpoint: `https://wagandwalk.com/api/payments/webhook`
3. Subscribe to events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `transfer.created`
4. Copy the **Signing Secret** → paste into `STRIPE_WEBHOOK_SECRET` in `.env`
5. Restart the app: `pm2 restart wag-and-walk`

---

## 9 · Docker deployment (alternative)

```bash
# Build
docker build -f deployment/dockerfile -t wag-and-walk:latest .

# Run
docker run -d \
  --name wag-and-walk \
  --env-file .env \
  -p 3000:3000 \
  --restart unless-stopped \
  wag-and-walk:latest

# Or with Docker Compose
cat > docker-compose.yml << 'EOF'
version: '3.9'
services:
  app:
    build:
      context: .
      dockerfile: deployment/dockerfile
    ports:
      - "3000:3000"
    env_file: .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      retries: 3
EOF

docker compose up -d
```

---

## 10 · Run tests

```bash
# Unit + integration tests
NODE_ENV=test npm test

# With coverage
npm run test:coverage
```

Add to `package.json` scripts:
```json
"test":           "jest --runInBand",
"test:coverage":  "jest --runInBand --coverage",
"test:watch":     "jest --watch"
```

---

## 11 · Ongoing deployments

```bash
# Pull latest code
cd /var/www/wag-and-walk
git pull origin main

# Install any new dependencies
npm install --omit=dev

# Restart app with zero-downtime reload
pm2 reload wag-and-walk

echo "Deploy complete ✅"
```

---

## Monitoring & Logs

```bash
# Application logs
pm2 logs wag-and-walk --lines 200

# Nginx access/error logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System health
htop
df -h
free -m
```

---

## Demo Accounts (after seed)

| Role   | Email                   | Password    |
|--------|-------------------------|-------------|
| Admin  | admin@wagandwalk.com    | Admin123!   |
| Walker | emma@example.com        | Walker123!  |
| Walker | marcus@example.com      | Walker123!  |
| Walker | sophia@example.com      | Walker123!  |
| Client | sarah@example.com       | Client123!  |
| Client | david@example.com       | Client123!  |
