# Deploy টেসলাবন্ধু on your own domain

You need: (a) hosting that can run **Node.js 22.5+** (a VPS, Render, Railway or Fly.io), (b) a domain, (c) an SMS account.
> Plain PHP/cPanel shared hosting cannot run this unless it offers "Setup Node.js App" with Node ≥ 22.5. If not, use one of the options below.

## 0. Put the code on GitHub
```bash
unzip teslabondhu.zip && cd teslabondhu
git init && git add . && git commit -m "TeslaBondhu" && git branch -M main
git remote add origin https://github.com/YOU/teslabondhu.git && git push -u origin main
```

## Option A — Render (easiest, HTTPS included)
1. render.com → New → **Blueprint** → pick the repo (uses `render.yaml`; SECRET/ADMIN_KEY are auto-generated, 1 GB disk keeps the database). A paid instance is needed for the persistent disk.
2. Dashboard → Environment: set `SMS_PROVIDER` (+ Twilio or `SMS_URL` vars). Read `ADMIN_KEY` here for `/admin.html`.
3. Settings → **Custom Domains** → add `yourdomain.com`, then create the DNS records Render shows (CNAME/A) at your registrar. HTTPS is issued automatically.

## Option B — Any VPS (Ubuntu) with Docker + auto-HTTPS
1. Point DNS **A records** for `yourdomain.com` and `www` to the server IP.
2. `git clone` the repo on the server, then `cp .env.example .env` and edit it (DOMAIN, SECRET, ADMIN_KEY, SMS).
3. `docker compose up -d --build` — Caddy fetches the HTTPS certificate by itself. Open `https://yourdomain.com`.
4. Update later: `git pull && docker compose up -d --build`. Backup: copy the `appdata` volume (`teslabondhu.db`).

## Option C — VPS without Docker
Install Node 22 → `cp .env.example .env` → `npm i -g pm2` → `pm2 start ecosystem.config.js && pm2 save && pm2 startup` → nginx with `nginx.conf.example` + `certbot --nginx`.

## SMS (required for sign-up)
- **Twilio:** `SMS_PROVIDER=twilio`, `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`.
- **Bangladeshi gateway** (any that sends via a URL): `SMS_PROVIDER=http`, `SMS_URL=https://…?key=KEY&to={to}&msg={msg}`. Check your gateway's docs for the exact URL; Bangla text may require unicode/`type=unicode` in the URL.
- Until SMS works, nobody can register in production mode. To test first, run with `NODE_ENV` unset and `SMS_PROVIDER=console`.

## Go-live checklist
- [ ] `https://yourdomain.com/api/health` returns `{"ok":true}`
- [ ] Register with a real phone → SMS arrives → login works → "forgot password" works
- [ ] Route page → "আমার অবস্থান" (browser asks for location; needs HTTPS)
- [ ] `/admin.html` opens with `ADMIN_KEY`
- [ ] `DEMO_BOTS=0` when real riders are on board
- [ ] Back up the database file regularly
