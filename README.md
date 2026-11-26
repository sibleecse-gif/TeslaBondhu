# 🛺 টেসলাবন্ধু (TeslaBondhu)
ঢাকার জন্য রিকশা রাইড-শেয়ারিং: একই রুটের সহযাত্রী খুঁজুন, ভাড়া ভাগ করুন। দুজনেই রাজি হলে তবেই নাম ও ফোন নম্বর দেখা যায় (সার্ভার-সাইডে নিয়ন্ত্রিত)।

**Stack:** Node.js ≥ 22.5 (zero npm dependencies) · built-in SQLite (`node:sqlite`) · vanilla JS frontend.

## Run locally
```bash
node --no-warnings server.js     # http://localhost:3000
npm test                          # end-to-end API test
```

## Environment variables
| Name | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | 3000 |
| `SECRET` | token-signing secret — **set a long random value in production** | dev value |
| `DB_FILE` | SQLite path (use a persistent disk) | `./data/teslabondhu.db` |
| `ADMIN_KEY` | enables `GET /api/admin/reports` via header `x-admin-key` | disabled |
| `DEMO_BOTS` | `0` turns off simulated demo riders | on |
| `NODE_ENV` | set `production` so OTP codes are never returned in API responses | – |
| `SMS_PROVIDER` | `console` (dev: prints code), `twilio`, or `http` | console |
| `TWILIO_SID` `TWILIO_TOKEN` `TWILIO_FROM` | Twilio credentials when `SMS_PROVIDER=twilio` | – |
| `SMS_URL` | generic gateway URL when `SMS_PROVIDER=http`, e.g. `https://gw.example/send?key=KEY&to={to}&msg={msg}` (Bangladeshi gateways like BulkSMSBD / SSL Wireless work this way) | – |

## API (Bearer token auth)
`POST /api/otp/send` (`purpose: reset` for forgot-password) · `POST /api/password/reset` · `POST /api/register` (needs `otp`) · `GET /api/nearest?lat&lng` · `GET|POST /api/matches/:id/location` · admin (`x-admin-key` header): `GET /api/admin/{stats|reports|users|matches}`, `POST /api/admin/reports/:id/resolve`, `POST /api/admin/users/:id/ban` ·
`POST /api/login` · `POST /api/login` · `GET /api/me` · `GET /api/places` · `GET /api/fare?from&to` · `POST /api/requests` · `DELETE /api/requests` · `GET /api/active` · `GET /api/matches/:id` · `POST /api/matches/:id/{accept|reject|complete|cancel}` · `GET /api/history` · `POST /api/reports` · `GET /api/admin/reports` · `GET /api/health`

## Deploy (live)
**Full step-by-step for your domain: see [DEPLOY.md](DEPLOY.md)** (Render, Docker+Caddy auto-HTTPS, PM2+nginx).

**Render:** push to GitHub → Render → New → Blueprint → select repo (`render.yaml` is included; the disk keeps the database).
**Railway / Fly.io / any VPS:** use the `Dockerfile`, mount a volume at `/data`, set `SECRET`.

## Admin screen
Open `/admin.html` and enter `ADMIN_KEY`: stats, reports (resolve), users (ban/unban), matches.

## Phone OTP
Registration requires a 6-digit SMS code (5-minute expiry, 60 s resend cooldown, 5 attempts). **Production:** set `NODE_ENV=production` and an SMS provider; without one, OTP codes only print to the server log. **Live GPS:** "আমার অবস্থান" picks the nearest pickup point (service area 8 km); after both riders accept, each can opt in to live location sharing visible only to the partner, auto-cleared when the ride ends. GPS needs HTTPS (provided by Render/Railway).

## Notes
- Demo bots (রাফি, তানিয়া, সাকিব) let a single tester see the full match flow; with real users on the same route/time (±30 min) they are matched with each other first. Set `DEMO_BOTS=0` once you have real riders.
- Place list/coordinates are a small seeded Mirpur→Farmgate/Karwan Bazar/Uttara set (table `places`); add rows to extend.
- Before real launch: configure a real SMS provider, set `SECRET`/`ADMIN_KEY`, and consider Postgres if you need multiple instances.
