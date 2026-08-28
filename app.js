const DB_KEY='pupsPhysicsDB';
const PENDING_ROLE='pupsPendingRole';
const SESSION_KEY='pupsSession';
const REMEMBER_KEY='pupsRememberedLogin';

const defaultDB={
  events:[
    {id:1,title:'Orbital Chaos Workshop',date:'2026-09-12',type:'Workshop',description:'Hands-on numerical exploration of restricted three-body dynamics.'},
    {id:2,title:'Physics Society Orientation',date:'2026-09-21',type:'Society',description:'Meet the team, discover projects and find your way into the society.'},
    {id:3,title:'Annual Research Showcase',date:'2026-10-03',type:'Showcase',description:'Students present current projects, computational work and experimental ideas.'}
  ],
  colloquia:[
    {id:1,title:'Particle Swarm Optimization for Gravitational Wave Detection',speaker:'Aritra Bakshi',date:'2026-11-18',field:'Astrophysics',description:'Computational methods for accelerating matched-filter searches.'},
    {id:2,title:'Dynamic Light Scattering and Mie Regimes',speaker:'Debanjana Mukherjee',date:'2026-10-21',field:'Optics',description:'Experimental particle sizing across Rayleigh and Mie scattering.'},
    {id:3,title:'Next-Generation Energy Harvesting Materials',speaker:'Dr. Madhubanti Mukherjee',date:'2026-10-14',field:'Condensed Matter',description:'Thermoelectrics, DFT and machine learning.'}
  ],
  stats:{publications:142,attendance:94,researchers:86,projects:12},
  members:[
    {id:1,name:'Aritra Bakshi',role:'President',email:'aritra@example.org',status:'Authorized'},
    {id:2,name:'Debanjana Mukherjee',role:'Academic Coordinator',email:'debanjana@example.org',status:'Authorized'},
    {id:3,name:'PUPS Administrator',role:'Administrator',email:'admin@example.org',status:'Authorized'}
  ],
  security:{twoFactor:true,sessionHours:8,loginAlerts:true},
  loginAttempts:[]
};

function clone(v){return JSON.parse(JSON.stringify(v));}
function loadDB(){
  try{const raw=localStorage.getItem(DB_KEY); return raw?{...clone(defaultDB),...JSON.parse(raw)}:clone(defaultDB)}
  catch{return clone(defaultDB)}
}
function saveDB(db){localStorage.setItem(DB_KEY,JSON.stringify(db))}
if(!localStorage.getItem(DB_KEY)) saveDB(defaultDB);

function qs(s){return document.querySelector(s)}
function qsa(s){return [...document.querySelectorAll(s)]}
function escapeHTML(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
function formatDate(d){const x=new Date(d+'T00:00:00');return x.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})}
function currentPage(){return location.pathname.split('/').pop()||'index.html'}

function initNav(){
  const btn=qs('#menuToggle'),nav=qs('#mainNav');
  if(btn&&nav) btn.onclick=()=>nav.classList.toggle('open');
}

function renderHome(){
  const host=qs('#homeEvents'); if(!host)return;
  const db=loadDB();
  host.innerHTML=db.events.slice(0,3).map(e=>`<article class="card"><div class="meta">${escapeHTML(e.type)} • ${formatDate(e.date)}</div><h3>${escapeHTML(e.title)}</h3><p>${escapeHTML(e.description)}</p><a class="text-link" href="events.html">View event →</a></article>`).join('');
  const stats=qs('#homeStats');
  if(stats) stats.innerHTML=`<div><span class="signal-number">${db.stats.publications}</span><span>publications / projects</span></div><div><span class="signal-number">${db.stats.projects}</span><span>active initiatives</span></div><div><span class="signal-number">03</span><span>access levels</span></div><div><span class="signal-number">∞</span><span>questions worth asking</span></div>`;
}
function renderEvents(){
  const host=qs('#eventsGrid');if(!host)return;const db=loadDB();
  const query=(qs('#eventSearch')?.value||'').toLowerCase();
  host.innerHTML=db.events.filter(e=>(e.title+e.type+e.description).toLowerCase().includes(query)).map(e=>`<article class="card"><div class="meta">${escapeHTML(e.type)} • ${formatDate(e.date)}</div><h3>${escapeHTML(e.title)}</h3><p>${escapeHTML(e.description)}</p><p><strong>Date</strong> ${formatDate(e.date)}</p></article>`).join('')||'<div class="notice">No matching events.</div>';
}
function renderColloquia(){
  const host=qs('#colloquiaGrid');if(!host)return;const db=loadDB();
  const query=(qs('#colloquiaSearch')?.value||'').toLowerCase();const field=qs('#colloquiaField')?.value||'all';
  host.innerHTML=db.colloquia.filter(c=>(field==='all'||c.field===field)&&(c.title+c.speaker+c.field+c.description).toLowerCase().includes(query)).map(c=>`<article class="card"><div class="meta">${escapeHTML(c.field)} • ${formatDate(c.date)}</div><h3>${escapeHTML(c.title)}</h3><p><strong>${escapeHTML(c.speaker)}</strong></p><p>${escapeHTML(c.description)}</p></article>`).join('')||'<div class="notice">No colloquia found.</div>';
}

function initPublicPages(){
  initNav(); renderHome(); renderEvents(); renderColloquia();
  qs('#eventSearch')?.addEventListener('input',renderEvents);
  qs('#colloquiaSearch')?.addEventListener('input',renderColloquia);
  qs('#colloquiaField')?.addEventListener('change',renderColloquia);
}

function roleLabel(role){return role==='admin'?'Administrator':role==='member'?'Society Member':'Student'}
function normalizedRole(role){return role==='admin'?'admin':role==='member'?'member':'student'}
function getStoredSession(){
  try{
    let s=sessionStorage.getItem(SESSION_KEY);
    if(s)return JSON.parse(s);
    s=localStorage.getItem(SESSION_KEY);
    return s?JSON.parse(s):null;
  }catch{return null}
}
function clearSession(){sessionStorage.removeItem(SESSION_KEY);localStorage.removeItem(SESSION_KEY)}
function isAuthorized(id,role){
  if(role==='student') return true;
  const db=loadDB();
  const email=(id||'').toLowerCase();
  return !!db.members.find(m=>m.email.toLowerCase()===email && m.status==='Authorized' && ((role==='admin'&&m.role==='Administrator')||(role==='member'&&m.role!=='Administrator')));
}
function addLoginRecord({id,role,remember}){
  const db=loadDB();
  db.loginAttempts=(db.loginAttempts||[]);
  db.loginAttempts.unshift({
    id:Date.now(),email:id,role,loginAt:new Date().toISOString(),
    page:currentPage(),referrer:document.referrer||'Direct / Login page',
    userAgent:navigator.userAgent,remember:!!remember,status:'Active'
  });
  db.loginAttempts=db.loginAttempts.slice(0,100);
  saveDB(db);
}
function endOwnLoginRecord(){
  const s=getStoredSession();if(!s)return;
  const db=loadDB();
  const rec=db.loginAttempts?.find(x=>x.email===s.id&&x.role===s.role&&x.status==='Active');
  if(rec){rec.status='Logged out';rec.logoutAt=new Date().toISOString();saveDB(db)}
}
function setAuth(role){
  role=normalizedRole(role); localStorage.setItem(PENDING_ROLE,role);
  qsa('.role-option').forEach(x=>x.classList.toggle('active',x.dataset.role===role));
  const label=qs('#selectedRole');if(label)label.textContent=roleLabel(role);
  const note=qs('#loginRoleNote');
  if(note) note.textContent=role==='student'?'Anyone may enter the Student portal; no member authorization is required.':role==='member'?'Member access requires an authorized Society email/ID and opens content management only.':'Admin access requires an authorized administrator account and opens the complete control centre.';
}
function initLogin(){
  initNav();
  setAuth(localStorage.getItem(PENDING_ROLE)||'student');
  qsa('.role-option').forEach(x=>x.onclick=()=>setAuth(x.dataset.role));
  const saved=localStorage.getItem(REMEMBER_KEY);
  if(saved){try{const d=JSON.parse(saved);qs('#loginId').value=d.id||'';const box=qs('#rememberMe');if(box)box.checked=true;setAuth(d.role||'student')}catch{}}
  const form=qs('#loginForm');
  if(!form)return;
  form.onsubmit=e=>{
    e.preventDefault();
    const role=normalizedRole(localStorage.getItem(PENDING_ROLE)||'student');
    const id=qs('#loginId').value.trim();const err=qs('#loginError');
    const remember=!!qs('#rememberMe')?.checked;
    if(!id){err.textContent='Enter your email or ID.';return}
    if(role!=='student'&&!isAuthorized(id,role)){
      err.textContent='This account is not currently authorized for the selected access level.';return;
    }
    endOwnLoginRecord();clearSession();
    const session={role,id,at:Date.now(),remember};
    if(remember)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
    if(remember)localStorage.setItem(REMEMBER_KEY,JSON.stringify({id,role})); else localStorage.removeItem(REMEMBER_KEY);
    addLoginRecord({id,role,remember});
    location.href=role==='student'?'student.html':role==='member'?'member.html':'admin.html';
  };
}
function requireRole(role){
  try{
    const s=getStoredSession();
    if(!s||s.role!==role){location.replace('login.html');return null}
    if(Date.now()-s.at>loadDB().security.sessionHours*60*60*1000){clearSession();location.replace('login.html');return null}
    if(role!=='student'&&!isAuthorized(s.id,role)){clearSession();location.replace('login.html');return null}
    return s;
  }catch{location.replace('login.html');return null}
}
function logout(){endOwnLoginRecord();clearSession();location.href='login.html'}

function renderMember(){
  const db=loadDB();
  const stats=qs('#memberStats'); if(stats) stats.innerHTML=`<div class="stat"><span>Events</span><strong>${db.events.length}</strong></div><div class="stat"><span>Colloquia</span><strong>${db.colloquia.length}</strong></div><div class="stat"><span>Publications</span><strong>${db.stats.publications}</strong></div><div class="stat"><span>Researchers</span><strong>${db.stats.researchers}</strong></div>`;
  const ev=qs('#memberEvents');
  if(ev) ev.innerHTML=db.events.map(e=>`<div class="manage-item"><form class="inline-edit" onsubmit="updateEvent(event,${e.id})"><div class="edit-grid"><input id="evt-title-${e.id}" value="${escapeHTML(e.title)}" aria-label="Event title"><input id="evt-date-${e.id}" type="date" value="${escapeHTML(e.date)}" aria-label="Event date"><input id="evt-type-${e.id}" value="${escapeHTML(e.type)}" aria-label="Event type"><textarea id="evt-desc-${e.id}" aria-label="Event description">${escapeHTML(e.description)}</textarea></div><div class="edit-actions"><button class="mini-btn" type="submit">Save</button><button class="mini-btn danger" type="button" onclick="deleteEvent(${e.id})">Delete</button></div></form></div>`).join('');
  const co=qs('#memberColloquia');
  if(co) co.innerHTML=db.colloquia.map(c=>`<div class="manage-item"><form class="inline-edit" onsubmit="updateColloquium(event,${c.id})"><div class="edit-grid"><input id="col-title-${c.id}" value="${escapeHTML(c.title)}" aria-label="Colloquium title"><input id="col-speaker-${c.id}" value="${escapeHTML(c.speaker)}" aria-label="Speaker"><input id="col-date-${c.id}" type="date" value="${escapeHTML(c.date)}" aria-label="Date"><input id="col-field-${c.id}" value="${escapeHTML(c.field)}" aria-label="Field"><textarea id="col-desc-${c.id}" aria-label="Description">${escapeHTML(c.description)}</textarea></div><div class="edit-actions"><button class="mini-btn" type="submit">Save</button><button class="mini-btn danger" type="button" onclick="deleteColloquium(${c.id})">Delete</button></div></form></div>`).join('');
}
function updateEvent(e,id){
  e.preventDefault();const s=getStoredSession();if(!s||s.role!=='member')return;
  const db=loadDB(),item=db.events.find(x=>x.id===id);if(!item)return;
  item.title=qs('#evt-title-'+id).value.trim();item.date=qs('#evt-date-'+id).value;item.type=qs('#evt-type-'+id).value.trim();item.description=qs('#evt-desc-'+id).value.trim();
  saveDB(db);renderMember();
}
function updateColloquium(e,id){
  e.preventDefault();const s=getStoredSession();if(!s||s.role!=='member')return;
  const db=loadDB(),item=db.colloquia.find(x=>x.id===id);if(!item)return;
  item.title=qs('#col-title-'+id).value.trim();item.speaker=qs('#col-speaker-'+id).value.trim();item.date=qs('#col-date-'+id).value;item.field=qs('#col-field-'+id).value.trim();item.description=qs('#col-desc-'+id).value.trim();
  saveDB(db);renderMember();
}
function deleteEvent(id){const s=getStoredSession();if(!s||s.role!=='member')return;const db=loadDB();db.events=db.events.filter(e=>e.id!==id);saveDB(db);renderMember()}
function deleteColloquium(id){const s=getStoredSession();if(!s||s.role!=='member')return;const db=loadDB();db.colloquia=db.colloquia.filter(e=>e.id!==id);saveDB(db);renderMember()}
function bindMemberForms(){
  qs('#addEventForm')?.addEventListener('submit',e=>{e.preventDefault();const db=loadDB();db.events.unshift({id:Date.now(),title:qs('#evTitle').value,date:qs('#evDate').value,type:qs('#evType').value,description:qs('#evDesc').value});saveDB(db);e.target.reset();renderMember();});
  qs('#addColloquiumForm')?.addEventListener('submit',e=>{e.preventDefault();const db=loadDB();db.colloquia.unshift({id:Date.now(),title:qs('#coTitle').value,speaker:qs('#coSpeaker').value,date:qs('#coDate').value,field:qs('#coField').value,description:qs('#coDesc').value});saveDB(db);e.target.reset();renderMember();});
  qs('#statsForm')?.addEventListener('submit',e=>{e.preventDefault();const db=loadDB();db.stats.publications=Number(qs('#statPublications').value);db.stats.attendance=Number(qs('#statAttendance').value);db.stats.researchers=Number(qs('#statResearchers').value);db.stats.projects=Number(qs('#statProjects').value);saveDB(db);renderMember();});
}
function initMember(){
  const s=requireRole('member');if(!s)return;initNav();
  const db=loadDB();const name=qs('#memberName');if(name)name.textContent=s.id;
  if(qs('#statPublications'))qs('#statPublications').value=db.stats.publications;
  if(qs('#statAttendance'))qs('#statAttendance').value=db.stats.attendance;
  if(qs('#statResearchers'))qs('#statResearchers').value=db.stats.researchers;
  if(qs('#statProjects'))qs('#statProjects').value=db.stats.projects;
  renderMember();bindMemberForms();
}

function renderAdmin(){
  const db=loadDB();
  const stats=qs('#adminStats');if(stats)stats.innerHTML=`<div class="stat"><span>Events</span><strong>${db.events.length}</strong></div><div class="stat"><span>Colloquia</span><strong>${db.colloquia.length}</strong></div><div class="stat"><span>Authorized users</span><strong>${db.members.filter(m=>m.status==='Authorized').length}</strong></div><div class="stat"><span>Active login records</span><strong>${(db.loginAttempts||[]).filter(x=>x.status==='Active').length}</strong></div>`;
  const tbody=qs('#memberAuthTable');if(tbody)tbody.innerHTML=db.members.map(m=>`<tr><td>${escapeHTML(m.name)}</td><td>${escapeHTML(m.role)}</td><td>${escapeHTML(m.email)}</td><td class="${m.status==='Authorized'?'success':'danger'}">${escapeHTML(m.status)}</td><td><button class="mini-btn" onclick="toggleMember(${m.id})">${m.status==='Authorized'?'Deny':'Authorize'}</button></td></tr>`).join('');
  const logs=qs('#loginStatusTable');if(logs)logs.innerHTML=(db.loginAttempts||[]).slice(0,40).map(x=>`<tr><td>${escapeHTML(x.email)}</td><td>${escapeHTML(roleLabel(x.role))}</td><td>${new Date(x.loginAt).toLocaleString()}</td><td>${escapeHTML(x.page)}</td><td title="${escapeHTML(x.userAgent)}">${escapeHTML(x.referrer)}</td><td><span class="${x.status==='Active'?'success':'danger'}">${escapeHTML(x.status)}</span></td><td><button class="mini-btn danger" onclick="denyLogin('${encodeURIComponent(x.email)}')">Deny email</button></td></tr>`).join('')||'<tr><td colspan="7">No login records yet.</td></tr>';
}
function toggleMember(id){
  const db=loadDB();const m=db.members.find(x=>x.id===id);if(!m)return;
  if(m.role==='Administrator'&&m.status==='Authorized'&&db.members.filter(x=>x.role==='Administrator'&&x.status==='Authorized').length<=1){alert('Keep at least one authorized administrator.');return;}
  m.status=m.status==='Authorized'?'Revoked':'Authorized';
  if(m.status==='Revoked'){db.loginAttempts=(db.loginAttempts||[]).map(x=>x.email.toLowerCase()===m.email.toLowerCase()&&x.status==='Active'?{...x,status:'Denied by admin',deniedAt:new Date().toISOString()}:x)}
  saveDB(db);renderAdmin();
}
function denyLogin(encodedEmail){
  const email=decodeURIComponent(encodedEmail).toLowerCase();
  const db=loadDB();const m=db.members.find(x=>x.email.toLowerCase()===email);
  if(!m){alert('No authorized account found for this email.');return}
  if(m.role==='Administrator'&&m.status==='Authorized'&&db.members.filter(x=>x.role==='Administrator'&&x.status==='Authorized').length<=1){alert('You cannot deny the last authorized administrator.');return}
  m.status='Revoked';
  db.loginAttempts=(db.loginAttempts||[]).map(x=>x.email.toLowerCase()===email&&x.status==='Active'?{...x,status:'Denied by admin',deniedAt:new Date().toISOString()}:x);
  saveDB(db);renderAdmin();
}
function initAdmin(){
  const s=requireRole('admin');if(!s)return;initNav();
  const db=loadDB();
  if(qs('#sec2fa'))qs('#sec2fa').checked=db.security.twoFactor;
  if(qs('#secAlerts'))qs('#secAlerts').checked=db.security.loginAlerts;
  if(qs('#sessionHours'))qs('#sessionHours').value=db.security.sessionHours;
  renderAdmin();
  qs('#securityForm')?.addEventListener('submit',e=>{e.preventDefault();const d=loadDB();d.security.twoFactor=qs('#sec2fa').checked;d.security.loginAlerts=qs('#secAlerts').checked;d.security.sessionHours=Number(qs('#sessionHours').value);saveDB(d);qs('#securitySaved').textContent='Security settings saved.';renderAdmin()});
  qs('#authForm')?.addEventListener('submit',e=>{e.preventDefault();const d=loadDB();d.members.unshift({id:Date.now(),name:qs('#authName').value,role:qs('#authRole').value,email:qs('#authEmail').value.trim(),status:'Authorized'});saveDB(d);e.target.reset();renderAdmin()});
}
function initStudent(){const s=requireRole('student');if(!s)return;initNav();const id=qs('#studentId');if(id)id.textContent=s.id}

window.deleteEvent=deleteEvent;window.deleteColloquium=deleteColloquium;window.updateEvent=updateEvent;window.updateColloquium=updateColloquium;window.toggleMember=toggleMember;window.denyLogin=denyLogin;window.logout=logout;
document.addEventListener('DOMContentLoaded',()=>{
  const page=currentPage();
  if(page==='login.html')initLogin();
  else if(page==='member.html')initMember();
  else if(page==='admin.html')initAdmin();
  else if(page==='student.html')initStudent();
  else initPublicPages();
});

// Dedicated Google Sheets Authentication API for APEX Physics Society Website
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHBedOuksuHSVzd_FZgBRIoFtO6UyKpYZcG9JV0KrUJJgUNInTV4j6kKuuvIfl8oq_/exec";

/**
 * 1. Computes client-side SHA-256 hash for secure password transmission
 * @param {string} password - Raw password string from input
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 2. Authenticates user against Google Sheets DB and redirects based on assigned role
 * @param {string} email - User email address
 * @param {string} password - User password
 */
async function executeDatabaseLogin(email, password) {
  const submitBtn = document.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerText : '';

  try {
    if (submitBtn) {
      submitBtn.innerText = 'Authenticating...';
      submitBtn.disabled = true;
    }

    const hashedPassword = await hashPassword(password);
    
    // Send POST payload to Google Apps Script Web App
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        email: email,
        passwordHash: hashedPassword
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      // Store user session info in browser localStorage
      localStorage.setItem('userRole', result.role);
      localStorage.setItem('userName', result.name);
      localStorage.setItem('userEmail', result.email);

      alert(`Welcome, ${result.name}! Logged in as [${result.role.toUpperCase()}]`);

      // Redirect to the appropriate HTML page in your repository based on role
      if (result.role === 'admin') {
        window.location.href = 'admin.html';
      } else if (result.role === 'student') {
        window.location.href = 'student.html';
      } else {
        window.location.href = 'member.html';
      }

    } else {
      alert(`Authentication Failed: ${result.message}`);
    }
  } catch (error) {
    console.error('Login request failed:', error);
    alert('Failed to connect to authentication server. Check network connection.');
  } finally {
    if (submitBtn) {
      submitBtn.innerText = originalBtnText;
      submitBtn.disabled = false;
    }
  }
}

/**
 * 3. Form submission event listener for login.html
 */
function handleLoginSubmit(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('emailInput') || document.querySelector('input[type="email"]');
  const passwordInput = document.getElementById('passwordInput') || document.querySelector('input[type="password"]');

  if (!emailInput || !passwordInput) {
    alert('Error: Email or password input fields not found on this page.');
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  executeDatabaseLogin(email, password);
}

// Automatically attach listener to login form if present on page load
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm') || document.querySelector('form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
});
