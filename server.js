// টেসলাবন্ধু backend: zero npm dependencies. Requires Node >= 22.5 (built-in node:sqlite).
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
try { for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {} // optional .env
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'teslabondhu.db');
const SECRET = process.env.SECRET || 'dev-secret-change-me';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const BOTS = process.env.DEMO_BOTS !== '0';
const PROD = process.env.NODE_ENV === 'production';
if (PROD && (SECRET === 'dev-secret-change-me' || SECRET.length < 24)) { console.error('FATAL: set SECRET (24+ random chars) in production'); process.exit(1) }
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim(); // behind Caddy/nginx/Render the proxy sets x-forwarded-for
const otpIps = new Map();
const SMS = { provider: process.env.SMS_PROVIDER || 'console', sid: process.env.TWILIO_SID, token: process.env.TWILIO_TOKEN, from: process.env.TWILIO_FROM, url: process.env.SMS_URL };
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, phone TEXT UNIQUE, gender TEXT, pass TEXT, demo INTEGER DEFAULT 0, created INTEGER);
CREATE TABLE IF NOT EXISTS places(name TEXT PRIMARY KEY, kind TEXT, x INTEGER, y INTEGER);
CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY, user_id INTEGER, from_place TEXT, to_place TEXT, time TEXT, pref TEXT, status TEXT DEFAULT 'open', created INTEGER);
CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY, req_a INTEGER, req_b INTEGER, user_a INTEGER, user_b INTEGER, acc_a INTEGER DEFAULT 0, acc_b INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', score INTEGER, dist INTEGER, dm INTEGER, animal_a TEXT, animal_b TEXT, fare INTEGER, created INTEGER);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, match_id INTEGER, reporter INTEGER, reason TEXT, created INTEGER);`);
db.exec(`CREATE TABLE IF NOT EXISTS otps(phone TEXT PRIMARY KEY, h TEXT, exp INTEGER, tries INTEGER DEFAULT 0, sent INTEGER);
CREATE TABLE IF NOT EXISTS locations(match_id INTEGER, user_id INTEGER, lat REAL, lng REAL, ts INTEGER, PRIMARY KEY(match_id,user_id));`);
for (const a of ['ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0','ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0','ALTER TABLE places ADD COLUMN lat REAL','ALTER TABLE places ADD COLUMN lng REAL',"ALTER TABLE reports ADD COLUMN status TEXT DEFAULT 'open'"]) try { db.exec(a) } catch {}
const PLACES = [['মিরপুর ১০','from',70,70,23.8069,90.3687],['মিরপুর ১১','from',55,45,23.8183,90.3653],['মিরপুর ১২','from',40,30,23.8280,90.3640],['ফার্মগেট','to',250,220,23.7561,90.3872],['কারওয়ান বাজার','to',275,238,23.7513,90.3936],['উত্তরা','to',200,20,23.8759,90.3795]];
for (const p of PLACES) { db.prepare('INSERT OR IGNORE INTO places(name,kind,x,y) VALUES(?,?,?,?)').run(...p.slice(0, 4)); db.prepare('UPDATE places SET lat=?,lng=? WHERE name=?').run(p[4], p[5], p[0]) }
const ANIMALS = ['জেব্রা','বাঘ','হাতি','সিংহ','ময়ূর','হরিণ','ডলফিন'], EMO = { 'জেব্রা':'🦓','বাঘ':'🐯','হাতি':'🐘','সিংহ':'🦁','ময়ূর':'🦚','হরিণ':'🦌','ডলফিন':'🐬' };
const BOT_NAMES = [['রাফি আহমেদ','01712345678','male'],['তানিয়া ইসলাম','01812345679','female'],['সাকিব হাসান','01912345680','male']];
for (const [n, p, g] of BOT_NAMES) db.prepare('INSERT OR IGNORE INTO users(name,phone,gender,pass,demo,created) VALUES(?,?,?,?,1,?)').run(n, p, g, 'x', Date.now());

const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
const checkPw = (pw, h) => { const [s, k] = h.split(':'); return k && crypto.timingSafeEqual(Buffer.from(k, 'hex'), crypto.scryptSync(pw, s, 32)); };
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const makeToken = id => { const b = id + '.' + (Date.now() + 7 * 864e5); return b + '.' + sign(b); };
function auth(req) {
  const [id, exp, sig] = (req.headers.authorization || '').replace('Bearer ', '').split('.');
  if (!sig || sig !== sign(id + '.' + exp) || +exp < Date.now()) return null;
  return db.prepare('SELECT id,name,phone,gender FROM users WHERE id=? AND demo=0 AND banned=0').get(+id) || null;
}
const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const hav = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)) };
function km(a, b) { const A = db.prepare('SELECT lat,lng FROM places WHERE name=?').get(a), B = db.prepare('SELECT lat,lng FROM places WHERE name=?').get(b); return hav(A.lat, A.lng, B.lat, B.lng) * 1.3 } // road factor 1.3
const fails = new Map();
async function sendSms(phone, text) {
  const to = '+88' + phone;
  if (SMS.provider === 'twilio') {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SMS.sid}/Messages.json`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(SMS.sid + ':' + SMS.token).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: to, From: SMS.from, Body: text }) });
    if (!r.ok) throw [502, 'SMS পাঠানো যায়নি'];
  } else if (SMS.provider === 'http') { // generic gateway, e.g. SMS_URL=https://gw.example/send?key=K&to={to}&msg={msg}
    const r = await fetch(SMS.url.replace('{to}', encodeURIComponent(phone)).replace('{msg}', encodeURIComponent(text)));
    if (!r.ok) throw [502, 'SMS পাঠানো যায়নি'];
  } else console.log('[SMS console]', to, text);
}
const otpHash = (p, c) => sign('otp' + p + c);
function checkOtp(phone, code) {
  const o = db.prepare('SELECT * FROM otps WHERE phone=?').get(phone);
  if (!o || o.exp < Date.now() || o.tries >= 5) throw [400, 'কোডের মেয়াদ শেষ; নতুন কোড নিন'];
  db.prepare('UPDATE otps SET tries=tries+1 WHERE phone=?').run(phone);
  if (o.h !== otpHash(phone, String(code || '').trim())) throw [400, 'কোড ভুল'];
  db.prepare('DELETE FROM otps WHERE phone=?').run(phone);
}
const isAdmin = req => { const k = String(req.headers['x-admin-key'] || ''); return !!ADMIN_KEY && k.length === ADMIN_KEY.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(ADMIN_KEY)) };

function findMatch(r, user) {
  const others = db.prepare(`SELECT r.*,u.gender g FROM requests r JOIN users u ON u.id=r.user_id WHERE r.status='open' AND r.user_id!=? AND r.to_place=? AND u.demo=0 AND r.created>?`).all(r.user_id, r.to_place, Date.now() - 72e5);
  const cand = others.find(o => Math.abs(toMin(o.time) - toMin(r.time)) <= 30 && (r.pref === 'যে কেউ' || o.g === user.gender) && (o.pref === 'যে কেউ' || o.pref === 'একই লিঙ্গ' && o.g === user.gender));
  let req_b = null, user_b = null;
  if (cand) { req_b = cand.id; user_b = cand.user_id; }
  else if (BOTS && r.to_place !== 'উত্তরা') { // demo bot rider, disable with DEMO_BOTS=0
    const bot = db.prepare('SELECT * FROM users WHERE demo=1 ORDER BY RANDOM() LIMIT 1').get();
    user_b = bot.id;
    req_b = db.prepare('INSERT INTO requests(user_id,from_place,to_place,time,pref,status,created) VALUES(?,?,?,?,?,?,?)').run(bot.id, r.from_place, r.to_place, r.time, 'যে কেউ', 'matched', Date.now()).lastInsertRowid;
  } else return null;
  const f = Math.round(km(r.from_place, r.to_place) * 25), score = 88 + rnd(9);
  const [a1, a2] = [pick(ANIMALS), pick(ANIMALS)];
  const m = db.prepare('INSERT INTO matches(req_a,req_b,user_a,user_b,score,dist,dm,animal_a,animal_b,fare,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(r.id, req_b, r.user_id, user_b, score, 80 + rnd(300), 3 + rnd(9), a1, a2, f, Date.now()).lastInsertRowid;
  db.prepare("UPDATE requests SET status='matched' WHERE id IN (?,?)").run(r.id, req_b);
  return m;
}
function view(m, uid) { // privacy: other side's name/phone only after BOTH accepted
  const a = m.user_a === uid, other = db.prepare('SELECT name,phone FROM users WHERE id=?').get(a ? m.user_b : m.user_a);
  const rq = db.prepare('SELECT from_place,to_place,time FROM requests WHERE id=?').get(m.req_a);
  const open = m.status === 'active' || m.status === 'done';
  const an = a ? m.animal_b : m.animal_a;
  return { id: m.id, status: m.status, score: m.score, dist: m.dist, dm: m.dm, fare: m.fare, share: Math.round(m.fare / 2), animal: an, emoji: EMO[an], anon: 'ক্রম #' + (10 + m.id % 89), mine: a ? m.acc_a : m.acc_b, theirs: a ? m.acc_b : m.acc_a, ...rq, other: open ? other : null };
}
function settle(m) {
  m = db.prepare('SELECT * FROM matches WHERE id=?').get(m.id);
  if (m.status !== 'pending') return;
  if (m.acc_a === -1 || m.acc_b === -1) { db.prepare("UPDATE matches SET status='rejected' WHERE id=?").run(m.id); db.prepare("UPDATE requests SET status='cancelled' WHERE id IN (?,?)").run(m.req_a, m.req_b); }
  else if (m.acc_a === 1 && m.acc_b === 1) db.prepare("UPDATE matches SET status='active' WHERE id=?").run(m.id);
}

const routes = {
  'POST /api/register': (q, b) => {
    const name = String(b.name || '').trim(), phone = String(b.phone || '').trim(), pw = String(b.password || '');
    if (name.length < 2 || !/^01[3-9]\d{8}$/.test(phone) || pw.length < 6 || !['male', 'female'].includes(b.gender)) throw [400, 'নাম, সঠিক মোবাইল নম্বর (01XXXXXXXXX), লিঙ্গ ও ৬+ অক্ষরের পাসওয়ার্ড দিন'];
    if (db.prepare('SELECT 1 FROM users WHERE phone=?').get(phone)) throw [409, 'এই নম্বর দিয়ে আগেই অ্যাকাউন্ট আছে'];
    checkOtp(phone, b.otp);
    const id = db.prepare('INSERT INTO users(name,phone,gender,pass,verified,created) VALUES(?,?,?,?,1,?)').run(name, phone, b.gender, hashPw(pw), Date.now()).lastInsertRowid;
    return { token: makeToken(id), user: { id, name, phone, gender: b.gender } };
  },
  'POST /api/login': (q, b, req) => {
    const ip = ipOf(req), f = fails.get(ip) || 0;
    if (f >= 8) throw [429, 'অনেকবার ভুল হয়েছে, কিছুক্ষণ পরে চেষ্টা করুন'];
    const u = db.prepare('SELECT * FROM users WHERE phone=? AND demo=0').get(String(b.phone || ''));
    if (u && u.banned) throw [403, 'এই অ্যাকাউন্ট স্থগিত করা হয়েছে'];
    if (!u || !checkPw(String(b.password || ''), u.pass)) { fails.set(ip, f + 1); setTimeout(() => fails.delete(ip), 6e5).unref(); throw [401, 'নম্বর বা পাসওয়ার্ড ভুল'] }
    fails.delete(ip);
    return { token: makeToken(u.id), user: { id: u.id, name: u.name, phone: u.phone, gender: u.gender } };
  },
  'POST /api/otp/send': async (q, b, req) => {
    const phone = String(b.phone || '').trim(), reset = b.purpose === 'reset', ip = ipOf(req), n = otpIps.get(ip) || 0;
    if (!/^01[3-9]\d{8}$/.test(phone)) throw [400, 'সঠিক মোবাইল নম্বর দিন'];
    if (n >= 10) throw [429, 'অনেক বেশি অনুরোধ; পরে চেষ্টা করুন'];
    otpIps.set(ip, n + 1); setTimeout(() => otpIps.delete(ip), 36e5).unref();
    const exists = db.prepare('SELECT 1 FROM users WHERE phone=? AND demo=0').get(phone);
    if (!reset && exists) throw [409, 'এই নম্বর দিয়ে আগেই অ্যাকাউন্ট আছে'];
    if (reset && !exists) throw [404, 'এই নম্বরে অ্যাকাউন্ট নেই'];
    const old = db.prepare('SELECT sent FROM otps WHERE phone=?').get(phone);
    if (old && Date.now() - old.sent < 60000) throw [429, '১ মিনিট পর আবার চেষ্টা করুন'];
    const code = String(crypto.randomInt(100000, 1000000));
    db.prepare('INSERT OR REPLACE INTO otps(phone,h,exp,tries,sent) VALUES(?,?,?,0,?)').run(phone, otpHash(phone, code), Date.now() + 3e5, Date.now());
    await sendSms(phone, `টেসলাবন্ধু কোড: ${code} (৫ মিনিট বৈধ)`);
    return { ok: true, ...(SMS.provider === 'console' && !PROD ? { devCode: code } : {}) };
  },
  'POST /api/password/reset': (q, b) => {
    const phone = String(b.phone || '').trim(), pw = String(b.password || '');
    if (pw.length < 6) throw [400, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর'];
    if (!db.prepare('SELECT 1 FROM users WHERE phone=? AND demo=0').get(phone)) throw [404, 'এই নম্বরে অ্যাকাউন্ট নেই'];
    checkOtp(phone, b.otp);
    db.prepare('UPDATE users SET pass=? WHERE phone=?').run(hashPw(pw), phone); return { ok: 1 };
  },
  'GET /api/nearest': q => {
    const lat = +q.lat, lng = +q.lng; if (!isFinite(lat) || !isFinite(lng)) throw [400, 'অবস্থান সঠিক নয়'];
    const all = db.prepare("SELECT name,lat,lng FROM places WHERE kind='from'").all().map(p => ({ name: p.name, m: Math.round(hav(lat, lng, p.lat, p.lng) * 1000) })).sort((a, b) => a.m - b.m);
    return { place: all[0].name, meters: all[0].m, inArea: all[0].m <= 8000 };
  },
  'GET /api/me': (q, b, req, u) => u,
  'GET /api/places': () => db.prepare('SELECT name,kind,x,y FROM places').all(),
  'GET /api/fare': (q) => { const k = km(q.from, q.to); return { km: +k.toFixed(1), fare: Math.round(k * 25), share: Math.round(k * 12.5) } },
  'POST /api/requests': (q, b, req, u) => {
    const ok = n => db.prepare('SELECT 1 FROM places WHERE name=?').get(n);
    if (!ok(b.from) || !ok(b.to) || !/^\d\d:\d\d$/.test(b.time) || !['যে কেউ', 'একই লিঙ্গ'].includes(b.pref)) throw [400, 'রুট, সময় বা পছন্দ সঠিক নয়'];
    db.prepare("UPDATE requests SET status='cancelled' WHERE user_id=? AND status='open'").run(u.id);
    const id = db.prepare('INSERT INTO requests(user_id,from_place,to_place,time,pref,created) VALUES(?,?,?,?,?,?)').run(u.id, b.from, b.to, b.time, b.pref, Date.now()).lastInsertRowid;
    const mid = findMatch(db.prepare('SELECT * FROM requests WHERE id=?').get(id), u);
    return { requestId: id, matchId: mid };
  },
  'GET /api/active': (q, b, req, u) => { // current request / match for resuming
    const m = db.prepare("SELECT * FROM matches WHERE (user_a=? OR user_b=?) AND status IN ('pending','active') ORDER BY id DESC").get(u.id, u.id);
    if (m) return { match: view(m, u.id) };
    const r = db.prepare("SELECT * FROM requests WHERE user_id=? AND status='open'").get(u.id);
    return { request: r || null };
  },
  'DELETE /api/requests': (q, b, req, u) => { db.prepare("UPDATE requests SET status='cancelled' WHERE user_id=? AND status='open'").run(u.id); return { ok: 1 } },
  'GET /api/history': (q, b, req, u) => db.prepare("SELECT * FROM matches WHERE (user_a=? OR user_b=?) ORDER BY id DESC LIMIT 30").all(u.id, u.id).map(m => view(m, u.id)),
  'POST /api/reports': (q, b, req, u) => {
    const m = db.prepare('SELECT * FROM matches WHERE id=? AND (user_a=? OR user_b=?)').get(+b.matchId, u.id, u.id);
    if (!m || String(b.reason || '').trim().length < 3) throw [400, 'রিপোর্টের কারণ লিখুন'];
    db.prepare('INSERT INTO reports(match_id,reporter,reason,created) VALUES(?,?,?,?)').run(m.id, u.id, String(b.reason).slice(0, 500), Date.now());
    return { ok: 1 };
  },
  'GET /api/health': () => ({ ok: true })
};
function matchAction(m, u, act) {
  const a = m.user_a === u.id, col = a ? 'acc_a' : 'acc_b';
  if (act === 'accept' || act === 'reject') {
    if (m.status !== 'pending') throw [409, 'এই প্রস্তাব আর সক্রিয় নেই'];
    db.prepare(`UPDATE matches SET ${col}=? WHERE id=?`).run(act === 'accept' ? 1 : -1, m.id);
    const bot = db.prepare('SELECT demo FROM users WHERE id=?').get(a ? m.user_b : m.user_a).demo;
    if (bot && act === 'accept') setTimeout(() => { db.prepare(`UPDATE matches SET ${a ? 'acc_b' : 'acc_a'}=1 WHERE id=? AND status='pending'`).run(m.id); settle(m) }, 1800);
  } else if (act === 'complete' || act === 'cancel') {
    if (m.status !== 'active') throw [409, 'রাইড সক্রিয় নয়'];
    db.prepare('UPDATE matches SET status=? WHERE id=?').run(act === 'complete' ? 'done' : 'cancelled', m.id); db.prepare('DELETE FROM locations WHERE match_id=?').run(m.id);
  } else throw [404, 'unknown'];
  settle(m);
  return view(db.prepare('SELECT * FROM matches WHERE id=?').get(m.id), u.id);
}
function admin(method, p, b) {
  let m;
  if (method === 'GET' && p === 'stats') return { users: db.prepare('SELECT COUNT(*) n FROM users WHERE demo=0').get().n, requests: db.prepare('SELECT COUNT(*) n FROM requests').get().n, matches: db.prepare('SELECT COUNT(*) n FROM matches').get().n, active: db.prepare("SELECT COUNT(*) n FROM matches WHERE status='active'").get().n, done: db.prepare("SELECT COUNT(*) n FROM matches WHERE status='done'").get().n, openReports: db.prepare("SELECT COUNT(*) n FROM reports WHERE status='open'").get().n };
  if (method === 'GET' && p === 'reports') return db.prepare('SELECT r.*,u.name reporter_name,u.phone reporter_phone FROM reports r LEFT JOIN users u ON u.id=r.reporter ORDER BY r.id DESC LIMIT 200').all();
  if (method === 'GET' && p === 'users') return db.prepare('SELECT id,name,phone,gender,verified,banned,created FROM users WHERE demo=0 ORDER BY id DESC LIMIT 200').all();
  if (method === 'GET' && p === 'matches') return db.prepare('SELECT id,user_a,user_b,status,score,fare,created FROM matches ORDER BY id DESC LIMIT 200').all();
  if (method === 'POST' && (m = p.match(/^reports\/(\d+)\/resolve$/))) { db.prepare("UPDATE reports SET status='resolved' WHERE id=?").run(+m[1]); return { ok: 1 } }
  if (method === 'POST' && (m = p.match(/^users\/(\d+)\/ban$/))) { db.prepare('UPDATE users SET banned=? WHERE id=? AND demo=0').run(b.banned ? 1 : 0, +m[1]); return { ok: 1 } }
  throw [404, 'not found'];
}
function location(m, u, method, b) {
  if (method === 'POST') {
    if (m.status !== 'active') throw [409, 'রাইড সক্রিয় নয়'];
    if (b.stop) { db.prepare('DELETE FROM locations WHERE match_id=? AND user_id=?').run(m.id, u.id); return { ok: 1 } }
    const lat = +b.lat, lng = +b.lng; if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw [400, 'অবস্থান সঠিক নয়'];
    db.prepare('INSERT OR REPLACE INTO locations VALUES(?,?,?,?,?)').run(m.id, u.id, lat, lng, Date.now()); return { ok: 1 };
  }
  if (m.status !== 'active') return { loc: null };
  const o = db.prepare('SELECT lat,lng,ts FROM locations WHERE match_id=? AND user_id=? AND ts>?').get(m.id, m.user_a === u.id ? m.user_b : m.user_a, Date.now() - 12e4);
  return { loc: o || null }; // only the matched partner, only while ride is active, only if fresh (<2 min)
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const send = (res, code, obj, type = 'application/json; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Permissions-Policy': 'geolocation=(self)', 'Cache-Control': type.startsWith('application/json') ? 'no-store' : 'no-cache', ...(PROD ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}) }); res.end(typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj)) };

const server = http.createServer((req, res) => {
  if (process.env.FORCE_HTTPS === '1' && req.headers['x-forwarded-proto'] === 'http' && req.url !== '/api/health') { res.writeHead(301, { Location: 'https://' + req.headers.host + req.url }); return res.end() }
  const url = new URL(req.url, 'http://x'), q = Object.fromEntries(url.searchParams);
  if (!url.pathname.startsWith('/api/')) {
    let f = path.normalize(path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname));
    if (!f.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(__dirname, 'public', 'index.html');
    return send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream');
  }
  let body = '';
  req.on('data', c => { body += c; if (body.length > 1e5) req.destroy() });
  req.on('end', async () => {
    try {
      let b = {}; if (body) { try { b = JSON.parse(body) } catch { throw [400, 'invalid JSON'] } }
      if (url.pathname.startsWith('/api/admin/')) { if (!isAdmin(req)) throw [403, 'forbidden']; return send(res, 200, admin(req.method, url.pathname.slice(11), b)) }
      const mm = url.pathname.match(/^\/api\/matches\/(\d+)\/(\w+)$/), mg = url.pathname.match(/^\/api\/matches\/(\d+)$/);
      const needAuth = !/^\/api\/(register|login|places|fare|health|otp|nearest|password)/.test(url.pathname);
      const u = needAuth ? auth(req) : null;
      if (needAuth && !u) throw [401, 'আগে লগইন করুন'];
      if (mm || mg) {
        const m = db.prepare('SELECT * FROM matches WHERE id=? AND (user_a=? OR user_b=?)').get(+(mm || mg)[1], u.id, u.id);
        if (!m) throw [404, 'পাওয়া যায়নি'];
        if (mm && mm[2] === 'location') return send(res, 200, location(m, u, req.method, b));
        return send(res, 200, mm && req.method === 'POST' ? matchAction(m, u, mm[2]) : view(m, u.id));
      }
      const h = routes[req.method + ' ' + url.pathname];
      if (!h) throw [404, 'not found'];
      send(res, 200, await h(q, b, req, u));
    } catch (e) { if (Array.isArray(e)) send(res, e[0], { error: e[1] }); else { console.error(e); send(res, 500, { error: 'সার্ভারে সমস্যা হয়েছে' }) } }
  });
}).listen(PORT, () => console.log('টেসলাবন্ধু running on http://localhost:' + PORT));
setInterval(() => { const n = Date.now(); db.prepare('DELETE FROM otps WHERE exp<?').run(n); db.prepare('DELETE FROM locations WHERE ts<?').run(n - 36e5); db.prepare("UPDATE requests SET status='cancelled' WHERE status='open' AND created<?").run(n - 108e5) }, 6e5).unref();
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => { db.close(); process.exit(0) }));
