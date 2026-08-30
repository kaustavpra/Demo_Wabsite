// ==========================================
// CORE SETTINGS & UI DATABASE
// ==========================================
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyHhocPxCgSzxMkvvD4n4zcQvpnQpsBURaN1WysDgEjri2pnu-U40RrzV_N7yc0ifT6/exec"; 

const DB_KEY = 'pupsPhysicsDB'; 
const PENDING_ROLE = 'pupsPendingRole'; 
const SESSION_KEY = 'pupsSession'; 
const REMEMBER_KEY = 'pupsRememberedLogin'; 

// This mock DB is now ONLY for UI content (events, colloquia). Authentication is handled by the backend.
const defaultDB = {   
  events: [     
    {id:1, title:'Orbital Chaos Workshop', date:'2026-09-12', type:'Workshop', description:'Hands-on numerical exploration of restricted three-body dynamics.'},     
    {id:2, title:'Physics Society Orientation', date:'2026-09-21', type:'Society', description:'Meet the team, discover projects and find your way into the society.'}   
  ],   
  colloquia: [     
    {id:1, title:'Particle Swarm Optimization for Gravitational Wave Detection', speaker:'Aritra Bakshi', date:'2026-11-18', field:'Astrophysics', description:'Computational methods for accelerating matched-filter searches.'}
  ],   
  stats: {publications:142, attendance:94, researchers:86, projects:12}
};

function clone(v) { return JSON.parse(JSON.stringify(v)); } 
function loadDB() { try { const raw = localStorage.getItem(DB_KEY); return raw ? {...clone(defaultDB), ...JSON.parse(raw)} : clone(defaultDB); } catch { return clone(defaultDB); } }
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); } 
if(!localStorage.getItem(DB_KEY)) saveDB(defaultDB); 

function qs(s) { return document.querySelector(s); } 
function qsa(s) { return [...document.querySelectorAll(s)]; } 
function escapeHTML(v) { const d = document.createElement('div'); d.textContent = v ?? ''; return d.innerHTML; } 
function formatDate(d) { const x = new Date(d + 'T00:00:00'); return x.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); } 
function currentPage() { return location.pathname.split('/').pop() || 'index.html'; } 

function initNav() {   
  const btn = qs('#menuToggle'), nav = qs('#mainNav');   
  if(btn && nav) btn.onclick = () => nav.classList.toggle('open'); 
}

// ==========================================
// AUTHENTICATION & BACKEND LOGIC
// ==========================================

async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getStoredSession() {   
  try {     
    let s = sessionStorage.getItem(SESSION_KEY);     
    if(s) return JSON.parse(s);     
    s = localStorage.getItem(SESSION_KEY);     
    return s ? JSON.parse(s) : null;   
  } catch { return null; } 
}

function clearSession() { 
  sessionStorage.removeItem(SESSION_KEY); 
  localStorage.removeItem(SESSION_KEY); 
}

function requireRole(role) {   
  const s = getStoredSession();
  if(!s || (role !== 'student' && s.role !== role && s.role !== 'admin')) {
    location.replace('login.html'); 
    return null;
  }
  return s;
}

function logout() { 
  clearSession(); 
  location.href = 'login.html'; 
}

function setAuth(role) {   
  localStorage.setItem(PENDING_ROLE, role);   
  qsa('.role-option').forEach(x => x.classList.toggle('active', x.dataset.role === role));   
  const label = qs('#selectedRole'); 
  if(label) label.textContent = role === 'admin' ? 'Administrator' : role === 'member' ? 'Society Member' : 'Student';   
}

function initLogin() {   
  initNav();   
  setAuth(localStorage.getItem(PENDING_ROLE) || 'student');   
  qsa('.role-option').forEach(x => x.onclick = () => setAuth(x.dataset.role));   
  
  const saved = localStorage.getItem(REMEMBER_KEY);   
  if(saved) {
    try {
      const d = JSON.parse(saved); 
      if(qs('#emailInput')) qs('#emailInput').value = d.id || ''; 
      if(qs('#rememberMe')) qs('#rememberMe').checked = true; 
      setAuth(d.role || 'student');
    } catch {}
  }   

  const form = qs('#loginForm');   
  if(!form) return;   
  
  form.onsubmit = async (e) => {     
    e.preventDefault();     
    const requestedRole = localStorage.getItem(PENDING_ROLE) || 'student';     
    const email = qs('#emailInput').value.trim();
    const password = qs('#passwordInput').value;
    const err = qs('#loginError');     
    const remember = !!qs('#rememberMe')?.checked;     
    const submitBtn = qs('button[type="submit"]');

    if(!email || !password) { err.textContent = 'Enter email and password.'; return; }     

    try {
      submitBtn.innerText = 'Authenticating...';
      submitBtn.disabled = true;
      err.textContent = '';

      const passwordHash = await hashPassword(password);
      
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow', // Add this
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // Add this to bypass CORS preflight
        },
        body: JSON.stringify({ action: 'login', email: email, passwordHash: passwordHash, requestedRole: requestedRole })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        const session = { role: result.role, id: result.email, name: result.name, at: Date.now() };
        if (remember) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); 
        else sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({id: email, role: requestedRole})); 
        else localStorage.removeItem(REMEMBER_KEY);
        
        // Route based on actual role returned from database
        location.href = result.role === 'student' ? 'student.html' : result.role === 'member' ? 'member.html' : 'admin.html';
      } else {
        err.textContent = result.message;
      }
    } catch (error) {
      err.textContent = 'Network error. Please try again.';
    } finally {
      submitBtn.innerText = 'Continue  ';
      submitBtn.disabled = false;
    }
  }; 
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================
function initAdmin() {   
  const s = requireRole('admin'); 
  if(!s) return; 
  initNav();   
  
  qs('#authForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button');
    const originalText = submitBtn.innerText;
    
    const name = qs('#authName').value;
    const roleRaw = qs('#authRole').value.toLowerCase();
    const role = roleRaw.includes('admin') ? 'admin' : 'member';
    const email = qs('#authEmail').value.trim();

    try {
      submitBtn.innerText = 'Authorizing...';
      submitBtn.disabled = true;

      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow', // Add this
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // Add this
        },
        body: JSON.stringify({ action: 'authorize', email: email, role: role, name: name })
      });
      
      const result = await response.json();
      if(result.status === 'success') {
        alert(name + ' successfully added to database as ' + role);
        e.target.reset();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (err) {
      alert('Network error communicating with database.');
    } finally {
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
    }
  }); 
}

// ==========================================
// PAGE INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {   
  const page = currentPage();   
  if(page === 'login.html') initLogin();   
  else if(page === 'admin.html') initAdmin();   
  else if(page === 'student.html' || page === 'member.html') {
    initNav(); // Simple init for these, content logic can be added later
  }
  else initNav(); // Public pages
});

window.logout = logout;
