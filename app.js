/* ============ TeslaBondhu — client app (Bangla) ============ */
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const fmtT=iso=>new Date(iso).toLocaleTimeString("bn-BD",{hour:"2-digit",minute:"2-digit"});
const fmtD=iso=>new Date(iso).toLocaleDateString("bn-BD",{day:"numeric",month:"long"});
const BDT=n=>"৳"+Number(n).toLocaleString("bn-BD");

/* ---------- toast / modal ---------- */
function toast(msg,type=""){const t=document.createElement("div");t.className="toast "+type;t.textContent=msg;$("#toast-wrap").appendChild(t);setTimeout(()=>t.remove(),3200);}
function modal(html){const r=$("#modal-root");r.innerHTML=`<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;}
function closeModal(){$("#modal-root").innerHTML="";}

/* ---------- geo utils ---------- */
const R=6371000;
const hav=(a,b)=>{const dLa=(b[1]-a[1])*Math.PI/180,dLo=(b[0]-a[0])*Math.PI/180;
 const h=Math.sin(dLa/2)**2+Math.cos(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*Math.sin(dLo/2)**2;
 return 2*R*Math.asin(Math.sqrt(h));};
const pathLen=p=>p.reduce((s,pt,i)=>i?s+hav(p[i-1],pt):0,0);
/* perpendicular distance point->segment (metres, equirect approx) */
function ptSegDist(p,a,b){const la1=a[1]*Math.PI/180,la2=b[1]*Math.PI/180,dLa=la2-la1,lo1=a[0]*Math.PI/180,lo2=b[0]*Math.PI/180,dLo=lo2-lo1;
 const x=(p[0]*Math.PI/180-lo1)*Math.cos((la1+la2)/2)*R, y=(p[1]*Math.PI/180-la1)*R;
 const dx=(lo2-lo1)*Math.cos((la1+la2)/2)*R, dy=dLa*R; const L2=dx*dx+dy*dy||1e-9;
 let t=(x*dx+y*dy)/L2; t=Math.max(0,Math.min(1,t));
 return Math.hypot(x-t*dx,y-t*dy);}
function pathDistToPath(p,q){let s=0;p.forEach(pt=>{let m=Infinity;for(let i=1;i<q.length;i++)m=Math.min(m,ptSegDist(pt,q[i-1],q[i]));s+=m;});return s/Math.max(1,p.length-0);}

/* ---------- OSRM routing with fallback ---------- */
async function fetchRoute(a,b){
  try{
    const u=`https://router.project-osrm.org/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson`;
    const r=await fetch(u); const j=await r.json();
    if(j.code!=="Ok") throw 0;
    return {geom:j.routes[0].geometry.coordinates, dist:j.routes[0].distance, src:"road"};
  }catch(e){
    const mid=[(a[0]+b[0])/2+(a[1]-b[1])*0.15,(a[1]+b[1])/2-(a[0]-b[0])*0.15];
    return {geom:[a,mid,b], dist:hav(a,b)*1.3, src:"line"};
  }
}

/* ---------- DB (localStorage) ---------- */
const DBKEY="tb_db_v1";
let DB=null;
function loadDB(){try{DB=JSON.parse(localStorage.getItem(DBKEY))}catch(e){DB=null}
 if(!DB){DB=seed();saveDB();}}
function saveDB(){localStorage.setItem(DBKEY,JSON.stringify(DB));}
let SESSION=null;
try{SESSION=JSON.parse(localStorage.getItem("tb_session"))}catch(e){}

/* ---------- demo geography: Dhaka ---------- */
const PLACES={
 mirpur10:{n:"মিরপুর ১০",c:[90.3658,23.8067]},mirpur11:{n:"মিরপুর ১১",c:[90.3615,23.8185]},
 farmgate:{n:"ফার্মগেট",c:[90.3954,23.7563]},karwan:{n:"কারওয়ান বাজার",c:[90.3905,23.7509]},
 uttara:{n:"উত্তরা",c:[90.3996,23.8759]},dhanmondi:{n:"ধানমন্ডি",c:[90.3742,23.7465]},
 mohammadpur:{n:"মোহাম্মদপুর",c:[90.3589,23.7658]},shahbagh:{n:"শাহবাগ",c:[90.3942,23.7392]},
 rampura:{n:"রামপুরা",c:[90.4125,23.7611]},banani:{n:"বনানী",c:[90.4043,23.7937]},
 motijheel:{n:"মতিঝিল",c:[90.4163,23.7330]},gulistan:{n:"গুলিস্তান",c:[90.4125,23.7220]}};
const ANIMALS=[["জেব্রা","🦓"],["সিংহ","🦁"],["বাঘ","🐯"],["হরিণ","🦌"],["ময়ূর","🦚"],["কবুতর","🕊️"],["হাতি","🐘"],["ঘোড়া","🐴"],["প্যাঁচা","🦉"],["টিয়া","🦜"],["খরগোশ","🐰"],["বাদামি","🐻"]];

function seed(){
  const users=[{id:"admin",bondhuId:"ADMIN-01",name:"অ্যাডমিন",phone:"01700000000",gender:"অন্যান্য",admin:true,verified:true,createdAt:Date.now()}];
  const demo=[
    ["রুবina আক্তার","01711111111","নারী","মিরপুর11","farmgate",-7],
    ["সাব্বির হোসেন","01722222222","পুরুষ","mirpur10","farmgate",5],
    ["তানিয়া রহমান","01733333333","নারী","mirpur10","karwan",2],
    ["নাইমুল হক","01744444444","পুরুষ","mirpur10","uttara",5],
    ["ফারিয়া ইসলাম","01755555555","নারী","dhanmondi","shahbagh",12],
    ["আরিফুল ইসলাম","01766666666","পুরুষ","mohammadpur","dhanmondi",-9],
    ["সুমাইয়া আক্তার","01777777777","নারী","rampura","motijheel",3],
    ["কামরুল হাসান","01788888888","পুরুষ","banani","uttara",18],
    ["জান্নাতুল ফেরদৌস","01799999999","নারী","gulistan","rampura",-14],
    ["মাহমুদুল হক","01611111111","পুরুষ","shahbagh","farmgate",25]];
  demo.forEach((d,i)=>{
    const a=PLACES[d[3]].c, b=PLACES[d[4]].c;
    users.push({id:"u"+i,bondhuId:"BD-"+String(1000+i),name:d[0],phone:d[1],gender:d[2],
      profession:["ছাত্র","চাকরিজীবী","ব্যবসায়ী","শিক্ষক"][i%4],verified:true,avatar:["🧕","👨","👩","🧔"][i%4],
      createdAt:Date.now()-i*86400000*3});
  });
  const now=Date.now();
  const rides=demo.map((d,i)=>{
    const a=PLACES[d[3]].c, b=PLACES[d[4]].c, dep=now+d[5]*60000+25*60000;
    return {id:"dr"+i,userId:"u"+i,pickup:{...PLACES[d[3]],c:a},dest:{...PLACES[d[4]],c:b},
      departAt:dep,flexMin:10,genderPref:null,passengers:1,status:"searching",route:{geom:[a,b],dist:hav(a,b)*1.3,src:"line"},
      createdAt:now-600000,fare:Math.round(hav(a,b)*1.3/1000)*25,animal:ANIMALS[i%ANIMALS.length]};
  });
  return {users,rides,matches:[],notifs:[],reports:[],blocks:[],
    settings:{maxPickupM:500,maxDestM:700,maxTimeDiffMin:15,minSimilarity:0.75,searchExpiryMin:30,maxPassengers:2,
      proposalTimeoutMin:2,perKmFare:25}};
}

/* ---------- Auth ---------- */
let pendingReg=null, pendingOtp=null, pendingLogin=null;
function authView(mode){
  const box=$("#auth-box");
  if(mode==="register"){
    box.innerHTML=`<h2>বন্ধু রেজিস্টার 🛺</h2><p class="muted">টেসলাবন্ধুতে যোগ দিন — ফ্রি!</p>
    <form onsubmit="return doRegister(event)">
      <div class="field"><label>পুরো নাম *</label><input id="rg-name" required placeholder="যেমন: রাহাত হোসেন"></div>
      <div class="field"><label>মোবাইল নম্বর *</label><input id="rg-phone" required placeholder="01XXXXXXXXX" pattern="01[3-9][0-9]{8}"></div>
      <div class="field"><label>লিঙ্গ *</label><select id="rg-gender"><option>পুরুষ</option><option>নারী</option><option>অন্যান্য</option></select></div>
      <div class="field"><label>পেশা (ঐচ্ছিক)</label><input id="rg-prof" placeholder="যেমন: ছাত্র"></div>
      <div class="field"><label>জিমেইল (ঐচ্ছিক)</label><input id="rg-mail" type="email" placeholder="example@gmail.com"></div>
      <button class="btn btn-primary btn-block btn-lg">OTP পাঠান</button>
    </form><p class="muted center" style="margin-top:12px">অ্যাকাউন্ট আছে? <a href="#/login">লগইন</a></p>`;
  } else if(mode==="otp"){
    const isReg=!!pendingReg;
    box.innerHTML=`<h2>OTP যাচাই ✉️</h2><p class="muted">${esc(isReg?pendingReg.phone:pendingLogin.phone)} নম্বরে ৬ সংখ্যার কোড পাঠানো হয়েছে</p>
    <div class="otp-box">${[0,1,2,3,4,5].map(i=>`<input id="ot-${i}" maxlength="1" inputmode="numeric" oninput="otpNext(${i})">`).join("")}</div>
    <div class="dev-otp">🔧 ডেভেলপমেন্ট OTP: <b>${pendingOtp}</b></div>
    <button class="btn btn-primary btn-block" onclick="verifyOtp()">যাচাই করুন</button>
    <p class="muted center" style="margin-top:10px"><a href="javascript:void(0)" onclick="authView('${isReg?"register":"login"}')">← ফিরে যান</a></p>`;
    setTimeout(()=>$("#ot-0")?.focus(),50);
  } else {
    box.innerHTML=`<h2>বন্ধু লগইন 🔑</h2><p class="muted">মোবাইল নম্বর দিয়ে OTP লগইন</p>
    <form onsubmit="return doLogin(event)">
      <div class="field"><label>মোবাইল নম্বর</label><input id="lg-phone" required placeholder="01XXXXXXXXX" pattern="01[3-9][0-9]{8}"></div>
      <button class="btn btn-primary btn-block btn-lg">OTP পাঠান</button>
    </form>
    <p class="muted center" style="margin-top:12px">নতুন বন্ধু? <a href="#/register">রেজিস্টার করুন</a></p>
    <p class="muted center" style="margin-top:6px"><a href="#/admin-login">🛠️ অ্যাডমিন</a></p>`;
  }
}
function otpNext(i){const v=$("#ot-"+i).value;if(v&&i<5)$("#ot-"+(i+1)).focus();}
function genOtp(){pendingOtp=String(Math.floor(100000+Math.random()*900000));return pendingOtp;}
function doRegister(e){e.preventDefault();
  const phone=$("#rg-phone").value.trim();
  if(DB.users.some(u=>u.phone===phone)){toast("এই নম্বরে অ্যাকাউন্ট আছে! লগইন করুন।","err");return false;}
  pendingReg={name:$("#rg-name").value.trim(),phone,gender:$("#rg-gender").value,profession:$("#rg-prof").value.trim(),mail:$("#rg-mail").value.trim()};
  genOtp();location.hash="#/otp";return false;}
function doLogin(e){e.preventDefault();
  const phone=$("#lg-phone").value.trim();
  const u=DB.users.find(x=>x.phone===phone);
  if(!u){toast("এই নম্বরে কোনো অ্যাকাউন্ট নেই","err");return false;}
  pendingLogin=u;genOtp();location.hash="#/otp";return false;}
function verifyOtp(){
  const code=[0,1,2,3,4,5].map(i=>$("#ot-"+i).value).join("");
  if(code!==pendingOtp){toast("ভুল OTP! আবার চেষ্টা করুন।","err");return;}
  let u;
  if(pendingReg){u={id:uid(),bondhuId:"BD-"+Math.floor(1000+Math.random()*9000),name:pendingReg.name,phone:pendingReg.phone,
    gender:pendingReg.gender,profession:pendingReg.profession,mail:pendingReg.mail,verified:true,createdAt:Date.now()};
    DB.users.push(u);saveDB();toast("🎉 স্বাগতম, "+u.name.split(" ")[0]+"!","ok");}
  else{u=pendingLogin;toast("লগইন সফল!","ok");}
  SESSION={userId:u.id,admin:!!u.admin};localStorage.setItem("tb_session",JSON.stringify(SESSION));
  pendingReg=pendingLogin=null;location.hash=u.admin?"#/admin":"#/dashboard";
}

/* ---------- Router ---------- */
const routes={landing:"page-landing",auth:"page-auth",app:"page-app",admin:"page-admin"};
let curRoute="dashboard";
function show(page){Object.values(routes).forEach(id=>$("#"+id).classList.remove("active"));$("#"+routes[page]).classList.add("active");window.scrollTo(0,0);}
function go(r){location.hash="#/"+r;}
function renderRoute(){
  const h=location.hash||"#/";
  if(h==="#/"||h===""){show("landing");refreshLandingStats();return;}
  if(h==="#/register"){show("auth");authView("register");return;}
  if(h==="#/login"){show("auth");authView("login");return;}
  if(h==="#/otp"){if(!pendingOtp){location.hash="#/login";return;}show("auth");authView("otp");return;}
  if(h==="#/demo"){startDemo();return;}
  if(h==="#/admin-login"){adminLoginView();return;}
  if(!SESSION){location.hash="#/login";return;}
  const u=me();
  if(u&&u.admin){show("admin");Admin.render();return;}
  show("app");
  const r=(h.split("/")[1]||"dashboard").split("?")[0];
  curRoute=r;
  $$(".bottombar a").forEach(a=>a.classList.toggle("on",a.dataset.r===r));
  ({dashboard:renderDashboard,search:renderSearch,matches:renderMatches,rides:renderRides,profile:renderProfile,
    history:renderHistory,safety:renderSafety,settings:renderSettings,notifications:renderNotifications}[r]||renderDashboard)();
}
window.addEventListener("hashchange",renderRoute);
function me(){return DB.users.find(u=>u.id===SESSION?.userId);}
function logout(){SESSION=null;localStorage.removeItem("tb_session");location.hash="#/";toast("লগআউট হয়েছে");}
function refreshLandingStats(){$("#st-users").textContent=DB.users.filter(u=>!u.admin).length+"+";$("#st-rides").textContent=(DB.rides.filter(r=>r.status==="completed").length+137)+"+";}

/* ---------- notifications ---------- */
function notify(userId,title,body){DB.notifs.unshift({id:uid(),userId,title,body,read:false,at:Date.now()});saveDB();bellDot();}
function bellDot(){const un=DB.notifs.filter(n=>n.userId===SESSION.userId&&!n.read).length;$("#bell-dot").classList.toggle("hidden",!un);}
function renderNotifications(){
  const list=DB.notifs.filter(n=>n.userId===SESSION.userId);
  $("#app-main").innerHTML=`<h2 class="section-title">🔔 নোটিফিকেশন</h2>`+
    (list.length?list.map(n=>`<div class="notif ${n.read?"":"unread"}" onclick="DB.notifs.find(x=>x.id==='${n.id}').read=true;saveDB();this.classList.remove('unread');bellDot()">
      <b>${esc(n.title)}</b><br><span class="muted">${esc(n.body)} • ${fmtT(n.at)}</span></div>`).join("")
    :`<p class="muted center">কোনো নোটিফিকেশন নেই</p>`);
  list.forEach(n=>n.read=true);saveDB();bellDot();
}

/* ---------- Dashboard ---------- */
function renderDashboard(){
  const u=me();
  const active=DB.rides.filter(r=>r.userId===u.id&&["searching","awaiting_acceptance","potential_match","matched"].includes(r.status));
  const matched=active.find(r=>r.status==="matched");
  $("#top-avatar").textContent=u.avatar||"👤";
  $("#app-main").innerHTML=`
    <h2 class="section-title">আসসালামু আলাইকুম, ${esc(u.name.split(" ")[0])}! 🛺</h2>
    <div class="stat-grid">
      <div class="stat"><b>${DB.rides.filter(r=>r.userId===u.id).length}</b><span>মোট রাইড</span></div>
      <div class="stat"><b>${DB.rides.filter(r=>r.userId===u.id&&r.status==="completed").length}</b><span>সম্পন্ন</span></div>
      <div class="stat"><b>${BDT(DB.rides.filter(r=>r.userId===u.id&&r.status==="completed").reduce((s,r)=>s+(r.saved||0),0))}</b><span>মোট সাশ্রয়</span></div>
    </div>
    ${matched?matchBanner(matched):""}
    <div class="floral-div"></div>
    <h3 class="section-title">⚡ দ্রুত অ্যাকশন</h3>
    <div class="grid-3">
      <div class="card center"><div class="ic" style="font-size:2rem">🧭</div><p>নতুন রাইড খুঁজুন</p><button class="btn btn-primary btn-block" onclick="go('search')">শুরু করুন</button></div>
      <div class="card center"><div style="font-size:2rem">🛺</div><p>আপনার রাইডগুলো দেখুন</p><button class="btn btn-ghost btn-block" onclick="go('rides')">আমার রাইড</button></div>
      <div class="card center"><div style="font-size:2rem">🛡️</div><p>নিরাপত্তা টিপস ও রিপোর্ট</p><button class="btn btn-ghost btn-block" onclick="go('safety')">নিরাপত্তা</button></div>
    </div>
    <p class="muted center" style="margin-top:24px">টেসলাবন্ধু যাত্রী মেলায় — রিকশা বুকিং বা পেমেন্ট সেবা নয়।</p>`;
}
function matchBanner(ride){
  const m=DB.matches.find(m=>m.rideAId===ride.id||m.rideBId===ride.id);
  const other=m?otherUser(m,ride):null;
  return `<div class="contact-card" style="text-align:left">
    <b style="font-size:1.1rem">✅ ম্যাচ কনফার্মড!</b>
    <p style="margin:6px 0">আপনার বন্ধু <b>${other?esc(other.animalName):"—"}</b> প্রস্তুত। যোগাযোগ দেখতে ক্লিক করুন।</p>
    <button class="btn btn-warn btn-block" onclick="go('matches?id=${ride.id}')">বিস্তারিত দেখুন</button></div>`;
}
function otherUser(m,ride){const oid=m.userAId===ride.userId?m.userBId:m.userAId;
  const ou=DB.users.find(u=>u.id===oid);const oride=DB.rides.find(r=>r.id===(m.rideAId===ride.id?m.rideBId:m.rideAId));
  return ou?{...ou,animalName:oride?.animal?.[0]||"বন্ধু",animalEmo:oride?.animal?.[1]||"🙂"}:null;}

/* ---------- Search / Ride creation ---------- */
let draft=null, map=null, markers={}, routeLine=null;
function renderSearch(){
  const now=new Date(Date.now()+30*60000);const pad=n=>String(n).padStart(2,"0");
  $("#app-main").innerHTML=`
    <h2 class="section-title">🧭 নতুন রাইড খুঁজুন</h2>
    <div class="map-wrap"><div id="map"></div>
      <div class="map-tools">
        <button onclick="useGPS()">📡 আমার অবস্থান</button>
        <button onclick="setPickMode()">📍 পিকআপ বেছে নিন</button>
        <button onclick="setDestMode()">🏁 গন্তব্য বেছে নিন</button>
      </div>
    </div>
    <p class="muted" id="map-hint" style="margin-top:8px">ম্যাপে ক্লিক করে বা উপরের বাটনে চেপে লোকেশন সেট করুন।</p>
    <form onsubmit="return submitRide(event)" style="margin-top:10px">
      <div class="card">
        <div class="row2">
          <div class="field"><label>পিকআপ *</label><input id="rd-pick" readonly placeholder="ম্যাপ থেকে বাছাই করুন" required></div>
          <div class="field"><label>গন্তব্য *</label><input id="rd-dest" readonly placeholder="ম্যাপ থেকে বাছাই করুন" required></div>
        </div>
        <div class="row2">
          <div class="field"><label>তারিখ *</label><input id="rd-date" type="date" required value="${now.toISOString().slice(0,10)}"></div>
          <div class="field"><label>সময় *</label><input id="rd-time" type="time" required value="${pad(now.getHours())}:${pad(now.getMinutes())}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>সময় নমনীয়তা (মিনিট)</label><select id="rd-flex"><option>5</option><option selected>10</option><option>15</option><option>30</option></select></div>
          <div class="field"><label>সঙ্গীর লিঙ্গ পছন্দ (ঐচ্ছিক)</label><select id="rd-gpref"><option value="">কোনো পছন্দ নেই</option><option>পুরুষ</option><option>নারী</option></select></div>
        </div>
        <div class="field"><label>যাত্রী সংখ্যা (সর্বোচ্চ ${DB.settings.maxPassengers})</label>
          <select id="rd-pass">${Array.from({length:DB.settings.maxPassengers},(_,i)=>`<option>${i+1}</option>`).join("")}</select></div>
        <p class="muted" id="rd-route-info"></p>
        <button id="rd-submit" class="btn btn-primary btn-block btn-lg" disabled>🔍 বন্ধু খুঁজুন</button>
      </div>
    </form>`;
  draft={pick:null,dest:null,route:null,pickMode:null};
  initMap();
}
function initMap(){
  map=new maplibregl.Map({container:"map",style:{version:8,sources:{osm:{type:"raster",tiles:["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],tileSize:256}},
    layers:[{id:"osm",type:"raster",source:"osm"}]},center:[90.4125,23.8103],zoom:11.2});
  map.addControl(new maplibregl.NavigationControl(),"top-left");
  map.on("click",async e=>{
    const pt=[e.lngLat.lng,e.lngLat.lat];
    if(!draft.pickMode){if(!draft.pick)setPickMode();else if(!draft.dest)setDestMode();}
    await setPoint(draft.pickMode||"pick",pt);
  });
}
async function useGPS(){
  if(!navigator.geolocation){toast("GPS সাপোর্ট নেই","err");return;}
  toast("📡 GPS খুঁজছে...");
  navigator.geolocation.getCurrentPosition(async pos=>{
    const pt=[pos.coords.longitude,pos.coords.latitude];
    map.flyTo({center:pt,zoom:14});
    if(!draft.pick){draft.pickMode="pick";await setPoint("pick",pt);}
    toast("অবস্থান পাওয়া গেছে!","ok");
  },()=>toast("GPS অনুমতি পাওয়া যায়নি","err"),{timeout:8000});
}
function setPickMode(){draft.pickMode="pick";$("#map-hint").textContent="📍 ম্যাপে ক্লিক করে পিকআপ পয়েন্ট দিন";toast("পিকআপ বাছাই মোড")}
function setDestMode(){draft.pickMode="dest";$("#map-hint").textContent="🏁 ম্যাপে ক্লিক করে গন্তব্য দিন";toast("গন্তব্য বাছাই মোড")}
async function setPoint(which,pt){
  const name=nearestPlaceName(pt);
  if(which==="pick"){draft.pick={c:pt,name};$("#rd-pick").value=name;dropMarker("pick",pt,"#0f7a3d");}
  else{draft.dest={c:pt,name};$("#rd-dest").value=name;dropMarker("dest",pt,"#d7263d");}
  if(draft.pick&&draft.dest){$("#rd-submit").disabled=true;$("#rd-route-info").textContent="🛣️ রুট হিসাব হচ্ছে...";
    draft.route=await fetchRoute(draft.pick.c,draft.dest.c);
    const km=(draft.route.dist/1000).toFixed(1), fare=Math.max(20,Math.round(draft.route.dist/1000*DB.settings.perKmFare));
    draft.fare=fare;
    drawRoute(draft.route.geom);
    $("#rd-route-info").textContent=`দূরত্ব: ${km} কিমি (সড়ক রুট${draft.route.src==="line"?" — আনুমানিক":""}) • আনুমানিক ভাড়া: ${BDT(fare)} • ভাগ করলে: ~${BDT(Math.ceil(fare/2))} জনপ্রতি`;
    $("#rd-submit").disabled=false;}
}
function nearestPlaceName(pt){let best=null,bd=1e9;for(const k in PLACES){const d=hav(pt,PLACES[k].c);if(d<bd){bd=d;best=k;}}
  return bd<600?PLACES[best].n+" (কাছাকাছি)":"কাস্টম পয়েন্ট ("+pt[1].toFixed(4)+", "+pt[0].toFixed(4)+")";}
function dropMarker(which,pt,color){
  if(markers[which])markers[which].remove();
  const el=document.createElement("div");el.style.cssText=`width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)`;
  markers[which]=new maplibregl.Marker({element:el,draggable:true}).setLngLat(pt).addTo(map);
  markers[which].on("dragend",async()=>{const p=markers[which].getLngLat();await setPoint(which,[p.lng,p.lat]);});
}
function drawRoute(geom){
  if(routeLine)map.removeLayer("route").removeSource("route");
  map.addSource("route",{type:"geojson",data:{type:"Feature",geometry:{type:"LineString",coordinates:geom}}});
  map.addLayer({id:"route",type:"line",source:"route",paint:{"line-color":"#0f7a3d","line-width":5,"line-opacity":.85}});
  const b=new maplibregl.LngLatBounds();geom.forEach(p=>b.extend(p));map.fitBounds(b,{padding:60});
}
async function submitRide(e){e.preventDefault();
  const u=me();
  const [y,m,d]=$("#rd-date").value.split("-").map(Number);const [hh,mm]=$("#rd-time").value.split(":").map(Number);
  const departAt=new Date(y,m-1,d,hh,mm).getTime();
  if(departAt<Date.now()){toast("ভবিষ্যতের সময় দিন","err");return false;}
  if(draft.pick.c.join()===draft.dest.c.join()){toast("পিকআপ আর গন্তব্য একই!","err");return false;}
  const gpref=$("#rd-gpref").value||null;
  if(gpref&&gpref!==u.gender)toast("⚠️ আপনি "+gpref+" সঙ্গী চাইছেন, অথচ নিজের লিঙ্গ আলাদা — থাকতে পারবে, তবে ম্যাচিং কঠিন হবে।");
  const ride={id:uid(),userId:u.id,pickup:{name:draft.pick.name,c:draft.pick.c},dest:{name:draft.dest.name,c:draft.dest.c},
    departAt,flexMin:+$("#rd-flex").value,genderPref:gpref,passengers:+$("#rd-pass").value,
    status:"searching",route:{geom:draft.route.geom.slice(0,60),dist:draft.route.dist,src:draft.route.src},
    fare:draft.fare,createdAt:Date.now(),expiryAt:Date.now()+DB.settings.searchExpiryMin*60000,
    animal:ANIMALS[Math.floor(Math.random()*ANIMALS.length)]};
  DB.rides.push(ride);saveDB();
  toast("রাইড তৈরি! বন্ধু খুঁজছি...","ok");
  go("matches?id="+ride.id);
  setTimeout(()=>runScheduler(ride.id),2500);
  return false;
}

/* ---------- Matching Engine ---------- */
function matchScore(ride,other,S){
  /* hard rejections */
  const dp=hav(ride.pickup.c,other.pickup.c), dd=hav(ride.dest.c,other.dest.c);
  if(dp>S.maxPickupM)return null;
  if(dd>S.maxDestM)return null;
  const dt=Math.abs(ride.departAt-other.departAt)/60000 - Math.min(ride.flexMin,other.flexMin);
  if(dt>S.maxTimeDiffMin)return null;
  const totP=ride.passengers+other.passengers; if(totP>S.maxPassengers)return null;
  if(ride.genderPref&&ride.genderPref!==DB.users.find(u=>u.id===other.userId).gender)return null;
  if(other.genderPref&&other.genderPref!==DB.users.find(u=>u.id===ride.userId).gender)return null;
  /* direction check — opposite direction rejected */
  const dirA=[ride.dest.c[0]-ride.pickup.c[0],ride.dest.c[1]-ride.pickup.c[1]];
  const dirB=[other.dest.c[0]-other.pickup.c[0],other.dest.c[1]-other.pickup.c[1]];
  const dot=dirA[0]*dirB[0]+dirA[1]*dirB[1];
  if(dot<=0)return null;
  /* route similarity: shared-length ratio weighted by direction */
  const lenA=pathLen(ride.route.geom), lenB=pathLen(other.route.geom);
  const avgDist=pathDistToPath(other.route.geom,ride.route.geom);
  const overlap=Math.max(0,1-avgDist/400);
  const sharedFrac=Math.min(1,lenB/Math.max(1,lenA));
  let similarity=Math.min(1,overlap*(0.5+0.5*sharedFrac));
  if(similarity<S.minSimilarity)return null;
  /* component scores 0..100 */
  const sPick=Math.max(0,1-dp/S.maxPickupM)*100;
  const sDest=Math.max(0,1-dd/S.maxDestM)*100;
  const sRoute=similarity*100;
  const sTime=Math.max(0,1-Math.max(0,Math.abs(ride.departAt-other.departAt)/60000-5)/S.maxTimeDiffMin)*100;
  const score=Math.round(sPick*0.25+sDest*0.25+sRoute*0.30+sTime*0.20);
  return {score,dp:Math.round(dp),dd:Math.round(dd),similarity,dt:Math.round(Math.abs(ride.departAt-other.departAt)/60000),
    breakdown:{pickup:sPick,dest:sDest,route:sRoute,time:sTime}};
}
function activePool(ride){const now=Date.now();
  return DB.rides.filter(r=>r.userId!==ride.userId&&r.status==="searching"&&!isBlocked(ride.userId,r.userId)
    &&Math.abs(r.departAt-ride.departAt)<=90*60000&&r.expiryAt>now
    &&!DB.matches.some(m=>["proposed","confirmed"].includes(m.status)&&(m.rideAId===r.id||m.rideBId===r.id)));}
function isBlocked(a,b){return DB.blocks.some(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));}

/* Scheduler: max-score exclusive matching (greedy on sorted pairs) */
function runScheduler(rideId){
  const ride=DB.rides.find(r=>r.id===rideId);
  if(!ride||ride.status!=="searching")return;
  const S=DB.settings;
  const cands=activePool(ride).map(o=>({o,sc:matchScore(ride,o,S)})).filter(x=>x.sc).sort((a,b)=>b.sc.score-a.sc.score);
  const pick=cands[0];
  if(!pick){ride.status="searching";saveDB();return;}
  /* propose */
  const m={id:uid(),rideAId:ride.id,rideBId:pick.o.id,userAId:ride.userId,userBId:pick.o.userId,
    status:"proposed",score:pick.sc.score,meta:pick.sc,proposedAt:Date.now(),
    expiresAt:Date.now()+S.proposalTimeoutMin*60000,acceptedA:false,acceptedB:false};
  DB.matches.push(m);
  ride.status="awaiting_acceptance";pick.o.status="awaiting_acceptance";
  saveDB();
  notify(ride.userId,"🦓 নতুন ম্যাচ পেয়েছেন!",`${pick.o.animal[0]} (${pick.o.animal[1]}) — ${pick.sc.score}% মিল। গ্রহণ করুন!`);
  /* demo partner responds in 6–14s */
  setTimeout(()=>{
    const mm=DB.matches.find(x=>x.id===m.id);
    if(!mm||mm.status!=="proposed")return;
    if(mm.expiresAt<Date.now()){expireProposal(mm);return;}
    mm.acceptedB=true;mm.status="accepted_b";saveDB();
    notify(mm.userAId,"✅ সঙ্গী রাজি হয়েছে!","এখন আপনি গ্রহণ করলে যোগাযোগ খুলে যাবে।");
    refreshIf("matches");
    toast("আপনার সঙ্গী রাজি হয়েছে! ✅","ok");
    /* second timeout if this user never accepts */
    setTimeout(()=>{const x=DB.matches.find(y=>y.id===m.id);if(x&&x.status==="accepted_b")expireProposal(x);},
      DB.settings.proposalTimeoutMin*60000);
  },6000+Math.random()*8000);
  refreshIf("matches");
}
function expireProposal(m){
  if(m.status==="confirmed")return;
  m.status="expired";
  [DB.rides.find(r=>r.id===m.rideAId),DB.rides.find(r=>r.id===m.rideBId)].forEach(r=>{if(r&&r.status!=="cancelled")r.status="searching";});
  saveDB();
  notify(m.userAId,"⏰ প্রস্তাবের সময় শেষ","নতুন বন্ধু খুঁজছি...");
  refreshIf("matches");
}
function acceptMatch(m){
  if(m.status==="proposed"){m.acceptedA=true;m.status="accepted_a";saveDB();
    toast("আপনি রাজি হয়েছেন! সঙ্গীর উত্তরের অপেক্ষায়... ⏳");
    setTimeout(()=>{const x=DB.matches.find(y=>y.id===m.id);
      if(x&&x.status==="accepted_a"&&x.expiresAt>Date.now()){
        x.acceptedB=true;confirmMatch(x);}},5000+Math.random()*5000);
    refreshIf("matches");}
  else if(m.status==="accepted_b"){m.acceptedA=true;confirmMatch(m);}
}
function confirmMatch(m){
  m.status="confirmed";m.confirmedAt=Date.now();
  const ra=DB.rides.find(r=>r.id===m.rideAId),rb=DB.rides.find(r=>r.id===m.rideBId);
  ra.status="matched";rb.status="matched";
  const fare=Math.max(ra.fare,rb.fare);ra.saved=Math.round(fare/2);rb.saved=Math.round(fare/2);
  saveDB();
  notify(m.userAId,"🎉 ম্যাচ কনফার্মড!","যোগাযোগ তথ্য খুলে গেছে।");
  notify(m.userBId,"🎉 ম্যাচ কনফার্মড!","যোগাযোগ তথ্য খুলে গেছে।");
  toast("🎉 ম্যাচ কনফার্মড! যোগাযোগ তথ্য দেখুন।","ok");
  refreshIf("matches");
}
function rejectMatch(m){
  m.status="rejected";
  [DB.rides.find(r=>r.id===m.rideAId),DB.rides.find(r=>r.id===m.rideBId)].forEach(r=>{if(r&&r.status!=="cancelled"){r.status="searching";}});
  saveDB();notify(m.userBId,"❌ প্রস্তাব বাতিল","অন্য বন্ধু খুঁজছি...");
  toast("প্রস্তাব বাতিল হয়েছে। নতুন সার্চ চালু।","ok");
  setTimeout(()=>runScheduler(m.rideAId),3000);
  refreshIf("matches");
}
function cancelRide(rideId){
  const r=DB.rides.find(x=>x.id===rideId);if(!r)return;
  r.status="cancelled";
  DB.matches.filter(m=>(m.rideAId===rideId||m.rideBId===rideId)&&["proposed","accepted_a","accepted_b"].includes(m.status))
    .forEach(m=>{m.status="cancelled";const other=DB.rides.find(x=>x.id===(m.rideAId===rideId?m.rideBId:m.rideAId));
      if(other&&other.status!=="cancelled"){other.status="searching";notify(m.userAId===r.userId?m.userBId:m.userAId,"🚫 রাইড বাতিল","আপনার সঙ্গী রাইড বাতিল করেছে। নতুন খোঁজ চলছে।");}});
  saveDB();toast("রাইড বাতিল হয়েছে","ok");refreshIf("rides");refreshIf("dashboard");
}
function completeRide(rideId){
  const r=DB.rides.find(x=>x.id===rideId);if(!r)return;
  r.status="completed";
  const m=DB.matches.find(m=>(m.rideAId===rideId||m.rideBId===rideId)&&m.status==="confirmed");
  if(m){const o=DB.rides.find(x=>x.id===(m.rideAId===rideId?m.rideBId:m.rideAId));if(o)o.status="completed";
    notify(m.userAId===r.userId?m.userBId:m.userAId,"✅ রাইড সম্পন্ন!","সফর ভালো কাটুক!");}
  saveDB();toast("🎉 রাইড সম্পন্ন! সাশ্রয়: "+BDT(r.saved||0),"ok");go("history");
}
function refreshIf(r){if(curRoute===r)renderRoute();}

/* ---------- Matches page ---------- */
let schedTimers={};
function renderMatches(){
  const q=new URLSearchParams(location.hash.split("?")[1]||"");
  const rideId=q.get("id");
  const ride=DB.rides.find(r=>r.id===rideId&&r.userId===SESSION.userId);
  if(!ride){$("#app-main").innerHTML=`<h2 class="section-title">ম্যাচ</h2><p class="muted">সক্রিয় রাইড নেই। প্রথমে রাইড তৈরি করুন।</p><button class="btn btn-primary" onclick="go('search')">রাইড খুঁজুন</button>`;return;}
  const m=DB.matches.find(m=>(m.rideAId===ride.id||m.rideBId===ride.id)&&["proposed","accepted_a","accepted_b","confirmed"].includes(m.status));
  const main=$("#app-main");
  if(ride.status==="searching"&&!m){
    main.innerHTML=`<h2 class="section-title">🔍 বন্ধু খোঁজা হচ্ছে...</h2>
      <div class="radar"><i></i><i></i><i></i><div class="core">🛺</div></div>
      <div class="card center">
        <b>${esc(ride.pickup.name)} → ${esc(ride.dest.name)}</b><br>
        <span class="muted">${fmtD(ride.departAt)}, ${fmtT(ride.departAt)} • আনুমানিক ভাড়া ${BDT(ride.fare)}</span>
        <p class="muted" style="margin-top:10px">ঢাকার সক্রিয় রাইডগুলোর সাথে রুট-ভিত্তিক তুলনা চলছে...</p>
        <div class="spinner"></div>
        <button class="btn btn-danger btn-sm" onclick="cancelRide('${ride.id}')">সার্চ বাতিল</button>
      </div>
      <p class="muted center" style="margin-top:12px">⏳ সার্চ ${DB.settings.searchExpiryMin} মিনিটে স্বয়ংক্রিয় শেষ হবে।</p>`;
    if(!schedTimers[ride.id])schedTimers[ride.id]=setInterval(()=>{
      const r=DB.rides.find(x=>x.id===ride.id);
      if(!r||r.status!=="searching"){clearInterval(schedTimers[ride.id]);delete schedTimers[ride.id];return;}
      if(Date.now()>r.expiryAt){r.status="expired";saveDB();toast("সার্চের সময় শেষ","err");renderRoute();return;}
      runScheduler(ride.id);},18000);
    return;
  }
  if(!m){main.innerHTML=`<h2 class="section-title">ম্যাচ</h2><p class="muted">এই রাইডে কোনো সক্রিয় প্রস্তাব নেই।</p><button class="btn btn-primary" onclick="go('rides')">আমার রাইড</button>`;return;}
  const otherRide=DB.rides.find(r=>r.id===(m.rideAId===ride.id?m.rideBId:m.rideAId));
  const other=DB.users.find(u=>u.id===(m.userAId===ride.userId?m.userBId:m.userAId));
  if(m.status==="confirmed"){renderContact(m,ride,otherRide,other);return;}
  /* anonymous card */
  const left=Math.max(0,Math.round((m.expiresAt-Date.now())/1000));
  const myAccepted=(m.status==="accepted_a"&&m.userAId===ride.userId)||(m.status==="accepted_b"&&m.userBId===ride.userId);
  main.innerHTML=`<h2 class="section-title">🦓 অজ্ঞাত ম্যাচ পাওয়া গেছে!</h2>
    <div class="match-card">
      <div class="animal"><span class="emo">${otherRide.animal[1]}</span><div><b>${otherRide.animal[0]}</b><br>
        <span class="muted">${otherRide.animal[0]} — আপনার অজ্ঞাত সঙ্গী (ID: ${other.bondhuId})</span></div>
        <div class="score-ring" style="background:${m.score>=85?"var(--green-d)":"var(--navy2)"}">${m.score}%</div></div>
      <div class="mrow"><span>📍 পিকআপ দূরত্ব</span><b>~${m.meta.dp} মিটার দূরে</b></div>
      <div class="mrow"><span>🏁 গন্তব্য কাছাকাছি</span><b>~${m.meta.dd} মিটার</b></div>
      <div class="mrow"><span>🕐 যাত্রার সময়</span><b>${fmtT(otherRide.departAt)} (${m.meta.dt} মিনিট ফারাক)</b></div>
      <div class="mrow"><span>🛣️ রুট মিল</span><b>${Math.round(m.meta.similarity*100)}%</b></div>
      <div class="mrow"><span>💰 আনুমানিক সাশ্রয়</span><b style="color:var(--green-d)">${BDT(Math.round(Math.max(ride.fare,otherRide.fare)/2))} / জন</b></div>
      ${otherRide.genderPref||ride.genderPref?`<div class="mrow"><span>⚧ লিঙ্গ সামঞ্জস্য</span><b>✓ মিলেছে</b></div>`:""}
      <p class="muted center" style="margin-top:10px">⏳ <span id="m-timer">${left}</span> সেকেন্ড বাকি • ${myAccepted?"সঙ্গীর উত্তরের অপেক্ষায় ⏳":"দুজনেই গ্রহণ করলে যোগাযোগ খুলবে"}</p>
      ${m.status==="accepted_a"&&m.userAId===ride.userId?`<button class="btn btn-ghost btn-block" disabled>✓ আপনি রাজি — সঙ্গীর অপেক্ষায়</button>`
      :`<div class="btn-row">
        <button class="btn btn-primary" style="flex:1" onclick="acceptMatch(DB.matches.find(x=>x.id==='${m.id}'))">✓ গ্রহণ করুন</button>
        <button class="btn btn-danger" onclick="rejectMatch(DB.matches.find(x=>x.id==='${m.id}'))">✗ প্রত্যাখ্যান</button>
      </div>`}
    </div>
    <p class="muted center">🔒 গোপনীয়তা: নাম, ফোন ও ছবি মিউচুয়াল গ্রহণের আগে গোপন থাকে।</p>`;
  if(!refreshIf._t)refreshIf._t=setInterval(()=>{const el=$("#m-timer");if(!el){clearInterval(refreshIf._t);refreshIf._t=null;return;}
    el.textContent=Math.max(0,Math.round((m.expiresAt-Date.now())/1000));},1000);
}
function renderContact(m,ride,otherRide,other){
  $("#app-main").innerHTML=`<h2 class="section-title">🎉 ম্যাচ কনফার্মড!</h2>
    <div class="contact-card">
      <div class="emo">${otherRide.animal[1]}</div>
      <h3 style="font-size:1.4rem">${otherRide.animal[0]} আর নেই অজ্ঞাত!</h3>
      <div class="avatar" style="margin:10px auto;width:64px;height:64px;font-size:1.8rem;background:#fff;color:var(--navy)">${other.avatar||esc(other.name[0])}</div>
      <b style="font-size:1.3rem">${esc(other.name)}</b>
      <p style="opacity:.9">${esc(other.profession||"বন্ধু")} • ${esc(other.gender)} • যাচাইকৃত ✓</p>
      <a class="big-phone" href="tel:${other.phone}">📞 ${other.phone}</a>
      <p style="font-size:.9rem;opacity:.9">${esc(ride.pickup.name)} → ${esc(ride.dest.name)} • ${fmtT(ride.departAt)}</p>
    </div>
    <div class="btn-row" style="margin-top:14px">
      <a class="btn btn-primary" style="flex:1;text-align:center" href="tel:${other.phone}">📞 কল করুন</a>
      <button class="btn btn-warn" onclick="navigator.clipboard.writeText('${other.phone}').then(()=>toast('নম্বর কপি হয়েছে! 📋','ok'))">📋 কপি</button>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" style="flex:1;background:var(--green-d)" onclick="completeRide('${ride.id}')">✅ রাইড সম্পন্ন</button>
      <button class="btn btn-danger" onclick="cancelRide('${ride.id}')">✗ বাতিল</button>
      <button class="btn btn-ghost" onclick="reportUser('${other.id}')">🚩 রিপোর্ট</button>
    </div>
    <div class="card" style="margin-top:14px"><b>💡 মনে রাখবেন</b><p class="muted">জনবহুল স্থানে দেখা করুন। রিকশা আপনারাই ধরবেন, ভাড়া দুজনে ভাগ করে দেবেন। টেসলাবন্ধু পেমেন্ট বা রিকশা বুকিং করে না।</p></div>`;
}

/* ---------- My rides / History ---------- */
function statusPill(s){const m={searching:["খোঁজ চলছে","searching"],awaiting_acceptance:["অপেক্ষমাণ","await"],matched:["ম্যাচড","matched"],
  cancelled:["বাতিল","cancel"],expired:["মেয়াদোত্তীর্ণ","expired"],completed:["সম্পন্ন","done"]};const x=m[s]||[s,""];
  return `<span class="pill ${x[1]}">${x[0]}</span>`;}
function renderRides(){
  const u=me();
  const mine=DB.rides.filter(r=>r.userId===u.id).sort((a,b)=>b.createdAt-a.createdAt);
  $("#app-main").innerHTML=`<h2 class="section-title">🛺 আমার রাইড</h2>`+
    (mine.length?mine.map(r=>`<div class="list-item">
      <div class="avatar">${r.animal[1]}</div>
      <div class="grow"><b>${esc(r.pickup.name)} → ${esc(r.dest.name)}</b><br>
      <span class="muted">${fmtD(r.departAt)} ${fmtT(r.departAt)} • ${BDT(r.fare)}</span><br>${statusPill(r.status)}</div>
      ${["searching","awaiting_acceptance","matched"].includes(r.status)?`<button class="btn btn-sm btn-primary" onclick="go('matches?id=${r.id}')">দেখুন</button>`:""}
    </div>`).join(""):`<p class="muted center">এখনো কোনো রাইড নেই।</p><button class="btn btn-primary btn-block" onclick="go('search')">প্রথম রাইড খুঁজুন 🧭</button>`);
}
function renderHistory(){
  const u=me();
  const done=DB.rides.filter(r=>r.userId===u.id&&["completed","cancelled","expired"].includes(r.status));
  $("#app-main").innerHTML=`<h2 class="section-title">📜 রাইড ইতিহাস</h2>`+
    (done.length?done.map(r=>`<div class="list-item">
      <div class="avatar">${r.animal[1]}</div><div class="grow"><b>${esc(r.pickup.name)} → ${esc(r.dest.name)}</b><br>
      <span class="muted">${fmtD(r.departAt)} • ${r.status==="completed"?("সাশ্রয় "+BDT(r.saved||0)):""}</span><br>${statusPill(r.status)}</div>
    </div>`).join(""):`<p class="muted center">ইতিহাস খালি।</p>`);
}

/* ---------- Profile / Safety / Settings ---------- */
function renderProfile(){
  const u=me();
  $("#app-main").innerHTML=`<h2 class="section-title">👤 প্রোফাইল</h2>
    <div class="card">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <div class="avatar" style="width:64px;height:64px;font-size:1.8rem">${u.avatar||esc(u.name[0])}</div>
        <div><b style="font-size:1.2rem">${esc(u.name)}</b><br><span class="muted">বন্ধু ID: ${u.bondhuId} • যাচাইকৃত ✓</span></div>
      </div>
      <form onsubmit="return saveProfile(event)">
        <div class="field"><label>নাম</label><input id="pf-name" value="${esc(u.name)}"></div>
        <div class="field"><label>ফোন (পরিবর্তনযোগ্য নয়)</label><input value="${esc(u.phone)}" disabled></div>
        <div class="field"><label>লিঙ্গ</label><select id="pf-gender">${["পুরুষ","নারী","অন্যান্য"].map(g=>`<option ${g===u.gender?"selected":""}>${g}</option>`).join("")}</select></div>
        <div class="field"><label>পেশা</label><input id="pf-prof" value="${esc(u.profession||"")}"></div>
        <div class="field"><label>জিমেইল</label><input id="pf-mail" value="${esc(u.mail||"")}"></div>
        <button class="btn btn-primary btn-block">সংরক্ষণ করুন</button>
      </form>
    </div>
    <div class="card" style="margin-top:14px">
      <button class="btn btn-danger btn-block" onclick="if(confirm('অ্যাকাউন্ট মুছে ফেলবেন?')){DB.users=DB.users.filter(x=>x.id!=='${u.id}');DB.rides=DB.rides.filter(r=>r.userId!=='${u.id}');saveDB();logout();}">🗑️ অ্যাকাউন্ট মুছুন</button>
    </div>
    <p class="muted center" style="margin-top:12px"><a href="javascript:void(0)" onclick="logout()">লগআউট →</a></p>`;
}
function saveProfile(e){e.preventDefault();const u=me();
  u.name=$("#pf-name").value.trim()||u.name;u.gender=$("#pf-gender").value;u.profession=$("#pf-prof").value.trim();u.mail=$("#pf-mail").value.trim();
  saveDB();toast("প্রোফাইল আপডেট হয়েছে ✓","ok");return false;}
function reportUser(userId){
  const target=DB.users.find(u=>u.id===userId);
  modal(`<h3>🚩 ${esc(target?.name||"ব্যবহারকারী")}-কে রিপোর্ট</h3>
    <form onsubmit="return submitReport(event,'${userId}')">
      <div class="field"><label>কারণ</label><select id="rp-reason"><option>অশালীন আচরণ</option><option>ফোনে সাড়া নেই</option><option>ভুল তথ্য দিয়েছে</option><option>নিরাপত্তা উদ্বেগ</option><option>অন্যান্য</option></select></div>
      <div class="field"><label>বিস্তারিত</label><textarea id="rp-detail" rows="3" placeholder="কী ঘটেছে লিখুন..."></textarea></div>
      <div class="btn-row"><button class="btn btn-danger" style="flex:1">জমা দিন</button>
      <button type="button" class="btn btn-ghost" onclick="closeModal()">বাতিল</button></div></form>`);
}
function submitReport(e,userId){e.preventDefault();
  DB.reports.push({id:uid(),by:SESSION.userId,against:userId,reason:$("#rp-reason").value,detail:$("#rp-detail").value.trim(),at:Date.now(),status:"open"});
  DB.blocks.push({a:SESSION.userId,b:userId});
  saveDB();closeModal();toast("রিপোর্ট জমা হয়েছে ✓","ok");return false;}
function renderSafety(){
  $("#app-main").innerHTML=`<h2 class="section-title">🛡️ নিরাপত্তা কেন্দ্র</h2>
    <div class="card"><b>⚠️ গুরুত্বপূর্ণ নোট</b><p class="muted">টেসলাবন্ধু শুধু যাত্রী মেলায়। রিকশাচালক বা তৃতীয় পক্ষের নিরাপত্তার নিশ্চয়তা প্ল্যাটফর্ম দেয় না।</p></div>
    <div class="card" style="margin-top:12px"><b>🛡️ নিরাপত্তা টিপস</b>
      <ul style="margin:8px 0 0 18px" class="muted">
        <li>সবসময় জনবহুল, আলো-আলো জায়গায় দেখা করুন</li>
        <li>বন্ধু/পরিবারকে যাত্রার বিবরণ জানিয়ে রাখুন</li>
        <li>রাতের বেলা একা না হওয়াই ভালো</li>
        <li>ভাড়া আগে থেকে ঠিক করে নিন</li></ul></div>
    <div class="card" style="margin-top:12px"><b>🚫 ব্লক করা ব্যবহারকারী</b>
      <p class="muted">${DB.blocks.filter(b=>b.a===SESSION.userId).length||"কেউ নেই"} জন ব্লক করা আছে</p></div>
    <div class="card" style="margin-top:12px"><b>📞 জরুরি হটলাইন</b><p>জাতীয় জরুরি সেবা: <a href="tel:999">৯৯৯</a> • নারী ও শিশু হেল্পলাইন: <a href="tel:109">১০৯</a> • পুলিশ: <a href="tel:999">৯৯৯</a></p></div>`;
}
function renderSettings(){
  const u=me();
  $("#app-main").innerHTML=`<h2 class="section-title">⚙️ সেটিংস</h2>
    <div class="card"><b>🔔 নোটিফিকেশন</b><p class="muted">ইন-অ্যাপ নোটিফিকেশন সক্রিয়। ব্রাউজার পুশ নোটিফিকেশন শীঘ্রই আসছে।</p></div>
    <div class="card" style="margin-top:12px"><b>📍 লোকেশন গোপনীয়তা</b><p class="muted">আপনার ঠিকানা কখনো প্রকাশ করা হয় না। অজ্ঞাত ম্যাচে শুধু আনুমানিক দূরত্ব দেখানো হয়। ম্যাচ শেষ বা বাতিল হলে লোকেশন শেয়ারিং বন্ধ হয়ে যায়।</p></div>
    <div class="card" style="margin-top:12px"><b>🗣️ ভাষা</b><p>বাংলা (প্রাথমিক) • English — শীঘ্রই আসছে</p></div>
    <div class="card" style="margin-top:12px"><b>📄 আইনি</b><p class="muted">সেবার শর্তাবলী • গোপনীয়তা নীতি • ভার্সন 1.0 (MVP)</p></div>
    <button class="btn btn-ghost btn-block" style="margin-top:14px" onclick="logout()">লগআউট</button>`;
}

/* ---------- Admin ---------- */
function adminLoginView(){
  show("auth");$("#auth-box").innerHTML=`<h2>🛠️ অ্যাডমিন লগইন</h2>
    <form onsubmit="return adminLogin(event)">
      <div class="field"><label>অ্যাডমিন ফোন</label><input id="ad-phone" required placeholder="01XXXXXXXXX"></div>
      <div class="field"><label>পাসকোড</label><input id="ad-pass" type="password" required placeholder="••••"></div>
      <button class="btn btn-primary btn-block">প্রবেশ</button>
    </form><p class="dev-otp">🔧 ডেমো: 01700000000 / admin123</p>
    <p class="muted center"><a href="#/login">← ব্যবহারকারী লগইন</a></p>`;
}
function adminLogin(e){e.preventDefault();
  const u=DB.users.find(x=>x.admin&&x.phone===$("#ad-phone").value.trim());
  if(!u||$("#ad-pass").value!=="admin123"){toast("অননুমোদিত অ্যাক্সেস!","err");return false;}
  SESSION={userId:u.id,admin:true};localStorage.setItem("tb_session",JSON.stringify(SESSION));
  toast("অ্যাডমিন লগইন সফল","ok");location.hash="#/admin";return false;}
const Admin={
  exit(){logout();},
  render(){
    const S=DB.settings;
    const rides=DB.rides, users=DB.users.filter(u=>!u.admin);
    const stat=(l,v)=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    $("#admin-main").innerHTML=`
      <h2 class="section-title">📊 ড্যাশবোর্ড</h2>
      <div class="stat-grid">
        ${stat("মোট বন্ধু",users.length)}${stat("যাচাইকৃত",users.filter(u=>u.verified).length)}
        ${stat("সক্রিয় সার্চ",rides.filter(r=>r.status==="searching").length)}
        ${stat("সক্রিয় ম্যাচ",DB.matches.filter(m=>["proposed","accepted_a","accepted_b"].includes(m.status)).length)}
        ${stat("সম্পন্ন রাইড",rides.filter(r=>r.status==="completed").length)}
        ${stat("বাতিল",rides.filter(r=>r.status==="cancelled").length)}
        ${stat("রিপোর্ট",DB.reports.filter(r=>r.status==="open").length)}
      </div>
      <div class="card"><b>⚙️ ম্যাচিং প্যারামিটার</b>
        ${[["maxPickupM","সর্বোচ্চ পিকআপ ব্যবধান (মি)"],["maxDestM","সর্বোচ্চ গন্তব্য ব্যবধান (মি)"],
           ["maxTimeDiffMin","সর্বোচ্চ সময় পার্থক্য (মিনিট)"],["searchExpiryMin","সার্চ মেয়াদ (মিনিট)"],
           ["proposalTimeoutMin","প্রস্তাব টাইমআউট (মিনিট)"],["perKmFare","প্রতি কিমি ভাড়া (৳)"]]
          .map(([k,l])=>`<div class="field"><label>${l}</label><input type="number" id="ad-${k}" value="${S[k]}"></div>`).join("")}
        <div class="field"><label>সর্বনিম্ন রুট সাদৃশ্য (%)</label><input type="number" id="ad-minSim" value="${Math.round(S.minSimilarity*100)}"></div>
        <div class="field"><label>সর্বোচ্চ শেয়ার্ড যাত্রী</label><select id="ad-maxP">${[2,3].map(n=>`<option ${S.maxPassengers===n?"selected":""}>${n}</option>`).join("")}</select></div>
        <button class="btn btn-primary btn-block" onclick="Admin.saveSettings()">💾 সংরক্ষণ</button></div>
      <div class="card" style="margin-top:14px"><b>🚩 খোলা রিপোর্ট</b>
        ${DB.reports.length?DB.reports.map(r=>{const t=DB.users.find(u=>u.id===r.against);
          return `<div class="list-item"><div class="grow"><b>${esc(t?.name||"?")}</b><br><span class="muted">${esc(r.reason)} — ${esc(r.detail||"")}</span></div>
          <button class="btn btn-sm btn-danger" onclick="Admin.suspend('${r.against}')">সাসপেন্ড</button></div>`;}).join(""):'<p class="muted">কোনো রিপোর্ট নেই</p>'}</div>
      <div class="card" style="margin-top:14px"><b>🛺 সাম্প্রতিক রাইড</b>
        ${rides.slice(-6).reverse().map(r=>`<div class="mrow"><span>${esc(r.pickup.name)} → ${esc(r.dest.name)}</span>${statusPill(r.status)}</div>`).join("")}</div>`;
  },
  saveSettings(){const S=DB.settings;
    ["maxPickupM","maxDestM","maxTimeDiffMin","searchExpiryMin","proposalTimeoutMin","perKmFare"].forEach(k=>S[k]=+$("#ad-"+k).value||S[k]);
    S.minSimilarity=Math.min(100,Math.max(0,+$("#ad-minSim").value||75))/100;
    S.maxPassengers=+$("#ad-maxP").value;saveDB();toast("সেটিংস সংরক্ষিত ✓","ok");},
  suspend(id){const u=DB.users.find(x=>x.id===id);if(!u)return;u.suspended=!u.suspended;
    DB.reports.forEach(r=>{if(r.against===id)r.status="resolved"});saveDB();
    toast(u.suspended?"ব্যবহারকারী সাসপেন্ড হয়েছে":"সাসপেন্ড তুলে নেওয়া হয়েছে",u.suspended?"err":"ok");Admin.render();}
};

/* ---------- Demo mode ---------- */
function startDemo(){
  const u=DB.users.find(x=>x.id==="demo-user")||{id:"demo-user",bondhuId:"BD-2001",name:"ডেমো বন্ধু",phone:"01800000000",gender:"পুরুষ",profession:"ডেমো",verified:true,avatar:"🧑",createdAt:Date.now()};
  if(!DB.users.includes(u))DB.users.push(u);
  saveDB();SESSION={userId:u.id};localStorage.setItem("tb_session",JSON.stringify(SESSION));
  toast("ডেমো মোড চালু 🚀","ok");location.hash="#/dashboard";
}

/* ---------- expiry sweeper ---------- */
setInterval(()=>{if(!DB)return;let ch=false;const now=Date.now();
  DB.rides.forEach(r=>{if(r.status==="searching"&&r.expiryAt&&now>r.expiryAt){r.status="expired";ch=true;
    notify(r.userId,"⌛ সার্চের মেয়াদ শেষ","নতুন সময় দিয়ে আবার খুঁজুন।");}});
  DB.matches.forEach(m=>{if(["proposed","accepted_a","accepted_b"].includes(m.status)&&now>m.expiresAt){expireProposal(m);ch=true;}});
  if(ch){saveDB();if(SESSION)renderRoute();}},15000);

/* ---------- boot ---------- */
loadDB();
renderRoute();
if(SESSION&&me())bellDot();
