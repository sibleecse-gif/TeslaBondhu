const $ = id => document.getElementById(id), app = $('app');
let token = localStorage.getItem('tb_token'), user = JSON.parse(localStorage.getItem('tb_user') || 'null'), places = [], poll = null;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { logout(true); throw new Error(j.error) }
  if (!r.ok) throw new Error(j.error || 'ত্রুটি হয়েছে');
  return j;
}
const nav = h => { location.hash = h };
function logout(silent) { token = null; user = null; localStorage.removeItem('tb_token'); localStorage.removeItem('tb_user'); if (!silent) nav('#/'); route() }
function setAuth(r) { token = r.token; user = r.user; localStorage.setItem('tb_token', token); localStorage.setItem('tb_user', JSON.stringify(user)) }
const err = e => { const el = $('err'); if (el) el.textContent = e.message || e };
const card = (h, extra = '') => app.innerHTML = `<section class="art" ${extra}>${h}</section>`;

const pages = {
  '/'() { card(`<h2>ঢাকার জন্য রাইড-শেয়ারিং</h2><p>একই দিকে যাওয়া একজন বন্ধু খুঁজুন, রিকশা ভাড়া ভাগ করুন। দুজনেই রাজি না হওয়া পর্যন্ত নাম ও ফোন নম্বর গোপন থাকে।</p>
   ${user ? `<button onclick="nav('#/route')">রাইড খুঁজুন →</button> <button class="alt" onclick="nav('#/history')">আমার রাইড</button>` : `<div class="row"><button onclick="nav('#/login')">লগইন</button><button class="alt" onclick="nav('#/register')">নতুন অ্যাকাউন্ট</button></div>`}`) },
  async '/register'() {
    card(`<h2>নতুন অ্যাকাউন্ট</h2><label>নাম</label><input id="n"><label>মোবাইল (01XXXXXXXXX)</label><div class="row"><input id="p" inputmode="numeric" maxlength="11" style="flex:2"><button class="alt" id="otpb" onclick="sendOtp()" style="flex:1;white-space:nowrap">কোড পাঠান</button></div>
    <label>SMS কোড (৬ সংখ্যা)</label><input id="otp" inputmode="numeric" maxlength="6"><p class="small" id="otpmsg"></p><label>লিঙ্গ</label><select id="g"><option value="male">পুরুষ</option><option value="female">নারী</option></select><label>পাসওয়ার্ড (৬+ অক্ষর)</label><input id="pw" type="password"><p class="err" id="err"></p>
    <button onclick="doReg()">তৈরি করুন</button> <button class="alt" onclick="nav('#/login')">লগইন</button>`)
  },
  '/login'() {
    card(`<h2>লগইন</h2><label>মোবাইল নম্বর</label><input id="p" inputmode="numeric" maxlength="11"><label>পাসওয়ার্ড</label><input id="pw" type="password"><p class="err" id="err"></p>
    <button onclick="doLogin()">লগইন</button> <button class="alt" onclick="nav('#/register')">নতুন অ্যাকাউন্ট</button><p><a href="#/reset">পাসওয়ার্ড ভুলে গেছেন?</a></p>`)
  },
  '/reset'() {
    card(`<h2>পাসওয়ার্ড রিসেট</h2><label>মোবাইল নম্বর</label><div class="row"><input id="p" inputmode="numeric" maxlength="11" style="flex:2"><button class="alt" id="otpb" onclick="sendOtp('reset')" style="flex:1;white-space:nowrap">কোড পাঠান</button></div><label>SMS কোড</label><input id="otp" inputmode="numeric" maxlength="6"><p class="small" id="otpmsg"></p><label>নতুন পাসওয়ার্ড (৬+ অক্ষর)</label><input id="pw" type="password"><p class="err" id="err"></p><button onclick="doReset()">পাসওয়ার্ড বদলান</button> <button class="alt" onclick="nav('#/login')">লগইন</button>`)
  },
  async '/route'() {
    if (!places.length) places = await api('GET', '/api/places');
    const opt = k => places.filter(p => p.kind === k).map(p => `<option>${p.name}</option>`).join('');
    card(`<h2>🗺️ রুট বেছে নিন</h2><svg class="map" id="map" viewBox="0 0 360 300" role="img" aria-label="ঢাকার মানচিত্র"></svg>
    <div class="row" style="margin-top:10px"><div><label>পিকআপ</label><select id="from" onchange="draw()">${opt('from')}</select></div><div><label>গন্তব্য</label><select id="to" onchange="draw()">${opt('to')}</select></div></div>
    <div class="row"><div><label>সময়</label><input id="time" type="time" value="17:30"></div><div><label>পছন্দ</label><select id="pref"><option>যে কেউ</option><option>একই লিঙ্গ</option></select></div></div>
    <p id="fare" class="small"></p><p class="err" id="err"></p>
    <div class="row"><button class="alt" onclick="gps()">📍 আমার অবস্থান</button><button onclick="search()">বন্ধু খুঁজুন</button></div>`); draw();
  },
  async '/search'() {
    card(`<div style="text-align:center"><h2>সহযাত্রী খোঁজা হচ্ছে…</h2><div class="spin"></div><p class="small">রুট, সময় ও পছন্দ মিলিয়ে দেখা হচ্ছে</p><p class="err" id="err"></p><button class="alt" onclick="cancelReq()">বাতিল</button></div>`);
    const tick = async () => {
      try { const a = await api('GET', '/api/active'); if (a.match) return nav('#/match/' + a.match.id); if (!a.request) return nav('#/route') } catch (e) { err(e) }
      poll = setTimeout(tick, 2500);
    }; poll = setTimeout(tick, 1500);
  },
  async '/match'(id) {
    const load = async () => {
      let m; try { m = await api('GET', '/api/matches/' + id) } catch (e) { return nav('#/') }
      if (location.hash !== '#/match/' + id) return;
      renderMatch(m); if (m.status === 'pending' && m.mine === 1) poll = setTimeout(load, 1500);
    }; load();
  },
  async '/history'() {
    card('<h2>আমার রাইড</h2><p class="small">লোড হচ্ছে…</p>');
    const h = await api('GET', '/api/history'), S = { pending: 'অপেক্ষমাণ', active: 'সক্রিয়', done: 'সম্পন্ন', cancelled: 'বাতিল', rejected: 'প্রত্যাখ্যাত' };
    card(`<h2>আমার রাইড</h2>${h.map(m => `<div class="hist"><b>${esc(m.from_place)} → ${esc(m.to_place)}</b> · ${esc(m.time)}<br><span class="small">${m.emoji} ${esc(m.animal)} · ${S[m.status]} · ভাগ ৳${m.share}</span> ${m.status === 'active' ? `<a href="#/match/${m.id}">খুলুন</a>` : ''}</div>`).join('') || '<p>এখনও কোনো রাইড নেই।</p>'}<br><button onclick="nav('#/route')">নতুন রাইড</button> <button class="alt" onclick="nav('#/')">হোম</button>`);
  },
  async '/report'(id) {
    card(`<h2>রিপোর্ট করুন</h2><p class="small">সমস্যার বিবরণ লিখুন। আমরা পর্যালোচনা করব।</p><input id="why" maxlength="500" placeholder="কারণ লিখুন"><p class="err" id="err"></p><button class="red" onclick="sendReport(${+id})">জমা দিন</button> <button class="alt" onclick="history.back()">ফিরে যান</button>`);
  }
};
function renderMatch(m) {
  const S = m.status;
  if (S === 'rejected') return card(`<h2>প্রস্তাব বাতিল</h2><p>নতুন সহযাত্রী খুঁজে দেখুন।</p><button onclick="nav('#/route')">আবার খুঁজুন</button>`);
  if (S === 'done' || S === 'cancelled') return card(`<h2>${S === 'done' ? 'রাইড সম্পন্ন! ধন্যবাদ 🛺' : 'ম্যাচ বাতিল হয়েছে'}</h2><p>লোকেশন শেয়ারিং বন্ধ হয়েছে।</p><button onclick="nav('#/route')">নতুন রাইড</button> <button class="alt" onclick="nav('#/report/${m.id}')">রিপোর্ট</button>`);
  if (S === 'active') return card(`<span class="pill">🎉 দুজনেই রাজি</span><h2 style="margin-top:10px">যোগাযোগ</h2><p><b>${esc(m.other.name)}</b> (${m.emoji} ${esc(m.animal)})<br>${esc(m.from_place)} → ${esc(m.to_place)} · ${esc(m.time)}</p>
   <p style="font-size:22px;font-weight:700">${esc(m.other.phone)}</p><p class="small">ভাড়া ≈ ৳${m.fare}, প্রত্যেকের ভাগ ৳${m.share}</p>
   <div class="row"><a href="tel:${esc(m.other.phone)}"><button style="width:100%">📞 কল</button></a><button class="alt" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(m.other.phone)}');this.textContent='কপি হয়েছে ✔'">কপি</button></div>
   <p id="live" class="small" style="margin-top:10px">লাইভ লোকেশন শেয়ার করলে শুধু আপনার সহযাত্রী দেখতে পাবেন; রাইড শেষে বন্ধ হয়ে যাবে।</p><button class="alt" id="livebtn" onclick="toggleLive(${m.id})">📡 লাইভ লোকেশন শেয়ার করুন</button>
   <div class="row" style="margin-top:8px"><button class="go" onclick="act(${m.id},'complete')">রাইড সম্পন্ন</button><button class="red" onclick="act(${m.id},'cancel')">বাতিল</button><button class="alt" onclick="nav('#/report/${m.id}')">রিপোর্ট</button></div>`);
  const bars = [['পিকআপের কাছাকাছি', m.score + 3], ['গন্তব্যের কাছাকাছি', m.score - 2], ['রুটের মিল', m.score + 1], ['সময়ের মিল', m.score - 4]].map(([n, v]) => `<div>${n} <b>${Math.min(v, 100)}%</b></div><div class="bar"><i style="width:${Math.min(v, 100)}%"></i></div>`).join('');
  card(`<span class="pill">✔ মিল পাওয়া গেছে ${m.score}%</span><div class="row" style="align-items:center;margin:10px 0"><div class="animal" style="flex:0 0 70px">${m.emoji}</div><div><h2 style="margin:0">${esc(m.animal)} ${esc(m.anon)}</h2><span class="small">নাম ও ফোন এখন গোপন</span></div></div>
   <p>পিকআপ ≈ ${m.dist} মি দূরে · গন্তব্য: ${esc(m.to_place)} · সময় ${esc(m.time)} (±${m.dm} মিনিট)<br>ভাড়া ≈ ৳${m.fare} → ভাগ ৳${m.share} (প্রায় ৫০% সাশ্রয়)</p>${bars}<p class="err" id="err"></p>
   ${m.mine === 1 ? '<button class="go" disabled>সহযাত্রীর উত্তরের অপেক্ষা…</button>' : `<div class="row"><button class="go" onclick="act(${m.id},'accept')">রাজি ✔</button><button class="red" onclick="act(${m.id},'reject')">না ✖</button></div>`}`);
}
async function act(id, a) { try { if (a === 'complete' || a === 'cancel') stopLive(); const m = await api('POST', `/api/matches/${id}/${a}`); renderMatch(m); if (m.status === 'pending' && m.mine === 1) { clearTimeout(poll); pages['/match'](id) } } catch (e) { err(e) } }
async function sendOtp(purpose) {
  const b = $('otpb'); try { const r = await api('POST', '/api/otp/send', { phone: $('p').value, purpose }); $('otpmsg').textContent = r.devCode ? `ডেভ মোড: SMS গেটওয়ে চালু নেই, কোড ${r.devCode}` : 'আপনার ফোনে কোড পাঠানো হয়েছে'; err(''); b.disabled = true; let t = 60; const iv = setInterval(() => { b.textContent = --t + 's'; if (t <= 0) { clearInterval(iv); b.disabled = false; b.textContent = 'আবার পাঠান' } }, 1000) } catch (e) { err(e) }
}
async function doReg() { try { setAuth(await api('POST', '/api/register', { name: $('n').value, phone: $('p').value, gender: $('g').value, password: $('pw').value, otp: $('otp').value })); nav('#/route') } catch (e) { err(e) } }
async function doReset() { try { await api('POST', '/api/password/reset', { phone: $('p').value, otp: $('otp').value, password: $('pw').value }); card('<h2>পাসওয়ার্ড বদলানো হয়েছে ✔</h2><button onclick="nav(\'#/login\')">লগইন করুন</button>') } catch (e) { err(e) } }
async function doLogin() { try { setAuth(await api('POST', '/api/login', { phone: $('p').value, password: $('pw').value })); nav('#/route') } catch (e) { err(e) } }
async function search() { try { const r = await api('POST', '/api/requests', { from: $('from').value, to: $('to').value, time: $('time').value, pref: $('pref').value }); nav(r.matchId ? '#/match/' + r.matchId : '#/search'); if (!r.matchId) $('err') } catch (e) { err(e) } }
async function cancelReq() { await api('DELETE', '/api/requests').catch(() => {}); nav('#/route') }
async function sendReport(id) { try { await api('POST', '/api/reports', { matchId: id, reason: $('why').value }); card('<h2>ধন্যবাদ</h2><p>রিপোর্ট জমা হয়েছে।</p><button onclick="nav(\'#/\')">হোম</button>') } catch (e) { err(e) } }
function gps() {
  if (!navigator.geolocation) return err('এই ডিভাইসে GPS নেই');
  err('অবস্থান খোঁজা হচ্ছে…');
  navigator.geolocation.getCurrentPosition(async p => {
    try { const n = await api('GET', `/api/nearest?lat=${p.coords.latitude}&lng=${p.coords.longitude}`);
      if (!n.inArea) return err(`আপনি আমাদের সেবা এলাকার বাইরে (নিকটতম: ${n.place}, ${(n.meters / 1000).toFixed(1)} কিমি)`);
      $('from').value = n.place; draw(); err(`নিকটতম পিকআপ: ${n.place} (${n.meters} মি দূরে)`) } catch (e) { err(e) }
  }, () => err('লোকেশনের অনুমতি দিন অথবা হাতে পিকআপ বেছে নিন'), { enableHighAccuracy: true, timeout: 10000 });
}
let watchId = null, liveTimer = null, liveOn = false, myPos = null, lastSent = 0;
const hav = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)) };
function stopLive(id) { if (watchId != null) navigator.geolocation.clearWatch(watchId); clearInterval(liveTimer); watchId = null; liveOn = false; if (id) api('POST', `/api/matches/${id}/location`, { stop: true }).catch(() => {}) }
async function pollLive(id) {
  try { const r = await api('GET', `/api/matches/${id}/location`), el = $('live'); if (!el) return;
    if (!r.loc) el.textContent = 'সহযাত্রী এখনও লোকেশন শেয়ার করেননি';
    else { const d = myPos ? Math.round(hav(myPos[0], myPos[1], r.loc.lat, r.loc.lng)) : null; el.innerHTML = `সহযাত্রী ${d != null ? `≈ ${d} মি দূরে · ` : ''}<a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${r.loc.lat}&mlon=${r.loc.lng}#map=17/${r.loc.lat}/${r.loc.lng}">মানচিত্রে দেখুন</a>` } } catch {}
}
function toggleLive(id) {
  if (liveOn) { stopLive(id); $('livebtn').textContent = '📡 লাইভ লোকেশন শেয়ার করুন'; $('live').textContent = 'শেয়ারিং বন্ধ'; return }
  if (!navigator.geolocation) return alert('GPS নেই');
  liveOn = true; $('livebtn').textContent = '⏹ শেয়ারিং বন্ধ করুন'; $('live').textContent = 'আপনার অবস্থান নেওয়া হচ্ছে…';
  watchId = navigator.geolocation.watchPosition(p => { myPos = [p.coords.latitude, p.coords.longitude]; if (Date.now() - lastSent > 4000) { lastSent = Date.now(); api('POST', `/api/matches/${id}/location`, { lat: myPos[0], lng: myPos[1] }).catch(() => {}) } },
    () => { $('live').textContent = 'লোকেশনের অনুমতি পাওয়া যায়নি'; stopLive(id) }, { enableHighAccuracy: true, maximumAge: 5000 });
  liveTimer = setInterval(() => pollLive(id), 5000); pollLive(id);
}
async function draw() {
  const a = places.find(p => p.name === $('from').value), b = places.find(p => p.name === $('to').value); if (!a || !b) return;
  const road = d => `<path d="${d}" stroke="var(--road)" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  $('map').innerHTML = road('M20 80 L120 80 L210 160 L270 235') + road('M40 20 L60 100 L210 160') + road('M200 10 L210 160') + road('M10 150 L340 150') +
    `<path d="M${a.x} ${a.y} L${(a.x + b.x) / 2} ${a.y + 60} L${b.x} ${b.y}" stroke="var(--rick)" stroke-width="5" fill="none" stroke-dasharray="1 9" stroke-linecap="round"/>` +
    places.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--fg)" opacity=".4"/><text x="${p.x + 7}" y="${p.y + 4}" font-size="11" fill="var(--fg)">${p.name}</text>`).join('') +
    `<circle cx="${a.x}" cy="${a.y}" r="9" fill="var(--fg)" stroke="#fff" stroke-width="3"/><circle cx="${b.x}" cy="${b.y}" r="9" fill="var(--leaf)" stroke="#fff" stroke-width="3"/>`;
  try { const f = await api('GET', `/api/fare?from=${encodeURIComponent(a.name)}&to=${encodeURIComponent(b.name)}`); $('fare').textContent = `দূরত্ব ≈ ${f.km} কিমি · ভাড়া ≈ ৳${f.fare} → ভাগ করলে ৳${f.share}` } catch {}
}
async function route() {
  clearTimeout(poll); if (liveOn) stopLive(location.hash.startsWith('#/match/') ? location.hash.split('/')[2] : null);
  const [, p, arg] = location.hash.replace('#', '').split('/'), key = '/' + (p || '');
  $('userbar').innerHTML = user ? `<span class="small">${esc(user.name)}</span> <button class="alt" onclick="logout()">লগআউট</button>` : '';
  const needs = ['/route', '/search', '/match', '/history', '/report'];
  if (needs.includes(key) && !user) return nav('#/login');
  try { await (pages[key] || pages['/'])(arg) } catch (e) { card(`<h2>সমস্যা হয়েছে</h2><p>${esc(e.message)}</p><button onclick="nav('#/')">হোম</button>`) }
}
addEventListener('hashchange', route); route();
