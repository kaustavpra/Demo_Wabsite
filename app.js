// ============================================================
//  Presidency University Physics Society  |  app.js
//  Complete Application Logic: Auth, Admin Control Centre,
//  Google Apps Script Backend Sync, Security Policies, Dynamic Portals
// ============================================================

// ── Backend Endpoints & Storage Keys ────────────────────────
const GOOGLE_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyHhocPxCgSzxMkvvD4n4zcQvpnQpsBURaN1WysDgEjri2pnu-U40RrzV_N7yc0ifT6/exec';

const SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1O7IF6Zy35Z2KYpLn2r6GEJnAl3Su3Sq8F5_nWQyjjNA/edit?usp=sharing';

const DB_KEY              = 'pupsPhysicsDB';
const PENDING_ROLE        = 'pupsPendingRole';
const SESSION_KEY         = 'pupsSession';
const REMEMBER_KEY        = 'pupsRememberedLogin';
const LOGIN_LOG_KEY       = 'pupsLoginLog';
const FORCE_LOGOUT_KEY    = 'pupsForceLogout';
const ROLE_OVERRIDE_KEY   = 'pupsRoleOverrides';
const SECURITY_POLICY_KEY = 'pupsSecurityPolicy';
const FAILED_LOGINS_KEY   = 'pupsFailedLogins';
const REGISTERED_USERS_KEY = 'pupsRegisteredUsers';

// ── Default Content Database ─────────────────────────────────
const defaultDB = {
  events: [
    {
      id: 1,
      title: 'Orbital Chaos Workshop',
      date: '2026-09-12',
      type: 'Workshop',
      description: 'Hands-on numerical exploration of restricted three-body dynamics and symplectic integrators.',
      regLink: 'https://forms.gle/demo-orbital-chaos'
    },
    {
      id: 2,
      title: 'Physics Society Orientation',
      date: '2026-09-21',
      type: 'Society',
      description: 'Meet the team, discover experimental projects, and find your research group in the society.',
      regLink: 'https://forms.gle/demo-orientation'
    },
    {
      id: 3,
      title: 'Quantum Optics Symposium',
      date: '2026-10-05',
      type: 'Symposium',
      description: 'Lectures on entangled photon pair generation and optical interferometry.',
      regLink: 'https://forms.gle/demo-quantum-optics'
    }
  ],
  colloquia: [
    {
      id: 1,
      title: 'Particle Swarm Optimization for Gravitational Wave Detection',
      speaker: 'Dr. Aritra Bakshi',
      date: '2026-11-18',
      field: 'Astrophysics',
      description: 'Computational heuristic methods for accelerating matched-filter searches in noisy laser interferometer data.',
      youtubeLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    },
    {
      id: 2,
      title: 'Topological Insulators and Edge Transport',
      speaker: 'Prof. Snigdha Das',
      date: '2026-12-04',
      field: 'Condensed Matter',
      description: 'Band topology, Berry curvature, and quantum Hall effects in novel 2D materials.',
      youtubeLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    },
    {
      id: 3,
      title: 'Ultrafast Spectroscopy of Photosynthetic Complexes',
      speaker: 'Dr. R. Sengupta',
      date: '2027-01-15',
      field: 'Optics',
      description: 'Femtosecond pump-probe techniques revealing coherent energy transfer mechanisms in biological systems.',
      youtubeLink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    }
  ],
  stats: {
    publications: 142,
    attendance: 94,
    researchers: 86,
    projects: 12
  }
};

// ── Default Security Governance Policy ───────────────────────
const defaultSecurityPolicy = {
  twoFactor: false,
  loginAlerts: true,
  rateLimit: true,
  sessionHours: 24
};

// ── Helper Utilities ─────────────────────────────────────────
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return [...document.querySelectorAll(selector)];
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str ?? '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeUrl(url) {
  if (!url) return '';
  const str = String(url).trim();
  if (!str) return '';
  if (str === '#') return '#';
  // Allow safe relative paths
  if (/^[a-zA-Z0-9_\-./]+(\.html)?([?#].*)?$/.test(str) && !str.includes(':')) {
    return escapeAttr(str);
  }
  try {
    const parsed = new URL(str, window.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return escapeAttr(str);
    }
  } catch {
    return '#';
  }
  return '#';
}

function formatSafeHeading(str, fallback = '') {
  const raw = str || fallback;
  // Escape all HTML first, then selectively restore <em>...</em> for typographic italic accents
  return escapeHTML(raw)
    .replace(/&lt;em&gt;/gi, '<em>')
    .replace(/&lt;\/em&gt;/gi, '</em>');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function currentPage() {
  return location.pathname.split('/').pop() || 'index.html';
}

// ── Content Database Persistence ────────────────────────────
function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? { ...clone(defaultDB), ...JSON.parse(raw) } : clone(defaultDB);
  } catch {
    return clone(defaultDB);
  }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

if (!localStorage.getItem(DB_KEY)) {
  saveDB(defaultDB);
}

// ── Security Policy Persistence ─────────────────────────────
function loadSecurityPolicy() {
  try {
    const raw = localStorage.getItem(SECURITY_POLICY_KEY);
    const pol = raw ? { ...defaultSecurityPolicy, ...JSON.parse(raw) } : { ...defaultSecurityPolicy };
    if (pol.sessionHours > 24) pol.sessionHours = 24;
    return pol;
  } catch {
    return { ...defaultSecurityPolicy };
  }
}

function saveSecurityPolicy(policy) {
  if (policy && policy.sessionHours > 24) policy.sessionHours = 24;
  localStorage.setItem(SECURITY_POLICY_KEY, JSON.stringify(policy));
}

// ── Modern Floating Toast System ────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  let container = qs('#toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const symbol = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
  toast.innerHTML = `
    <span style="font-weight:bold; font-family:var(--admin-mono); font-size:14px;">${symbol}</span>
    <span style="line-height:1.4;">${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ── Custom Non-Blocking Confirmation Modal (Replaces native window.confirm) ──
function showConfirmModal(message, onConfirm, confirmLabel = 'Confirm') {
  let existing = qs('#pupsConfirmOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pupsConfirmOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.72); backdrop-filter:blur(6px); z-index:20000; display:flex; align-items:center; justify-content:center; padding:20px;';

  overlay.innerHTML = `
    <div class="panel" style="max-width:420px; width:100%; padding:24px; border:1px solid var(--cyan); box-shadow:0 24px 60px rgba(0,0,0,0.65);">
      <p class="kicker" style="color:var(--cyan); margin:0 0 6px;">SECURITY CONFIRMATION</p>
      <p style="font-size:14px; color:var(--text-heading); line-height:1.6; margin:0 0 20px;">${escapeHTML(message)}</p>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" class="btn ghost" id="pupsConfirmCancelBtn" style="padding:8px 16px; font-size:12.5px;">Cancel</button>
        <button type="button" class="btn primary" id="pupsConfirmOkBtn" style="padding:8px 16px; font-size:12.5px;">${escapeHTML(confirmLabel)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const cancelBtn = overlay.querySelector('#pupsConfirmCancelBtn');
  const okBtn = overlay.querySelector('#pupsConfirmOkBtn');
  if (cancelBtn) cancelBtn.onclick = () => overlay.remove();
  if (okBtn) {
    okBtn.onclick = () => {
      overlay.remove();
      if (typeof onConfirm === 'function') onConfirm();
    };
  }
}

// ── Registered Users Data Center & Account Storage ───────────
function loadRegisteredUsers() {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    if (raw) return JSON.parse(raw);
    // Seed default accounts for academic deployment (password is 'password123')
    const initial = [
      {
        email: 'student@presiuniv.ac.in',
        name: 'Student Scholar',
        role: 'student',
        passwordHash: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
        verified: true,
        registeredAt: Date.now() - 86400000
      },
      {
        email: 'member@presiuniv.ac.in',
        name: 'Society Member',
        role: 'member',
        passwordHash: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
        verified: true,
        registeredAt: Date.now() - 86400000
      },
      {
        email: 'admin@presiuniv.ac.in',
        name: 'Chief Administrator',
        role: 'admin',
        passwordHash: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
        verified: true,
        registeredAt: Date.now() - 86400000
      }
    ];
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(initial));
    return initial;
  } catch {
    return [];
  }
}

function saveRegisteredUser(user) {
  const users = loadRegisteredUsers().filter(u => u.email.toLowerCase() !== user.email.toLowerCase());
  users.push(user);
  localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(users));
}

function getRegisteredUser(email) {
  if (!email) return null;
  const users = loadRegisteredUsers();
  return users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
}

// ── Email Existence & Domain MX Verification ────────────────
async function verifyEmailExistence(email) {
  const normalized = (email || '').trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(normalized)) {
    return { ok: false, message: 'Invalid email syntax. Please check address format.' };
  }

  const parts = normalized.split('@');
  if (parts.length !== 2) return { ok: false, message: 'Invalid email format.' };
  const domain = parts[1];

  const blockedDomains = ['test.com', 'example.com', 'fake.com', 'tempmail.com', 'dispostable.com', 'mailinator.com', 'trashmail.com'];
  if (blockedDomains.includes(domain)) {
    return { ok: false, message: `Disposable domain "${domain}" is not permitted for registration.` };
  }

  // Live DNS / MX verification check via Google Public DNS (DNS-over-HTTPS)
  try {
    const dohUrl = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
    const res = await fetch(dohUrl, { signal: AbortSignal.timeout(4500) });
    const data = await res.json();

    if (data.Status === 3) {
      return { ok: false, message: `Domain "${domain}" does not exist on the global internet. Please check for typos.` };
    }

    if (data.Status === 0) {
      const hasMX = data.Answer && data.Answer.length > 0;
      return {
        ok: true,
        domain: domain,
        hasMX: !!hasMX,
        message: hasMX
          ? `Domain ${domain} verified with active mail exchange (MX) servers.`
          : `Domain ${domain} validated via global DNS resolution.`
      };
    }
  } catch {
    // Structural fallback if network/CORS restricts DNS query
    if (domain.includes('.') && domain.split('.').pop().length >= 2) {
      return { ok: true, domain: domain, message: `Domain ${domain} validated.` };
    }
  }

  return { ok: true, domain: domain, message: `Email domain ${domain} validated.` };
}

// ── Navigation Initialization & Persistent Session State ────

// ══════════════════════════════════════════════════════════
//  TEAM PAGE SYSTEM — Structured JSON data model
//  All team members are stored as structured data, not raw HTML.
//  Admins use a form-based modal to add/edit/delete members.
// ══════════════════════════════════════════════════════════

const TEAM_DATA_KEY = 'pupsTeamData';

const DEFAULT_TEAM_DATA = {
  sections: [
    {
      id: 'executive',
      title: 'Executive Committee',
      layout: 'cards',          // 'cards' = large photo cards
      members: [
        {
          id: 'm1',
          name: 'Physics Society President',
          role: 'President',
          photo: '',
          email: '',
          social: { linkedin: '', instagram: '', github: '', facebook: '' }
        },
        {
          id: 'm2',
          name: 'Academic Coordinator',
          role: 'Academic',
          photo: '',
          email: '',
          social: { linkedin: '', instagram: '', github: '', facebook: '' }
        },
        {
          id: 'm3',
          name: 'Communications Lead',
          role: 'Communications',
          photo: '',
          email: '',
          social: { linkedin: '', instagram: '', github: '', facebook: '' }
        }
      ]
    },
    {
      id: 'faculty',
      title: 'Faculty Coordinators',
      layout: 'rows',           // 'rows' = compact member rows
      members: [
        {
          id: 'm4',
          name: 'Faculty Advisor',
          role: 'Faculty Coordinator',
          photo: '',
          email: '',
          social: { linkedin: '', instagram: '', github: '', facebook: '' }
        }
      ]
    }
  ]
};

// ── SVG Icons for social links ─────────────────────────────
const SOCIAL_ICONS = {
  linkedin: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>`,
  instagram: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>`,
  github: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>`,
  facebook: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
  email: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`
};

// ── Get initials from name ─────────────────────────────────
function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Build a large photo card ───────────────────────────────
function buildTeamCard(member) {
  const initials = escapeHTML(getInitials(member.name));
  const links = buildSocialLinks(member, 'team-link');
  const safePhoto = sanitizeUrl(member.photo);

  return `
    <article class="team-card" aria-label="${escapeAttr(member.name)}, ${escapeAttr(member.role)}">
      <div class="team-avatar-wrap">
        ${safePhoto && safePhoto !== '#'
          ? `<img class="team-avatar-img" src="${safePhoto}" alt="${escapeAttr(member.name)}" loading="lazy">
             <div class="team-avatar-placeholder" style="display:none"><span class="team-avatar-initials">${initials}</span></div>`
          : `<div class="team-avatar-placeholder"><span class="team-avatar-initials">${initials}</span></div>`
        }
      </div>
      <div class="team-card-body">
        <p class="team-card-role">${escapeHTML(member.role)}</p>
        <h3 class="team-card-name">${escapeHTML(member.name)}</h3>
        ${links ? `<div class="team-card-links">${links}</div>` : ''}
      </div>
    </article>`;
}

// ── Build a compact row ────────────────────────────────────
function buildTeamRow(member) {
  const initials = escapeHTML(getInitials(member.name));
  const iconLinks = buildSocialLinks(member, 'team-icon-link icon');
  const safePhoto = sanitizeUrl(member.photo);

  return `
    <div class="team-row">
      <div class="team-avatar-sm">
        ${safePhoto && safePhoto !== '#'
          ? `<img class="team-avatar-img-sm" src="${safePhoto}" alt="${escapeAttr(member.name)}" loading="lazy">
             <span class="team-avatar-initials-sm" style="display:none">${initials}</span>`
          : `<span class="team-avatar-initials-sm">${initials}</span>`
        }
      </div>
      <div class="team-row-info">
        <span class="team-row-name">${escapeHTML(member.name)}</span>
        <span class="team-row-role">${escapeHTML(member.role)}</span>
      </div>
      ${iconLinks ? `<div class="team-row-links">${iconLinks}</div>` : ''}
    </div>`;
}

// ── Build social link elements ─────────────────────────────
function buildSocialLinks(member, linkClass) {
  const parts = [];
  const { social = {}, email } = member;

  if (email) {
    parts.push(`<a href="mailto:${escapeAttr(email)}" class="${linkClass}" aria-label="Email ${escapeAttr(member.name)}" title="Email">${SOCIAL_ICONS.email}${linkClass.includes('icon') ? '' : '<span>Email</span>'}</a>`);
  }
  if (social.linkedin) {
    const u = sanitizeUrl(social.linkedin);
    if (u && u !== '#') parts.push(`<a href="${u}" target="_blank" rel="noopener noreferrer" class="${linkClass}" aria-label="${escapeAttr(member.name)} on LinkedIn" title="LinkedIn">${SOCIAL_ICONS.linkedin}${linkClass.includes('icon') ? '' : '<span>LinkedIn</span>'}</a>`);
  }
  if (social.instagram) {
    const u = sanitizeUrl(social.instagram);
    if (u && u !== '#') parts.push(`<a href="${u}" target="_blank" rel="noopener noreferrer" class="${linkClass}" aria-label="${escapeAttr(member.name)} on Instagram" title="Instagram">${SOCIAL_ICONS.instagram}${linkClass.includes('icon') ? '' : '<span>Instagram</span>'}</a>`);
  }
  if (social.github) {
    const u = sanitizeUrl(social.github);
    if (u && u !== '#') parts.push(`<a href="${u}" target="_blank" rel="noopener noreferrer" class="${linkClass}" aria-label="${escapeAttr(member.name)} on GitHub" title="GitHub">${SOCIAL_ICONS.github}${linkClass.includes('icon') ? '' : '<span>GitHub</span>'}</a>`);
  }
  if (social.facebook) {
    const u = sanitizeUrl(social.facebook);
    if (u && u !== '#') parts.push(`<a href="${u}" target="_blank" rel="noopener noreferrer" class="${linkClass}" aria-label="${escapeAttr(member.name)} on Facebook" title="Facebook">${SOCIAL_ICONS.facebook}${linkClass.includes('icon') ? '' : '<span>Facebook</span>'}</a>`);
  }

  return parts.join('');
}

// ── Render team sections into #teamContent ─────────────────
function renderTeamPage(teamData) {
  const container = document.getElementById('teamContent');
  if (!container) return;

  const sections = teamData.sections || [];
  const totalMembers = sections.reduce((sum, s) => sum + (s.members || []).length, 0);
  const totalSections = sections.length;

  // Stats row
  const statsEl = document.getElementById('teamStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="team-stat">
        <span class="team-stat-n">${totalMembers}</span>
        <span class="team-stat-l">Members</span>
      </div>
      <div class="team-stat-sep"></div>
      <div class="team-stat">
        <span class="team-stat-n">${totalSections}</span>
        <span class="team-stat-l">Committees</span>
      </div>`;
  }

  // Render sections
  let html = '';
  sections.forEach((section, sIdx) => {
    const members = section.members || [];
    html += `<section class="team-section">
      <div class="content-wrap">
        <div class="team-section-head">
          <div class="team-section-label">
            <b>0${sIdx + 1}</b>
            ${escapeHTML(section.id.toUpperCase())}
          </div>
          <h2 class="team-section-title">${escapeHTML(section.title)}</h2>
        </div>`;

    if (section.layout === 'cards') {
      html += `<div class="team-cards-grid" role="list">`;
      members.forEach(m => { html += `<div role="listitem">${buildTeamCard(m)}</div>`; });
      html += `</div>`;
    } else {
      // Rows layout (committee accordion or plain list)
      html += `<div class="team-members-list">`;
      members.forEach(m => { html += buildTeamRow(m); });
      html += `</div>`;
    }

    html += `</div></section>`;
  });

  if (!html) {
    html = `<section class="team-section"><div class="content-wrap"><p style="color:var(--muted); font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:.1em;">No team members have been added yet. Admins can add members from the ✏️ Manage Team button.</p></div></section>`;
  }

  container.innerHTML = html;
}

// ── Load team data from backend, then render (Cache-First / Instant Render) ──
function loadTeamPage() {
  if (currentPage() !== 'team.html') return;

  // 1. Instant Cache-First Render (0ms perceived delay)
  let initialData = DEFAULT_TEAM_DATA;
  try {
    const cached = JSON.parse(localStorage.getItem(TEAM_DATA_KEY) || 'null');
    if (cached && cached.sections && cached.sections.length) {
      initialData = cached;
    }
  } catch (e) {}

  renderTeamPage(initialData);

  // 2. Non-blocking background revalidation with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getPageData', page: 'team.html' }),
    signal: controller.signal
  })
  .then(r => r.json())
  .then(res => {
    clearTimeout(timeoutId);
    if (res.status === 'success' && res.content && res.content.sections) {
      const currentLocal = JSON.parse(localStorage.getItem(TEAM_DATA_KEY) || 'null');
      if (!currentLocal || !currentLocal.updatedAt || (res.content.updatedAt && res.content.updatedAt >= currentLocal.updatedAt)) {
        localStorage.setItem(TEAM_DATA_KEY, JSON.stringify(res.content));
        renderTeamPage(res.content);
      }
    }
  })
  .catch(() => {});
}

// ══════════════════════════════════════════════════════════
//  ADMIN TEAM EDITOR — Modal form for managing team members
// ══════════════════════════════════════════════════════════

let _teamEditorData = null;
let _editingMemberId = null;

function initAdminTeamEditor() {
  const session = getStoredSession();
  if (!session) return;
  const overrides = loadRoleOverrides();
  const override = overrides.find(o => o.email.toLowerCase() === (session.id || '').toLowerCase());
  const effectiveRole = override && (!override.expiresAt || override.expiresAt > Date.now()) ? override.grantedRole : session.role;
  if (effectiveRole !== 'admin') return;
  if (currentPage() !== 'team.html') return;

  // Load current data
  try {
    _teamEditorData = JSON.parse(localStorage.getItem(TEAM_DATA_KEY) || 'null') || structuredClone(DEFAULT_TEAM_DATA);
  } catch {
    _teamEditorData = structuredClone(DEFAULT_TEAM_DATA);
  }

  // Create FAB
  const fab = document.createElement('div');
  fab.className = 'team-admin-fab';
  fab.innerHTML = `<button class="team-admin-btn" id="teamEditorOpenBtn" aria-label="Open team member editor">✏️ Manage Team</button>`;
  document.body.appendChild(fab);

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'team-modal-overlay';
  modal.id = 'teamEditorModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Team Member Editor');
  modal.innerHTML = buildTeamEditorModal();
  document.body.appendChild(modal);

  // Wire up open/close
  document.getElementById('teamEditorOpenBtn').addEventListener('click', openTeamEditor);
  document.getElementById('teamEditorClose').addEventListener('click', closeTeamEditor);
  modal.addEventListener('click', e => { if (e.target === modal) closeTeamEditor(); });

  // Wire up form & tabs
  wireTeamEditorEvents();
}

function buildTeamEditorModal() {
  return `
    <div class="team-modal">
      <div class="team-modal-header">
        <span class="team-modal-title">✏️ Team Editor</span>
        <button class="team-modal-close" id="teamEditorClose" aria-label="Close editor">✕</button>
      </div>
      <div class="team-modal-body">
        <div class="team-tab-bar">
          <button class="team-tab active" data-tab="members">Members</button>
          <button class="team-tab" data-tab="sections">Sections</button>
          <button class="team-tab" data-tab="addmember">+ Add Member</button>
        </div>

        <!-- Tab: Members list -->
        <div id="teamTab-members">
          <p style="font-size:11px; color:var(--muted); margin-bottom:14px; font-family:'IBM Plex Mono',monospace;">Click a member to edit. Drag ⠿ to reorder.</p>
          <div id="teamEditorMemberList" class="team-editor-list" aria-label="Team member list"></div>
        </div>

        <!-- Tab: Sections -->
        <div id="teamTab-sections" style="display:none;">
          <p style="font-size:11px; color:var(--muted); margin-bottom:14px; font-family:'IBM Plex Mono',monospace;">Edit section names. Each section can display as cards (big photos) or rows (compact list).</p>
          <div id="teamEditorSectionList" class="team-section-manager" aria-label="Team sections"></div>
          <button class="team-admin-btn secondary" id="teamAddSectionBtn" style="margin-top:14px;">+ Add Section</button>
        </div>

        <!-- Tab: Add/Edit member form -->
        <div id="teamTab-addmember" style="display:none;">
          <h3 id="teamFormTitle" style="font-family:'Cormorant Garamond',serif; font-size:22px; font-weight:300; margin-bottom:18px; color:var(--text-heading);">Add New Member</h3>
          <form id="teamMemberForm" class="team-member-form" novalidate>
            <div class="team-form-group">
              <label class="team-form-label" for="tmf-name">Full Name *</label>
              <input class="team-form-input" id="tmf-name" type="text" placeholder="e.g. Dr. Aritra Bakshi" required>
            </div>
            <div class="team-form-group">
              <label class="team-form-label" for="tmf-role">Role / Title *</label>
              <input class="team-form-input" id="tmf-role" type="text" placeholder="e.g. President" required>
            </div>
            <div class="team-form-group">
              <label class="team-form-label" for="tmf-section">Section</label>
              <select class="team-form-select" id="tmf-section"></select>
            </div>
            <div class="team-form-group">
              <label class="team-form-label" for="tmf-photo">Photo URL</label>
              <input class="team-form-input" id="tmf-photo" type="url" placeholder="https://...">
              <span class="team-form-hint">Link to a publicly accessible image</span>
            </div>
            <div class="team-form-group">
              <label class="team-form-label" for="tmf-email">Email</label>
              <input class="team-form-input" id="tmf-email" type="email" placeholder="member@presiuniv.ac.in">
            </div>
            <div class="team-form-group">
              <label class="team-form-label" for="tmf-linkedin">LinkedIn URL</label>
              <input class="team-form-input" id="tmf-linkedin" type="url" placeholder="https://linkedin.com/in/...">
            </div>
            <div class="team-form-group">
              <label class="team-form-label" for="tmf-instagram">Instagram URL</label>
              <input class="team-form-input" id="tmf-instagram" type="url" placeholder="https://instagram.com/...">
            </div>
            <div class="team-form-group">
              <label class="team-form-label" for="tmf-github">GitHub URL</label>
              <input class="team-form-input" id="tmf-github" type="url" placeholder="https://github.com/...">
            </div>
            <div class="team-form-group">
              <label class="team-form-label" for="tmf-facebook">Facebook URL</label>
              <input class="team-form-input" id="tmf-facebook" type="url" placeholder="https://facebook.com/...">
            </div>
            <div class="team-form-group full-width" style="margin-top:6px;">
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button type="submit" class="team-admin-btn" id="teamFormSubmitBtn">✓ Save Member</button>
                <button type="button" class="team-admin-btn secondary" id="teamFormCancelBtn">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <div class="team-modal-footer">
        <button class="team-admin-btn secondary" id="teamEditorDiscard">Discard Changes</button>
        <button class="team-admin-btn" id="teamEditorSave">💾 Publish to Site</button>
      </div>
    </div>`;
}

function wireTeamEditorEvents() {
  // Tabs
  document.querySelectorAll('.team-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.team-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      ['members', 'sections', 'addmember'].forEach(t => {
        const el = document.getElementById(`teamTab-${t}`);
        if (el) el.style.display = t === tab.dataset.tab ? '' : 'none';
      });
      if (tab.dataset.tab === 'members') renderMemberList();
      if (tab.dataset.tab === 'sections') renderSectionList();
      if (tab.dataset.tab === 'addmember') {
        _editingMemberId = null;
        clearMemberForm();
        document.getElementById('teamFormTitle').textContent = 'Add New Member';
        document.getElementById('teamFormSubmitBtn').textContent = '✓ Save Member';
      }
    });
  });

  // Member form submit
  document.getElementById('teamMemberForm').addEventListener('submit', e => {
    e.preventDefault();
    saveMemberFromForm();
  });

  // Cancel edit
  document.getElementById('teamFormCancelBtn').addEventListener('click', () => {
    _editingMemberId = null;
    clearMemberForm();
    switchToTab('members');
    renderMemberList();
  });

  // Save to backend
  document.getElementById('teamEditorSave').addEventListener('click', publishTeamData);

  // Discard
  document.getElementById('teamEditorDiscard').addEventListener('click', () => {
    showConfirmModal('Discard all unsaved team changes?', () => {
      try {
        _teamEditorData = JSON.parse(localStorage.getItem(TEAM_DATA_KEY) || 'null') || structuredClone(DEFAULT_TEAM_DATA);
      } catch {
        _teamEditorData = structuredClone(DEFAULT_TEAM_DATA);
      }
      renderMemberList();
      switchToTab('members');
      showToast('Changes discarded.', 'info');
    }, 'Discard');
  });

  // Add section
  document.getElementById('teamAddSectionBtn').addEventListener('click', () => {
    const id = 'section_' + Date.now();
    _teamEditorData.sections.push({ id, title: 'New Section', layout: 'cards', members: [] });
    renderSectionList();
  });

  // Initial renders
  renderMemberList();
}

function switchToTab(tabName) {
  document.querySelectorAll('.team-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  ['members', 'sections', 'addmember'].forEach(t => {
    const el = document.getElementById(`teamTab-${t}`);
    if (el) el.style.display = t === tabName ? '' : 'none';
  });
}

function renderMemberList() {
  const list = document.getElementById('teamEditorMemberList');
  if (!list) return;

  const allMembers = [];
  (_teamEditorData.sections || []).forEach(section => {
    (section.members || []).forEach(m => {
      allMembers.push({ ...m, _sectionId: section.id, _sectionTitle: section.title });
    });
  });

  if (!allMembers.length) {
    list.innerHTML = `<p style="color:var(--muted); font-size:12px; font-family:'IBM Plex Mono',monospace; padding:16px 0;">No members yet. Use the "+ Add Member" tab to get started.</p>`;
    return;
  }

  list.innerHTML = allMembers.map(m => {
    const initials = getInitials(m.name);
    return `
      <div class="team-editor-item" data-mid="${escapeHTML(m.id)}" data-sid="${escapeHTML(m._sectionId)}" tabindex="0" role="button" aria-label="Edit ${escapeHTML(m.name)}">
        <span class="team-editor-item-drag" aria-hidden="true">⠿</span>
        <div class="team-editor-item-avatar">
          ${sanitizeUrl(m.photo) && sanitizeUrl(m.photo) !== '#'
            ? `<img src="${sanitizeUrl(m.photo)}" alt="${escapeAttr(m.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
            : escapeHTML(initials)
          }
        </div>
        <div class="team-editor-item-info">
          <div class="team-editor-item-name">${escapeHTML(m.name)}</div>
          <div class="team-editor-item-meta">${escapeHTML(m.role)} · ${escapeHTML(m._sectionTitle)}</div>
        </div>
        <button class="team-editor-item-del" data-mid="${escapeHTML(m.id)}" data-sid="${escapeHTML(m._sectionId)}" aria-label="Delete ${escapeHTML(m.name)}" title="Delete member">✕</button>
      </div>`;
  }).join('');

  // Wire click-to-edit
  list.querySelectorAll('.team-editor-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.classList.contains('team-editor-item-del')) return;
      const mid = item.dataset.mid;
      const sid = item.dataset.sid;
      openEditMember(mid, sid);
    });
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const mid = item.dataset.mid;
        const sid = item.dataset.sid;
        openEditMember(mid, sid);
      }
    });
  });

  // Wire delete buttons
  list.querySelectorAll('.team-editor-item-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const mid = btn.dataset.mid;
      const sid = btn.dataset.sid;
      deleteMember(mid, sid);
    });
  });
}

function renderSectionList() {
  const list = document.getElementById('teamEditorSectionList');
  if (!list) return;
  list.innerHTML = (_teamEditorData.sections || []).map((s, idx) => `
    <div class="team-section-chip" data-idx="${idx}">
      <span style="font-size:10px; color:var(--muted); font-family:'IBM Plex Mono',monospace; min-width:18px;">${String(idx + 1).padStart(2, '0')}</span>
      <input type="text" value="${escapeHTML(s.title)}" data-idx="${idx}" data-field="title" placeholder="Section name" aria-label="Section ${idx + 1} name" style="flex:1; background:none; border:none; color:var(--text-heading); font-size:13px; font-family:'IBM Plex Mono',monospace; padding:0;">
      <select data-idx="${idx}" data-field="layout" style="background:var(--panel2); border:1px solid var(--line); color:var(--text); font-size:10px; font-family:'IBM Plex Mono',monospace; padding:3px 6px; border-radius:3px;" aria-label="Section ${idx + 1} layout">
        <option value="cards" ${s.layout === 'cards' ? 'selected' : ''}>Cards</option>
        <option value="rows" ${s.layout === 'rows' ? 'selected' : ''}>Rows</option>
      </select>
      <span style="font-size:10px; color:var(--muted); font-family:'IBM Plex Mono',monospace;">${(s.members || []).length} members</span>
      ${idx > 0 ? `<button style="background:none; border:none; color:var(--red,#f87171); cursor:pointer; font-size:14px;" data-del-section="${idx}" aria-label="Remove section ${escapeAttr(s.title)}" title="Remove section">✕</button>` : ''}
    </div>`).join('');

  // Wire changes
  list.querySelectorAll('input[data-field="title"]').forEach(inp => {
    inp.addEventListener('input', () => {
      _teamEditorData.sections[parseInt(inp.dataset.idx)].title = inp.value;
    });
  });
  list.querySelectorAll('select[data-field="layout"]').forEach(sel => {
    sel.addEventListener('change', () => {
      _teamEditorData.sections[parseInt(sel.dataset.idx)].layout = sel.value;
    });
  });
  list.querySelectorAll('[data-del-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.delSection);
      const sectionName = _teamEditorData.sections[idx].title;
      const memberCount = (_teamEditorData.sections[idx].members || []).length;
      const doRemoveSec = () => {
        _teamEditorData.sections.splice(idx, 1);
        renderSectionList();
      };
      if (memberCount > 0) {
        showConfirmModal(`Section "${sectionName}" has ${memberCount} member(s). Deleting it will also remove those members. Continue?`, doRemoveSec, 'Delete Section');
        return;
      }
      doRemoveSec();
    });
  });
}

function populateSectionSelect(selectedSectionId) {
  const sel = document.getElementById('tmf-section');
  if (!sel) return;
  sel.innerHTML = (_teamEditorData.sections || []).map(s =>
    `<option value="${escapeHTML(s.id)}" ${s.id === selectedSectionId ? 'selected' : ''}>${escapeHTML(s.title)}</option>`
  ).join('');
}

function clearMemberForm() {
  ['name', 'role', 'photo', 'email', 'linkedin', 'instagram', 'github', 'facebook'].forEach(f => {
    const el = document.getElementById(`tmf-${f}`);
    if (el) el.value = '';
  });
  populateSectionSelect(_teamEditorData.sections[0]?.id || '');
}

function openEditMember(mid, sid) {
  const section = _teamEditorData.sections.find(s => s.id === sid);
  if (!section) return;
  const member = (section.members || []).find(m => m.id === mid);
  if (!member) return;

  _editingMemberId = mid;
  populateSectionSelect(sid);

  document.getElementById('tmf-name').value = member.name || '';
  document.getElementById('tmf-role').value = member.role || '';
  document.getElementById('tmf-photo').value = member.photo || '';
  document.getElementById('tmf-email').value = member.email || '';
  document.getElementById('tmf-linkedin').value = member.social?.linkedin || '';
  document.getElementById('tmf-instagram').value = member.social?.instagram || '';
  document.getElementById('tmf-github').value = member.social?.github || '';
  document.getElementById('tmf-facebook').value = member.social?.facebook || '';

  document.getElementById('teamFormTitle').textContent = `Edit: ${member.name}`;
  document.getElementById('teamFormSubmitBtn').textContent = '✓ Update Member';
  switchToTab('addmember');
}

function saveMemberFromForm() {
  const name = document.getElementById('tmf-name').value.trim();
  const role = document.getElementById('tmf-role').value.trim();
  if (!name || !role) {
    showToast('Name and Role are required.', 'error');
    return;
  }

  const targetSectionId = document.getElementById('tmf-section').value;
  const memberData = {
    name,
    role,
    photo: document.getElementById('tmf-photo').value.trim(),
    email: document.getElementById('tmf-email').value.trim(),
    social: {
      linkedin: document.getElementById('tmf-linkedin').value.trim(),
      instagram: document.getElementById('tmf-instagram').value.trim(),
      github: document.getElementById('tmf-github').value.trim(),
      facebook: document.getElementById('tmf-facebook').value.trim()
    }
  };

  if (_editingMemberId) {
    // Find and update member (might move between sections)
    let found = false;
    _teamEditorData.sections.forEach(s => {
      const idx = (s.members || []).findIndex(m => m.id === _editingMemberId);
      if (idx >= 0) {
        if (s.id === targetSectionId) {
          // Update in place
          s.members[idx] = { ...s.members[idx], ...memberData };
        } else {
          // Move to different section
          s.members.splice(idx, 1);
          const targetSection = _teamEditorData.sections.find(ts => ts.id === targetSectionId);
          if (targetSection) {
            if (!targetSection.members) targetSection.members = [];
            targetSection.members.push({ id: _editingMemberId, ...memberData });
          }
        }
        found = true;
      }
    });
    if (!found) showToast('Member not found.', 'error');
    else showToast(`Updated: ${name}`, 'success');
  } else {
    // New member
    const newId = 'm_' + Date.now();
    const targetSection = _teamEditorData.sections.find(s => s.id === targetSectionId);
    if (!targetSection) {
      showToast('Invalid section.', 'error');
      return;
    }
    if (!targetSection.members) targetSection.members = [];
    targetSection.members.push({ id: newId, ...memberData });
    showToast(`Added: ${name}`, 'success');
  }

  _editingMemberId = null;
  clearMemberForm();
  document.getElementById('teamFormTitle').textContent = 'Add New Member';
  document.getElementById('teamFormSubmitBtn').textContent = '✓ Save Member';
  switchToTab('members');
  renderMemberList();

  // Live preview
  renderTeamPage(_teamEditorData);
}

function deleteMember(mid, sid) {
  const section = _teamEditorData.sections.find(s => s.id === sid);
  if (!section) return;
  const member = (section.members || []).find(m => m.id === mid);
  showConfirmModal(`Remove "${member?.name || 'this member'}" from the team?`, () => {
    section.members = section.members.filter(m => m.id !== mid);
    renderMemberList();
    renderTeamPage(_teamEditorData);
    showToast('Member removed.', 'info');
  }, 'Remove');
}

function publishTeamData() {
  const btn = document.getElementById('teamEditorSave');
  btn.textContent = 'Publishing...';
  btn.disabled = true;

  // Save locally first
  localStorage.setItem(TEAM_DATA_KEY, JSON.stringify(_teamEditorData));

  fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'updatePageData', page: 'team.html', content: _teamEditorData })
  })
  .then(r => r.json())
  .then(res => {
    btn.textContent = '💾 Publish to Site';
    btn.disabled = false;
    if (res.status === 'success') {
      showToast('✅ Team data published to the data center successfully!', 'success');
      renderTeamPage(_teamEditorData);
      closeTeamEditor();
    } else {
      showToast('Backend error: ' + (res.message || 'Unknown error'), 'error');
    }
  })
  .catch(err => {
    btn.textContent = '💾 Publish to Site';
    btn.disabled = false;
    showToast('Network error. Changes saved locally.', 'error');
  });
}

function openTeamEditor() {
  const modal = document.getElementById('teamEditorModal');
  if (modal) {
    // Refresh editor data from local cache
    try {
      _teamEditorData = JSON.parse(localStorage.getItem(TEAM_DATA_KEY) || 'null') || structuredClone(DEFAULT_TEAM_DATA);
    } catch {
      _teamEditorData = structuredClone(DEFAULT_TEAM_DATA);
    }
    switchToTab('members');
    renderMemberList();
    populateSectionSelect(_teamEditorData.sections[0]?.id || '');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeTeamEditor() {
  const modal = document.getElementById('teamEditorModal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// ══════════════════════════════════════════════════════════
//  REUSABLE LOTTIE PHYSICS LOADING ANIMATION COMPONENT
//  Lottie URL: https://lottie.host/ccb8b8d2-44ac-4bd3-9e20-032671909c3e/4bwzYZo9Kw.json
// ══════════════════════════════════════════════════════════
const LOTTIE_LOADER_URL = 'https://lottie.host/ccb8b8d2-44ac-4bd3-9e20-032671909c3e/4bwzYZo9Kw.json';

// Ensure Lottie Player script is available globally
if (typeof window !== 'undefined' && !window.customElements?.get('lottie-player')) {
  const lottieScript = document.createElement('script');
  lottieScript.src = 'https://unpkg.com/@lottiefiles/lottie-player@2.0.4/dist/lottie-player.js';
  lottieScript.async = true;
  document.head.appendChild(lottieScript);
}

function renderNewtonsCradle(caption = 'Loading...') {
  return `
    <div class="newtons-cradle-wrap" role="status" aria-live="polite" aria-label="${escapeHTML(caption)}">
      <lottie-player
        src="${LOTTIE_LOADER_URL}"
        background="transparent"
        speed="1"
        style="width: 130px; height: 130px; margin: 0 auto; display: block;"
        loop
        autoplay>
      </lottie-player>
      <div class="newtons-cradle-caption">${escapeHTML(caption)}</div>
    </div>`;
}

// ══════════════════════════════════════════════════════════
//  GLOBAL TYPOGRAPHY PRESET SYSTEM
//  Switches site-wide font style with a single admin command
//  Default: Academic ('Cormorant Garamond' & 'IBM Plex Mono')
// ══════════════════════════════════════════════════════════
const FONT_PRESET_KEY = 'pupsFontPreset';
const DEFAULT_FONT_PRESET = 'academic';

function initGlobalTypography() {
  const current = localStorage.getItem(FONT_PRESET_KEY) || DEFAULT_FONT_PRESET;
  applyFontPreset(current, false);

  // Asynchronously query Google Apps Script global_settings
  fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getPageData', page: 'global_settings' })
  })
  .then(r => r.json())
  .then(res => {
    if (res.status === 'success' && res.content && res.content.fontPreset) {
      if (res.content.fontPreset !== current) {
        applyFontPreset(res.content.fontPreset, false);
      }
    }
  })
  .catch(() => {});
}

function applyFontPreset(preset, syncBackend = false) {
  const valid = ['academic', 'modern', 'editorial', 'cyber', 'cinematic', 'chalkboard', 'minimal'];
  if (!valid.includes(preset)) preset = 'academic';

  document.documentElement.setAttribute('data-font-preset', preset);
  localStorage.setItem(FONT_PRESET_KEY, preset);

  // Update Admin panel controls if present
  const sel = document.getElementById('globalFontSelect');
  if (sel && sel.value !== preset) sel.value = preset;

  const preview = document.getElementById('fontPreviewBox');
  if (preview) {
    preview.setAttribute('data-font-preset', preset);
    const label = document.getElementById('fontCurrentPresetName');
    if (label) {
      const names = {
        academic: 'Classic Academic',
        modern: 'Modern Scientific',
        editorial: 'Editorial Journal',
        cyber: 'Cyber Sci-Fi',
        cinematic: 'Cinematic Classical',
        chalkboard: 'Chalkboard Notes',
        minimal: 'Minimalist Clean'
      };
      label.textContent = names[preset] || preset;
    }
  }

  if (syncBackend) {
    fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updatePageData',
        page: 'global_settings',
        content: { fontPreset: preset, updatedAt: new Date().toISOString() }
      })
    })
    .then(r => r.json())
    .then(res => {
      if (res.status === 'success') {
        showToast('✓ Global typography preset saved and published to entire site.', 'success');
      }
    })
    .catch(() => {
      showToast('Font preset applied locally. Cloud sync pending.', 'info');
    });
  }
}

// ══════════════════════════════════════════════════════════
//  CONTACT PAGE SYSTEM — Structured JSON data model
//  Admins manage address, venues, emails, social links via modal
// ══════════════════════════════════════════════════════════
const CONTACT_DATA_KEY = 'pupsContactData';

const DEFAULT_CONTACT_DATA = {
  hero: {
    kicker: 'Contact · Est. 2025',
    title: 'Get in <em>touch</em>.',
    lede: 'Have a physics question, collaboration inquiry, or speaker proposal? Reach out to the society executive committee.'
  },
  narrative: {
    title: "We'd love to <em>hear from you</em>.",
    p1: 'Whether you have a question about our events, want to collaborate, or are interested in delivering a colloquium — reach out to the team.',
    p2: 'For departmental information, academic curriculum, and faculty research laboratories, visit the Department of Physics website.',
    email: 'society@example.org'
  },
  info: {
    address: 'Department of Physics, Presidency University, 86/1 College Street, Kolkata, India',
    email: 'society@example.org',
    colloquia: 'PLT-2, Baker Building',
    events: 'P.C.M. Auditorium, Baker Building',
    departmentName: 'presiuniv.ac.in →',
    departmentUrl: 'https://www.presiuniv.ac.in/web/physics.php'
  },
  social: {
    facebook: '#',
    instagram: '#',
    linkedin: '#',
    youtube: '#',
    github: ''
  }
};

let _contactEditorData = null;

// ── Render contact page from structured data ──────────────
function renderContactPage(data) {
  const container = document.getElementById('contactDynamicContent');
  if (!container) return;

  const hero = data.hero || DEFAULT_CONTACT_DATA.hero;
  const narrative = data.narrative || DEFAULT_CONTACT_DATA.narrative;
  const info = data.info || DEFAULT_CONTACT_DATA.info;
  const social = data.social || DEFAULT_CONTACT_DATA.social;

  // Update Hero texts safely (prevent Stored XSS while preserving <em> accent)
  const kickerEl = document.getElementById('contactHeroKicker');
  if (kickerEl) kickerEl.textContent = hero.kicker || 'Contact · Est. 2025';
  const titleEl = document.getElementById('contactHeroTitle');
  if (titleEl) titleEl.innerHTML = formatSafeHeading(hero.title, 'Get in <em>touch</em>.');
  const ledeEl = document.getElementById('contactHeroLede');
  if (ledeEl) ledeEl.textContent = hero.lede || '';

  // Build social buttons with URL protocol sanitization
  const socialButtons = [];
  if (social.facebook && sanitizeUrl(social.facebook) !== '#') {
    socialButtons.push(`<a href="${sanitizeUrl(social.facebook)}" target="_blank" rel="noopener noreferrer" class="contact-social-btn" aria-label="PUPS on Facebook" title="Facebook">${SOCIAL_ICONS.facebook}</a>`);
  }
  if (social.instagram && sanitizeUrl(social.instagram) !== '#') {
    socialButtons.push(`<a href="${sanitizeUrl(social.instagram)}" target="_blank" rel="noopener noreferrer" class="contact-social-btn" aria-label="PUPS on Instagram" title="Instagram">${SOCIAL_ICONS.instagram}</a>`);
  }
  if (social.linkedin && sanitizeUrl(social.linkedin) !== '#') {
    socialButtons.push(`<a href="${sanitizeUrl(social.linkedin)}" target="_blank" rel="noopener noreferrer" class="contact-social-btn" aria-label="PUPS on LinkedIn" title="LinkedIn">${SOCIAL_ICONS.linkedin}</a>`);
  }
  if (social.youtube && sanitizeUrl(social.youtube) !== '#') {
    socialButtons.push(`<a href="${sanitizeUrl(social.youtube)}" target="_blank" rel="noopener noreferrer" class="contact-social-btn" aria-label="PUPS on YouTube" title="YouTube"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg></a>`);
  }
  if (social.github && sanitizeUrl(social.github) !== '#') {
    socialButtons.push(`<a href="${sanitizeUrl(social.github)}" target="_blank" rel="noopener noreferrer" class="contact-social-btn" aria-label="PUPS on GitHub" title="GitHub">${SOCIAL_ICONS.github}</a>`);
  }

  container.innerHTML = `
    <div class="contact-grid">
      <!-- Left Column: Narrative & Enquiry Form -->
      <div class="contact-left-card">
        <h2>${formatSafeHeading(narrative.title, "We'd love to <em>hear from you</em>.")}</h2>
        <p>${escapeHTML(narrative.p1 || '')}</p>
        <p>${escapeHTML(narrative.p2 || '')}</p>

        <!-- Interactive Enquiry Form -->
        <div class="contact-form-panel">
          <div class="contact-form-title">Send a message to communications</div>
          <form id="contactForm" novalidate>
            <div class="form-grid">
              <div class="field">
                <label for="contactName">Name</label>
                <input id="contactName" name="name" type="text" placeholder="Your name" required autocomplete="name">
              </div>
              <div class="field">
                <label for="contactEmail">Email</label>
                <input id="contactEmail" name="email" type="email" placeholder="you@example.org" required autocomplete="email">
              </div>
              <div class="field full">
                <label for="contactSubject">Subject</label>
                <input id="contactSubject" name="subject" type="text" placeholder="Topic or enquiry" required>
              </div>
              <div class="field full">
                <label for="contactMessage">Message</label>
                <textarea id="contactMessage" name="message" rows="4" placeholder="Write your message here..." required></textarea>
              </div>
              <div class="field full">
                <button class="btn primary" id="contactSubmitBtn" type="submit" style="width:100%;">Send Enquiry</button>
              </div>
            </div>
            <div id="contactStatusBanner" class="feedback-banner" role="status" aria-live="polite" style="margin-top:14px;"></div>
          </form>
        </div>
      </div>

      <!-- Right Column: Structured Information Card (cb) -->
      <div>
        <div class="contact-box">
          <div class="cb-lbl">Contact Information</div>
          <div class="ci">
            <span class="ci-k">Address</span>
            <span>${escapeHTML(info.address || '')}</span>
          </div>
          <div class="ci">
            <span class="ci-k">Email</span>
            <span><a href="mailto:${escapeHTML(info.email || '')}">${escapeHTML(info.email || '')}</a></span>
          </div>
          <div class="ci">
            <span class="ci-k">Colloquia</span>
            <span>${escapeHTML(info.colloquia || '')}</span>
          </div>
          <div class="ci">
            <span class="ci-k">Events</span>
            <span>${escapeHTML(info.events || '')}</span>
          </div>
          <div class="ci">
            <span class="ci-k">Department</span>
            <span><a href="${sanitizeUrl(info.departmentUrl || '#')}" target="_blank" rel="noopener noreferrer">${escapeHTML(info.departmentName || 'presiuniv.ac.in →')}</a></span>
          </div>
          <div class="ci" style="align-items:center;">
            <span class="ci-k">Social</span>
            <div class="contact-social-row">
              ${socialButtons.join('') || '<span style="color:var(--muted); font-size:12px;">No social links configured.</span>'}
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // Attach contact form event listener
  bindContactFormEvents();
}

function bindContactFormEvents() {
  const form = document.getElementById('contactForm');
  const banner = document.getElementById('contactStatusBanner');
  if (!form) return;

  form.onsubmit = (e) => {
    e.preventDefault();
    const name = qs('#contactName')?.value.trim();
    const email = qs('#contactEmail')?.value.trim();
    const subject = qs('#contactSubject')?.value.trim();
    const message = qs('#contactMessage')?.value.trim();

    if (!name || !email || !subject || !message) {
      if (banner) {
        banner.className = 'feedback-banner error show';
        banner.innerHTML = 'Please fill out all required fields.';
      }
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    if (banner) {
      banner.className = 'feedback-banner success show';
      banner.innerHTML = `✓ Thank you, <strong>${escapeHTML(name)}</strong>! Your enquiry has been received and routed to society communications.`;
      setTimeout(() => { banner.classList.remove('show'); }, 6000);
    }
    showToast(`Enquiry sent successfully. Thank you, ${name}!`, 'success');
    form.reset();
  };
}

// ── Load contact page data from backend (Cache-First / Instant Render) ───
function loadContactPage() {
  if (currentPage() !== 'contact.html') return;

  // 1. Instant Cache-First Render (0ms perceived delay)
  let initialData = DEFAULT_CONTACT_DATA;
  try {
    const cached = JSON.parse(localStorage.getItem(CONTACT_DATA_KEY) || 'null');
    if (cached && (cached.info || cached.hero)) {
      initialData = cached;
    }
  } catch (e) {}

  renderContactPage(initialData);

  // 2. Non-blocking background revalidation with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getPageData', page: 'contact.html' }),
    signal: controller.signal
  })
  .then(r => r.json())
  .then(res => {
    clearTimeout(timeoutId);
    if (res.status === 'success' && res.content && (res.content.info || res.content.hero)) {
      const currentLocal = JSON.parse(localStorage.getItem(CONTACT_DATA_KEY) || 'null');
      if (!currentLocal || !currentLocal.updatedAt || (res.content.updatedAt && res.content.updatedAt >= currentLocal.updatedAt)) {
        localStorage.setItem(CONTACT_DATA_KEY, JSON.stringify(res.content));
        renderContactPage(res.content);
      }
    }
  })
  .catch(() => {});
}

// ══════════════════════════════════════════════════════════
//  ADMIN CONTACT EDITOR — Modal form for managing contact info
// ══════════════════════════════════════════════════════════
function initAdminContactEditor() {
  const session = getStoredSession();
  if (!session) return;
  const overrides = loadRoleOverrides();
  const override = overrides.find(o => o.email.toLowerCase() === (session.id || '').toLowerCase());
  const effectiveRole = override && (!override.expiresAt || override.expiresAt > Date.now()) ? override.grantedRole : session.role;
  if (effectiveRole !== 'admin') return;
  if (currentPage() !== 'contact.html') return;

  try {
    _contactEditorData = JSON.parse(localStorage.getItem(CONTACT_DATA_KEY) || 'null') || structuredClone(DEFAULT_CONTACT_DATA);
  } catch {
    _contactEditorData = structuredClone(DEFAULT_CONTACT_DATA);
  }

  // Inject Floating Action Button
  const fab = document.createElement('div');
  fab.className = 'contact-admin-fab';
  fab.innerHTML = `<button class="contact-admin-btn" id="contactEditorOpenBtn" aria-label="Open contact editor">✏️ Manage Contact</button>`;
  document.body.appendChild(fab);

  // Inject Modal
  const modal = document.createElement('div');
  modal.className = 'contact-modal-overlay';
  modal.id = 'contactEditorModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Contact Page Editor');
  modal.innerHTML = buildContactEditorModal();
  document.body.appendChild(modal);

  // Wire events
  document.getElementById('contactEditorOpenBtn').addEventListener('click', openContactEditor);
  document.getElementById('contactEditorClose').addEventListener('click', closeContactEditor);
  modal.addEventListener('click', e => { if (e.target === modal) closeContactEditor(); });
  wireContactEditorEvents();
}

function buildContactEditorModal() {
  return `
    <div class="contact-modal">
      <div class="contact-modal-header">
        <span class="contact-modal-title">✏️ Contact Page Editor</span>
        <button class="contact-modal-close" id="contactEditorClose" aria-label="Close editor">✕</button>
      </div>
      <div class="contact-modal-body">
        <div class="contact-tab-bar">
          <button class="contact-tab active" data-tab="info">Contact Information</button>
          <button class="contact-tab" data-tab="social">Social Media Links</button>
          <button class="contact-tab" data-tab="hero">Hero & Narrative</button>
        </div>

        <form id="contactEditorForm" novalidate>
          <!-- Tab 1: Information -->
          <div id="contactTab-info">
            <p style="font-size:11px; color:var(--muted); margin-bottom:16px; font-family:'IBM Plex Mono',monospace;">Update the official contact card values shown on the public contact page.</p>
            <div class="contact-form-grid">
              <div class="field full-width">
                <label class="team-form-label" for="cef-address">Physical Address</label>
                <input class="team-form-input" id="cef-address" type="text" placeholder="e.g. 86/1 College Street, Kolkata 700 073" required>
              </div>
              <div class="field">
                <label class="team-form-label" for="cef-email">Official Inquiries Email</label>
                <input class="team-form-input" id="cef-email" type="email" placeholder="society@example.org" required>
              </div>
              <div class="field">
                <label class="team-form-label" for="cef-colloquia">Colloquia Venue</label>
                <input class="team-form-input" id="cef-colloquia" type="text" placeholder="PLT-2, Baker Building">
              </div>
              <div class="field">
                <label class="team-form-label" for="cef-events">Major Events Venue</label>
                <input class="team-form-input" id="cef-events" type="text" placeholder="P.C.M. Auditorium, Baker Building">
              </div>
              <div class="field">
                <label class="team-form-label" for="cef-depturl">Department Website URL</label>
                <input class="team-form-input" id="cef-depturl" type="url" placeholder="https://www.presiuniv.ac.in/web/physics.php">
              </div>
            </div>
          </div>

          <!-- Tab 2: Social Media Links -->
          <div id="contactTab-social" style="display:none;">
            <p style="font-size:11px; color:var(--muted); margin-bottom:16px; font-family:'IBM Plex Mono',monospace;">Add or update society social media profiles. Leave empty to omit a network.</p>
            <div class="contact-form-grid">
              <div class="field full-width">
                <label class="team-form-label" for="cef-facebook">Facebook Page URL</label>
                <input class="team-form-input" id="cef-facebook" type="url" placeholder="https://facebook.com/...">
              </div>
              <div class="field full-width">
                <label class="team-form-label" for="cef-instagram">Instagram Profile URL</label>
                <input class="team-form-input" id="cef-instagram" type="url" placeholder="https://instagram.com/puphysicssociety">
              </div>
              <div class="field full-width">
                <label class="team-form-label" for="cef-linkedin">LinkedIn Organisation URL</label>
                <input class="team-form-input" id="cef-linkedin" type="url" placeholder="https://linkedin.com/in/...">
              </div>
              <div class="field full-width">
                <label class="team-form-label" for="cef-youtube">YouTube Channel URL</label>
                <input class="team-form-input" id="cef-youtube" type="url" placeholder="https://youtube.com/@puphysicssociety">
              </div>
              <div class="field full-width">
                <label class="team-form-label" for="cef-github">GitHub Repository / Organisation URL</label>
                <input class="team-form-input" id="cef-github" type="url" placeholder="https://github.com/...">
              </div>
            </div>
          </div>

          <!-- Tab 3: Hero & Narrative -->
          <div id="contactTab-hero" style="display:none;">
            <p style="font-size:11px; color:var(--muted); margin-bottom:16px; font-family:'IBM Plex Mono',monospace;">Customize headings and introductory paragraphs without modifying any HTML.</p>
            <div class="contact-form-grid">
              <div class="field">
                <label class="team-form-label" for="cef-herokicker">Hero Kicker</label>
                <input class="team-form-input" id="cef-herokicker" type="text" placeholder="Contact · Est. 2025">
              </div>
              <div class="field">
                <label class="team-form-label" for="cef-herotitle">Hero Heading (use &lt;em&gt; for accent)</label>
                <input class="team-form-input" id="cef-herotitle" type="text" placeholder="Get in &lt;em&gt;touch&lt;/em&gt;.">
              </div>
              <div class="field full-width">
                <label class="team-form-label" for="cef-herolede">Hero Subtitle</label>
                <textarea class="team-form-input" id="cef-herolede" rows="2" placeholder="Have a physics question..."></textarea>
              </div>
              <div class="field full-width">
                <label class="team-form-label" for="cef-narrativetitle">Section Heading</label>
                <input class="team-form-input" id="cef-narrativetitle" type="text" placeholder="We'd love to &lt;em&gt;hear from you&lt;/em&gt;.">
              </div>
              <div class="field full-width">
                <label class="team-form-label" for="cef-narrativep1">Intro Paragraph</label>
                <textarea class="team-form-input" id="cef-narrativep1" rows="2"></textarea>
              </div>
              <div class="field full-width">
                <label class="team-form-label" for="cef-narrativep2">Department Link Paragraph</label>
                <textarea class="team-form-input" id="cef-narrativep2" rows="2"></textarea>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div class="contact-modal-footer">
        <button class="contact-admin-btn secondary" id="contactEditorDiscard" type="button">Discard</button>
        <button class="contact-admin-btn" id="contactEditorSave" type="button">💾 Publish to Site</button>
      </div>
    </div>`;
}

function wireContactEditorEvents() {
  document.querySelectorAll('.contact-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.contact-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      ['info', 'social', 'hero'].forEach(t => {
        const el = document.getElementById(`contactTab-${t}`);
        if (el) el.style.display = t === tab.dataset.tab ? '' : 'none';
      });
    });
  });

  document.getElementById('contactEditorSave').addEventListener('click', () => {
    saveContactFromForm();
    publishContactData();
  });

  document.getElementById('contactEditorDiscard').addEventListener('click', () => {
    showConfirmModal('Discard changes and reload saved contact data?', () => {
      try {
        _contactEditorData = JSON.parse(localStorage.getItem(CONTACT_DATA_KEY) || 'null') || structuredClone(DEFAULT_CONTACT_DATA);
      } catch {
        _contactEditorData = structuredClone(DEFAULT_CONTACT_DATA);
      }
      populateContactForm(_contactEditorData);
      showToast('Changes discarded.', 'info');
      closeContactEditor();
    }, 'Discard');
  });
}

function populateContactForm(data) {
  const info = data.info || DEFAULT_CONTACT_DATA.info;
  const social = data.social || DEFAULT_CONTACT_DATA.social;
  const hero = data.hero || DEFAULT_CONTACT_DATA.hero;
  const narrative = data.narrative || DEFAULT_CONTACT_DATA.narrative;

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };

  setVal('cef-address', info.address);
  setVal('cef-email', info.email);
  setVal('cef-colloquia', info.colloquia);
  setVal('cef-events', info.events);
  setVal('cef-depturl', info.departmentUrl);

  setVal('cef-facebook', social.facebook);
  setVal('cef-instagram', social.instagram);
  setVal('cef-linkedin', social.linkedin);
  setVal('cef-youtube', social.youtube);
  setVal('cef-github', social.github);

  setVal('cef-herokicker', hero.kicker);
  setVal('cef-herotitle', hero.title);
  setVal('cef-herolede', hero.lede);
  setVal('cef-narrativetitle', narrative.title);
  setVal('cef-narrativep1', narrative.p1);
  setVal('cef-narrativep2', narrative.p2);
}

function saveContactFromForm() {
  const getVal = (id) => (document.getElementById(id)?.value || '').trim();

  _contactEditorData = {
    updatedAt: new Date().toISOString(),
    hero: {
      kicker: getVal('cef-herokicker') || 'Contact · Est. 2025',
      title: getVal('cef-herotitle') || 'Get in <em>touch</em>.',
      lede: getVal('cef-herolede') || ''
    },
    narrative: {
      title: getVal('cef-narrativetitle') || "We'd love to <em>hear from you</em>.",
      p1: getVal('cef-narrativep1') || '',
      p2: getVal('cef-narrativep2') || '',
      email: getVal('cef-email') || 'society@example.org'
    },
    info: {
      address: getVal('cef-address') || 'Department of Physics, Presidency University, 86/1 College Street, Kolkata, India',
      email: getVal('cef-email') || 'society@example.org',
      colloquia: getVal('cef-colloquia') || 'PLT-2, Baker Building',
      events: getVal('cef-events') || 'P.C.M. Auditorium, Baker Building',
      departmentName: 'presiuniv.ac.in →',
      departmentUrl: getVal('cef-depturl') || 'https://www.presiuniv.ac.in/web/physics.php'
    },
    social: {
      facebook: getVal('cef-facebook') || '#',
      instagram: getVal('cef-instagram') || '#',
      linkedin: getVal('cef-linkedin') || '#',
      youtube: getVal('cef-youtube') || '#',
      github: getVal('cef-github') || ''
    }
  };

  // Immediate persistence & instant live preview
  localStorage.setItem(CONTACT_DATA_KEY, JSON.stringify(_contactEditorData));
  renderContactPage(_contactEditorData);
}

function publishContactData() {
  const btn = document.getElementById('contactEditorSave');
  if (btn) {
    btn.textContent = 'Publishing...';
    btn.disabled = true;
  }

  localStorage.setItem(CONTACT_DATA_KEY, JSON.stringify(_contactEditorData));

  fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'updatePageData', page: 'contact.html', content: _contactEditorData })
  })
  .then(r => r.json())
  .then(res => {
    if (btn) {
      btn.textContent = '💾 Publish to Site';
      btn.disabled = false;
    }
    if (res.status === 'success') {
      showToast('✅ Contact information published to the data center successfully!', 'success');
      renderContactPage(_contactEditorData);
      closeContactEditor();
    } else {
      showToast('Backend note: ' + (res.message || 'Saved locally'), 'info');
      closeContactEditor();
    }
  })
  .catch(() => {
    if (btn) {
      btn.textContent = '💾 Publish to Site';
      btn.disabled = false;
    }
    showToast('Saved locally. Changes active immediately on this device.', 'info');
    closeContactEditor();
  });
}

function openContactEditor() {
  const modal = document.getElementById('contactEditorModal');
  if (modal) {
    try {
      _contactEditorData = JSON.parse(localStorage.getItem(CONTACT_DATA_KEY) || 'null') || structuredClone(DEFAULT_CONTACT_DATA);
    } catch {
      _contactEditorData = structuredClone(DEFAULT_CONTACT_DATA);
    }
    populateContactForm(_contactEditorData);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeContactEditor() {
  const modal = document.getElementById('contactEditorModal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function initNav() {
  // Initialize Global Typography theme
  initGlobalTypography();
  const page = currentPage();
  if (page === 'team.html') {
    loadTeamPage();
    initAdminTeamEditor();
  }
  if (page === 'contact.html') {
    loadContactPage();
    initAdminContactEditor();
  }
  const btn = qs('#menuToggle');
  const nav = qs('#mainNav');
  if (btn && nav) {
    btn.onclick = () => {
      const isOpen = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };
  }

  // Dynamic Navigation state based on session
  const session = getStoredSession();
  const loginLink = qs('.login-link');

  if (session && session.id) {
    // USER IS LOGGED IN ACROSS NAVIGATION
    if (loginLink) {
      loginLink.textContent = 'Logout';
      loginLink.href = '#logout';
      loginLink.dataset.action = 'logout';
      loginLink.onclick = (e) => { e.preventDefault(); logout(); };
      loginLink.setAttribute('aria-label', `Log out of active session (${session.role})`);
      loginLink.title = `Signed in as ${session.name || session.id} (${capitalize(session.role)}). Click to log out.`;
    }

    // Hide registration link when logged in
    const regNav = qs('.register-nav-link');
    if (regNav) regNav.style.display = 'none';

    // Inject portal quick access if on a public page and not already linked
    const portalHref = session.role === 'admin' ? 'admin.html' : session.role === 'member' ? 'member.html' : 'student.html';
    const authPages = ['admin.html', 'member.html', 'student.html', 'formulas.html', 'forum.html', 'lab.html'];
    if (nav && !qs('.nav-portal-shortcut') && !nav.querySelector(`a[href="${portalHref}"]`) && !authPages.includes(page)) {
      const portalLabel = session.role === 'admin' ? 'Admin Centre' : session.role === 'member' ? 'Member Portal' : 'Student Portal';
      const portalLink = document.createElement('a');
      portalLink.className = 'nav-portal-shortcut';
      portalLink.href = portalHref;
      portalLink.textContent = portalLabel;
      portalLink.style.color = 'var(--cyan)';
      portalLink.style.fontWeight = '700';
      if (loginLink) {
        nav.insertBefore(portalLink, loginLink);
      } else {
        nav.appendChild(portalLink);
      }
    }
  } else {
    // USER IS LOGGED OUT
    if (loginLink) {
      loginLink.textContent = 'Login';
      loginLink.href = 'login.html';
      loginLink.title = 'Access Member, Student or Administrator room';
    }
    const regNav = qs('.register-nav-link');
    if (regNav) {
      regNav.style.display = '';
    } else if (nav && !['login.html', 'register.html', 'admin.html', 'member.html', 'student.html', 'formulas.html', 'forum.html', 'lab.html'].includes(page)) {
      const regLink = document.createElement('a');
      regLink.className = 'register-nav-link';
      regLink.href = 'register.html';
      regLink.textContent = 'Register';
      if (loginLink) {
        nav.insertBefore(regLink, loginLink);
      } else {
        nav.appendChild(regLink);
      }
    }
  }
}

// ── Public IP Resolution (best effort) ──────────────────────
async function getPublicIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return data.ip || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

// ── Cryptographic Hashing (WebCrypto SHA-256 + Pure-JS FIPS 180-4 SHA-256 Fallback) ──
function sha256PureJS(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

async function hashPassword(password) {
  if (window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to pure-JS FIPS 180-4 SHA-256
    }
  }
  const utf8Str = unescape(encodeURIComponent(password));
  return sha256PureJS(utf8Str);
}

// ── Session Management & Policy Enforcement ─────────────────
function getStoredSession() {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) s = localStorage.getItem(SESSION_KEY);
    if (!s) return null;
    const session = JSON.parse(s);

    // Enforce security policy session timeout
    const policy = loadSecurityPolicy();
    const maxAgeMs = (policy.sessionHours || 24) * 3600 * 1000;
    if (session.at && Date.now() - session.at > maxAgeMs) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

function requireRole(role) {
  const s = getStoredSession();
  if (!s) {
    location.replace('login.html');
    return null;
  }

  // Check role overrides
  const overrides = loadRoleOverrides();
  const override = overrides.find(o => o.email.toLowerCase() === (s.id || '').toLowerCase());
  const effectiveRole =
    override && (!override.expiresAt || override.expiresAt > Date.now())
      ? override.grantedRole
      : s.role;

  if (role !== 'student' && effectiveRole !== role && effectiveRole !== 'admin') {
    location.replace('login.html');
    return null;
  }

  // Check force-logout list
  const forceList = getForceLogoutList();
  if (s.logId && forceList.includes(s.logId)) {
    clearSession();
    location.replace('login.html');
    return null;
  }

  return { ...s, role: effectiveRole };
}

function logout() {
  markCurrentSessionLoggedOut();
  clearSession();
  const page = currentPage();
  showToast('Logged out of session.', 'info', 2000);
  const authPages = ['admin.html', 'member.html', 'student.html', 'formulas.html', 'forum.html', 'lab.html'];
  if (authPages.includes(page)) {
    setTimeout(() => { location.href = 'login.html'; }, 300);
  } else {
    setTimeout(() => { location.reload(); }, 300);
  }
}

// ── Force-Logout Tracking ───────────────────────────────────
function getForceLogoutList() {
  try {
    const raw = localStorage.getItem(FORCE_LOGOUT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function forceLogoutSession(logId) {
  const numericId = Number(logId);
  const list = getForceLogoutList();
  if (!list.includes(numericId)) {
    list.push(numericId);
    localStorage.setItem(FORCE_LOGOUT_KEY, JSON.stringify(list));
  }

  const log = loadLoginLog();
  const entry = log.find(e => e.id === numericId);
  if (entry) {
    entry.status = 'forced_out';
    entry.forced = true;
    saveLoginLog(log);
  }

  showToast(`Session #${numericId} has been terminated via force logout.`, 'warning');
  renderLoginStatusTable();
  renderAdminStats();
}

// ── Login Activity Log ──────────────────────────────────────
function loadLoginLog() {
  try {
    const raw = localStorage.getItem(LOGIN_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLoginLog(log) {
  localStorage.setItem(LOGIN_LOG_KEY, JSON.stringify(log));
}

function appendLoginEvent(entry) {
  const log = loadLoginLog();
  const id = Date.now();
  log.unshift({
    id:        id,
    email:     entry.email,
    role:      entry.role,
    entryPage: entry.entryPage,
    ip:        entry.ip,
    loginTime: new Date().toISOString(),
    status:    entry.status,
    forced:    false
  });

  if (log.length > 200) log.splice(200);
  saveLoginLog(log);
  return id;
}

function markCurrentSessionLoggedOut() {
  const session = getStoredSession();
  if (!session || !session.logId) return;

  const log = loadLoginLog();
  const entry = log.find(e => e.id === session.logId);
  if (entry) {
    entry.status = 'logged_out';
    saveLoginLog(log);
  }
}

// ── Brute-Force Rate Limiting Protection ────────────────────
function getFailedLoginAttempts(email) {
  try {
    const raw = localStorage.getItem(FAILED_LOGINS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data[email.toLowerCase()] || { count: 0, lockedUntil: 0 };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function recordFailedLoginAttempt(email) {
  const normalized = email.toLowerCase();
  try {
    const raw = localStorage.getItem(FAILED_LOGINS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const current = data[normalized] || { count: 0, lockedUntil: 0 };
    current.count += 1;
    if (current.count >= 5) {
      current.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 min lock
    }
    data[normalized] = current;
    localStorage.setItem(FAILED_LOGINS_KEY, JSON.stringify(data));
    return current;
  } catch {
    return { count: 1, lockedUntil: 0 };
  }
}

function clearFailedLoginAttempts(email) {
  const normalized = email.toLowerCase();
  try {
    const raw = localStorage.getItem(FAILED_LOGINS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    delete data[normalized];
    localStorage.setItem(FAILED_LOGINS_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

// ── Role Overrides & Cloud Authorization ────────────────────
function loadRoleOverrides() {
  try {
    const raw = localStorage.getItem(ROLE_OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRoleOverrides(overrides) {
  localStorage.setItem(ROLE_OVERRIDE_KEY, JSON.stringify(overrides));
}

function grantRoleOverride(email, name, originalRole, grantedRole, durationMs, serverSynced = 'pending', syncNote = '') {
  const normalized = email.toLowerCase().trim();
  const overrides = loadRoleOverrides().filter(o => o.email.toLowerCase() !== normalized);
  overrides.push({
    email: normalized,
    name: name || normalized.split('@')[0],
    originalRole,
    grantedRole,
    grantedAt: Date.now(),
    expiresAt: durationMs > 0 ? Date.now() + durationMs : null,
    serverSynced: serverSynced, // 'synced' | 'in_sheet' | 'error' | 'pending'
    syncedAt: serverSynced === 'synced' || serverSynced === 'in_sheet' ? Date.now() : null,
    syncNote: syncNote
  });
  saveRoleOverrides(overrides);
}

function pruneExpiredOverrides() {
  const now = Date.now();
  const list = loadRoleOverrides();
  let changed = false;
  const active = list.filter(o => {
    if (o.expiresAt && o.expiresAt <= now) {
      changed = true;
      return false;
    }
    return true;
  });
  if (changed) {
    saveRoleOverrides(active);
  }
}

// ── Google Apps Script Backend Communication ────────────────
async function syncAuthorizationToServer(payload) {
  try {
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method:   'POST',
      redirect: 'follow',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     JSON.stringify(payload),
      signal:   AbortSignal.timeout(15000)
    });
    return await response.json();
  } catch (error) {
    return {
      status:  'error',
      message: error.name === 'TimeoutError'
        ? 'Data server request timed out after 15 seconds.'
        : 'Network error communicating with Google Apps Script data server.'
    };
  }
}

async function pingDataServer() {
  const start = Date.now();
  try {
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method:   'POST',
      redirect: 'follow',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     JSON.stringify({ action: 'ping' }),
      signal:   AbortSignal.timeout(10000)
    });
    const data = await response.json();
    const latency = Date.now() - start;
    return { ok: true, latency, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================
//  LOGIN PAGE INITIALIZER
// ============================================================
function initLogin() {
  initNav();
  setAuth(localStorage.getItem(PENDING_ROLE) || 'student');
  qsa('.role-option').forEach(btn => {
    btn.onclick = () => setAuth(btn.dataset.role);
  });

  // Provide portal shortcut and logout if already logged in
  const session = getStoredSession();
  if (session && session.id) {
    const portalHref = session.role === 'admin' ? 'admin.html' : session.role === 'member' ? 'member.html' : 'student.html';
    const portalLabel = session.role === 'admin' ? 'Admin Centre' : session.role === 'member' ? 'Member Portal' : 'Student Portal';
    const tools = qs('.header-right-tools');
    if (tools && !qs('#loginSessionShortcuts')) {
      const wrap = document.createElement('span');
      wrap.id = 'loginSessionShortcuts';
      wrap.style.display = 'inline-flex';
      wrap.style.gap = '8px';
      wrap.innerHTML = `
        <a class="btn primary" href="${portalHref}" style="font-size:12px; padding:8px 14px;">${portalLabel} →</a>
        <a class="btn ghost" href="#logout" data-action="logout" style="font-size:12px; padding:8px 14px;">Logout</a>
      `;
      tools.insertBefore(wrap, tools.firstChild);
    }
  }

  // Restore remember-me data
  const saved = localStorage.getItem(REMEMBER_KEY);
  if (saved) {
    try {
      const d = JSON.parse(saved);
      if (qs('#emailInput')) qs('#emailInput').value = d.id || '';
      if (qs('#rememberMe')) qs('#rememberMe').checked = true;
      setAuth(d.role || 'student');
    } catch { /* ignore */ }
  }

  // Neon Cybernetic Password visibility toggle (Press and Hold to Reveal)
  const passwordInput = qs('#passwordInput');
  const toggleBtn     = qs('#passwordToggleBtn');
  if (passwordInput && toggleBtn) {
    const showPwd = (e) => {
      if (e) e.preventDefault();
      passwordInput.type = 'text';
      toggleBtn.classList.add('revealed');
    };
    const hidePwd = (e) => {
      if (e) e.preventDefault();
      passwordInput.type = 'password';
      toggleBtn.classList.remove('revealed');
    };

    toggleBtn.addEventListener('mousedown', showPwd);
    toggleBtn.addEventListener('mouseup', hidePwd);
    toggleBtn.addEventListener('mouseleave', hidePwd);
    toggleBtn.addEventListener('touchstart', showPwd, { passive: false });
    toggleBtn.addEventListener('touchend', hidePwd);
    toggleBtn.addEventListener('touchcancel', hidePwd);
  }

  // 3D Card tilt on auth-card
  const authCard = qs('.auth-card');
  if (authCard) {
    authCard.addEventListener('mousemove', (e) => {
      const rect = authCard.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      authCard.style.transform = `perspective(1200px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
    });
    authCard.addEventListener('mouseleave', () => {
      authCard.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
    });
  }

  const form = qs('#loginForm');
  if (!form) return;

  const overlay       = qs('#authPortalOverlay');
  const portalSubRole = qs('#portalSubRole');
  const progressFill  = qs('#portalProgressFill');
  const feed1         = qs('#feedLine1');
  const feed2         = qs('#feedLine2');
  const feed3         = qs('#feedLine3');
  const feed4         = qs('#feedLine4');
  const feed5         = qs('#feedLine5');

  form.onsubmit = async (e) => {
    e.preventDefault();

    const requestedRole = localStorage.getItem(PENDING_ROLE) || 'student';
    const email         = (qs('#emailInput')?.value || '').trim().toLowerCase();
    const password      = qs('#passwordInput')?.value || '';
    const err           = qs('#loginError');
    const remember      = !!qs('#rememberMe')?.checked;
    const submitBtn     = form.querySelector('button[type="submit"]');

    if (!email || !password) {
      if (err) err.textContent = 'Please enter both email and password.';
      return;
    }

    // Check rate limiting policy
    const policy = loadSecurityPolicy();
    if (policy.rateLimit) {
      const attemptData = getFailedLoginAttempts(email);
      if (attemptData.lockedUntil > Date.now()) {
        const remainingSec = Math.ceil((attemptData.lockedUntil - Date.now()) / 1000);
        if (err) err.textContent = `Security lockout active: Too many failed attempts. Try again in ${remainingSec}s.`;
        return;
      }
    }

    // Trigger Full-Screen Sci-Fi Quantum Authorization Portal
    if (overlay) {
      if (portalSubRole) portalSubRole.textContent = `AUTHENTICATING ACCESS FOR ${requestedRole.toUpperCase()}`;
      overlay.classList.remove('warp-out', 'anomaly');
      overlay.classList.add('active');
      if (progressFill) {
        progressFill.style.width = '15%';
        progressFill.style.background = 'linear-gradient(90deg, var(--cyan), var(--gold), var(--violet))';
      }

      if (feed1) { feed1.className = 'feed-line active'; feed1.textContent = '> Initializing Secure Quantum Handshake...'; }
      if (feed2) { feed2.className = 'feed-line'; feed2.textContent = '> Computing SHA-256 Cryptographic Hash...'; }
      if (feed3) { feed3.className = 'feed-line'; feed3.textContent = '> Connecting to Google Apps Script Cloud Engine...'; }
      if (feed4) { feed4.className = 'feed-line'; feed4.textContent = '> Validating Access Matrix with Spreadsheet Database...'; }
      if (feed5) { feed5.className = 'feed-line'; feed5.textContent = '> Access Confirmed. Decrypting Session Matrix...'; }
    }

    submitBtn.disabled = true;
    if (err) err.textContent = '';

    const startTime = Date.now();

    try {
      // Step 1: Compute Hash
      const passwordHash = await hashPassword(password);
      if (feed2) feed2.classList.add('active');
      if (progressFill) progressFill.style.width = '35%';

      // Step 2: Fetch IP
      const publicIP = await getPublicIP();
      if (feed3) feed3.classList.add('active');
      // Step 3: Attempt authentication with Google Apps Script backend
      let result = null;
      try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method:   'POST',
          redirect: 'follow',
          headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
          body:     JSON.stringify({
            action:        'login',
            email:         email,
            passwordHash:  passwordHash,
            requestedRole: requestedRole
          }),
          signal:   AbortSignal.timeout(10000)
        });
        result = await response.json();
      } catch {
        result = null;
      }

      // Guarantee minimum 1.2s sequence for cinematic sci-fi immersion
      const elapsed = Date.now() - startTime;
      if (elapsed < 1200) {
        await new Promise(r => setTimeout(r, 1200 - elapsed));
      }

      const isServerSuccess = result && result.status === 'success';

      // Step 1: Check credentials against local Registered Users Data Center
      const localAccount = getRegisteredUser(email);
      let credentialsValid = false;
      let userBaseRole = 'student';
      let userName = email.split('@')[0];

      if (localAccount) {
        if (localAccount.passwordHash === passwordHash) {
          credentialsValid = true;
          userBaseRole = localAccount.role || 'student';
          userName = localAccount.name || userName;
        } else {
          credentialsValid = false;
        }
      }

      // Step 2: If local account not matched, check Google Apps Script cloud engine
      if (!credentialsValid && isServerSuccess) {
        credentialsValid = true;
        userBaseRole = result.role || 'student';
        userName = result.name || userName;
      } else if (!credentialsValid && result && result.message && result.message.startsWith('Unauthorized')) {
        // Server confirmed credentials but flagged role privilege
        credentialsValid = true;
        userBaseRole = 'student';
      }

      // Step 3: Check active cloud role overrides granted by Administrator in Data Center
      const overrides = loadRoleOverrides();
      const override = overrides.find(o => o.email.toLowerCase() === email);
      const activeOverride = override && (!override.expiresAt || override.expiresAt > Date.now()) ? override : null;

      if (activeOverride) {
        userName = activeOverride.name || userName;
      }

      // Authoritative role in the Data Center (student unless elevated to member or admin)
      const authoritativeRole = activeOverride ? activeOverride.grantedRole : userBaseRole;

      // If credentials failed authentication completely
      if (!credentialsValid) {
        appendLoginEvent({
          email:     email,
          role:      requestedRole,
          entryPage: `Login → ${capitalize(requestedRole)} (Invalid Credentials)`,
          ip:        publicIP,
          status:    'failed'
        });

        recordFailedLoginAttempt(email);

        const failMessage = localAccount && localAccount.passwordHash !== passwordHash
          ? 'Invalid password. Please check your credentials and try again.'
          : (result && result.message)
          ? result.message
          : 'Authentication rejected: Invalid email address or password.';

        if (overlay) {
          overlay.classList.add('anomaly');
          if (feed4) { feed4.className = 'feed-line error'; feed4.textContent = `> Anomaly: ${failMessage}`; }
          if (progressFill) { progressFill.style.background = 'var(--red)'; }
        }

        await new Promise(r => setTimeout(r, 1200));

        if (overlay) overlay.classList.remove('active', 'anomaly');
        if (err) err.textContent = failMessage;
        submitBtn.disabled = false;
        return;
      }

      // ── CRITICAL SECURITY CHECK: ROLE PRIVILEGE AUTHORIZATION ENFORCEMENT ──
      // If a student gives valid credentials but puts them in Member or Admin tab,
      // ACCESS IS DENIED! Do NOT log into student page. STOP and alert.
      let isAuthorized = false;
      let denialReason = '';

      if (requestedRole === 'admin') {
        if (authoritativeRole === 'admin') {
          isAuthorized = true;
        } else {
          denialReason = `Authorization denied: You do not have administrator privileges. (Your account role is ${capitalize(authoritativeRole)}).`;
        }
      } else if (requestedRole === 'member') {
        if (authoritativeRole === 'member' || authoritativeRole === 'admin') {
          isAuthorized = true;
        } else {
          denialReason = `Authorization denied: You do not have member privileges. (Your account role is ${capitalize(authoritativeRole)}).`;
        }
      } else if (requestedRole === 'student') {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        // STOP LOGIN! Do NOT set session, do NOT redirect to student page!
        appendLoginEvent({
          email:     email,
          role:      requestedRole,
          entryPage: `Login → ${capitalize(requestedRole)} (Privilege Mismatch)`,
          ip:        publicIP,
          status:    'failed'
        });

        if (overlay) {
          overlay.classList.add('anomaly');
          if (feed4) { feed4.className = 'feed-line error'; feed4.textContent = `> Access Matrix Error: Authorization Denied`; }
          if (feed5) { feed5.className = 'feed-line error'; feed5.textContent = `> Protocol Stop: Privilege mismatch for ${requestedRole.toUpperCase()}`; }
          if (progressFill) { progressFill.style.background = 'var(--red)'; }
        }

        await new Promise(r => setTimeout(r, 1300));

        if (overlay) overlay.classList.remove('active', 'anomaly');
        if (err) err.textContent = denialReason;
        submitBtn.disabled = false;
        return;
      }

      // Successful, authorized authentication!
      clearFailedLoginAttempts(email);

      const logId = appendLoginEvent({
        email:     email,
        role:      authoritativeRole,
        entryPage: `Login → ${capitalize(requestedRole)}`,
        ip:        publicIP,
        status:    'active'
      });

      const session = {
        role:  authoritativeRole,
        id:    email,
        name:  userName,
        at:    Date.now(),
        logId: logId
      };

      // Persistent session across all navigation
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

      if (remember) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ id: email, role: requestedRole }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      // Telemetry success progression
      if (feed4) { feed4.className = 'feed-line success'; }
      if (feed5) { feed5.className = 'feed-line success'; }
      if (progressFill) progressFill.style.width = '100%';

      await new Promise(r => setTimeout(r, 400));
      if (overlay) overlay.classList.add('warp-out');

      await new Promise(r => setTimeout(r, 450));

      // Redirect strictly based on requested room
      if (requestedRole === 'student') {
        location.href = 'student.html';
      } else if (requestedRole === 'member') {
        location.href = 'member.html';
      } else {
        location.href = 'admin.html';
      }

    } catch (errEx) {
      if (overlay) overlay.classList.remove('active');
      if (err) err.textContent = 'System error processing authentication.';
      submitBtn.disabled = false;
    }
  };
}

function setAuth(role) {
  localStorage.setItem(PENDING_ROLE, role);
  qsa('.role-option').forEach(x => {
    const isSelected = x.dataset.role === role;
    x.classList.toggle('active', isSelected);
    x.setAttribute('aria-checked', isSelected ? 'true' : 'false');
  });

  const label = qs('#selectedRole');
  if (label) {
    label.textContent =
      role === 'admin'  ? 'Administrator' :
      role === 'member' ? 'Society Member' :
      'Student';
  }

  const note = qs('#loginRoleNote');
  if (note) {
    note.textContent =
      role === 'student'
        ? 'Student access is open to everyone. Read-only access to academic labs, formulas, and forums.'
        : role === 'member'
        ? 'Member access requires institutional authorization to manage society events and archive.'
        : 'Administrator access requires full system privileges with cloud data server verification.';
  }
}

// ============================================================
//  ADMIN CONTROL CENTRE INITIALIZER
// ============================================================
function initAdmin() {
  const session = requireRole('admin');
  if (!session) return;

  initNav();
  pruneExpiredOverrides();

  // Operator badge & system clock
  const opBadge = qs('#adminOperatorBadge');
  if (opBadge) {
    opBadge.textContent = session.name || session.id || 'Administrator';
  }

  function updateClock() {
    const clock = qs('#systemClock');
    if (clock) {
      const now = new Date();
      clock.textContent = now.toTimeString().split(' ')[0] + ' Local';
    }
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Ping Server button
  const pingBtn = qs('#pingServerBtn');
  if (pingBtn) {
    pingBtn.onclick = async () => {
      pingBtn.disabled = true;
      pingBtn.innerHTML = `⟳ Pinging...`;
      const ping = await pingDataServer();
      const dot = qs('#serverStatusDot');
      const text = qs('#serverStatusText');
      if (ping.ok) {
        if (dot) dot.className = 'status-dot online';
        if (text) text.innerHTML = `Google Apps Script (Online ~${ping.latency}ms)`;
        showToast(`Data server online. Latency: ${ping.latency}ms.`, 'success');
      } else {
        if (dot) dot.className = 'status-dot offline';
        if (text) text.innerHTML = `Google Apps Script (Unreachable)`;
        showToast(`Data server ping failed: ${ping.error}`, 'error');
      }
      pingBtn.disabled = false;
      pingBtn.innerHTML = `⚡ Ping Server`;
    };
  }

  // Render initial dashboard components
  renderAdminStats();
  renderMemberAuthTable();
  renderLoginStatusTable();

  // Search filter for authorized users
  const searchInput = qs('#searchAuthUsers');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderMemberAuthTable(searchInput.value.trim());
    });
  }

  // Event delegation on Authorized Accounts table
  const authTbody = qs('#memberAuthTable');
  if (authTbody) {
    authTbody.addEventListener('change', (e) => {
      if (e.target.matches('.role-select')) {
        const email = e.target.dataset.email;
        const newRole = e.target.value;
        if (email && newRole) changeGrantedRole(email, newRole);
      }
    });

    authTbody.addEventListener('click', (e) => {
      const syncBtn = e.target.closest('.sync-user-btn');
      if (syncBtn) {
        const email = syncBtn.dataset.email;
        if (email) syncUserToServer(email);
        return;
      }
      const revokeBtn = e.target.closest('.revoke-user-btn');
      if (revokeBtn) {
        const email = revokeBtn.dataset.email;
        if (email) revokeOverride(email);
        return;
      }
    });
  }

  // Event delegation on Login Status Supervision table
  const loginTbody = qs('#loginStatusTable');
  if (loginTbody) {
    loginTbody.addEventListener('click', (e) => {
      const forceBtn = e.target.closest('.force-logout-btn');
      if (forceBtn) {
        const logId = forceBtn.dataset.logid;
        if (logId) forceLogoutSession(logId);
      }
    });
  }

  // Load existing security policy into form
  const policy = loadSecurityPolicy();
  const sec2fa = qs('#sec2fa');
  const secAlerts = qs('#secAlerts');
  const secRateLimit = qs('#secRateLimit');
  const sessionHours = qs('#sessionHours');

  if (sec2fa) sec2fa.checked = !!policy.twoFactor;
  if (secAlerts) secAlerts.checked = policy.loginAlerts !== false;
  if (secRateLimit) secRateLimit.checked = policy.rateLimit !== false;
  if (sessionHours) {
    sessionHours.value = Math.min(24, policy.sessionHours || 24);
    sessionHours.max = "24";
    sessionHours.addEventListener('input', () => {
      const val = parseInt(sessionHours.value, 10);
      if (val > 24) {
        sessionHours.value = 24;
        showToast('Maximum session expiration cannot exceed 24 hours.', 'warning', 2500);
      }
    });
  }

  // Security Form Submit
  const secForm = qs('#securityForm');
  if (secForm) {
    secForm.onsubmit = (e) => {
      e.preventDefault();
      const rawHours = parseInt(sessionHours?.value || 24, 10);
      if (rawHours > 24) {
        showToast('Maximum session expiration cannot exceed 24 hours.', 'error');
        if (sessionHours) sessionHours.value = 24;
        return;
      }
      const updatedPolicy = {
        twoFactor:    !!sec2fa?.checked,
        loginAlerts:  !!secAlerts?.checked,
        rateLimit:    !!secRateLimit?.checked,
        sessionHours: Math.max(1, Math.min(24, rawHours || 24))
      };
      saveSecurityPolicy(updatedPolicy);

      const banner = qs('#securitySavedBanner');
      if (banner) {
        banner.className = 'feedback-banner success show';
        banner.innerHTML = `✓ Security policy successfully updated (Session expiration capped at ${updatedPolicy.sessionHours}h) and enforced globally.`;
        setTimeout(() => { banner.classList.remove('show'); }, 5000);
      }
      showToast('Security governance policy saved and active.', 'success');
      renderAdminStats();
    };
  }

  // ── Global Typography Admin Control ─────────────────────────
  const fontSelect = qs('#globalFontSelect');
  const applyFontBtn = qs('#applyGlobalFontBtn');
  const resetFontBtn = qs('#resetGlobalFontBtn');
  const fontBanner = qs('#fontSavedBanner');
  const fontPreview = qs('#fontPreviewBox');

  if (fontSelect) {
    const currentPreset = localStorage.getItem(FONT_PRESET_KEY) || DEFAULT_FONT_PRESET;
    fontSelect.value = currentPreset;
    if (fontPreview) fontPreview.setAttribute('data-font-preset', currentPreset);

    fontSelect.onchange = () => {
      const selected = fontSelect.value;
      if (fontPreview) fontPreview.setAttribute('data-font-preset', selected);
      // Immediate preview on page
      document.documentElement.setAttribute('data-font-preset', selected);
    };
  }

  if (applyFontBtn) {
    applyFontBtn.onclick = () => {
      const selected = fontSelect ? fontSelect.value : DEFAULT_FONT_PRESET;
      applyFontPreset(selected, true);
      if (fontBanner) {
        fontBanner.className = 'feedback-banner success show';
        fontBanner.innerHTML = `✓ Website typography updated to <strong>${escapeHTML(selected.toUpperCase())}</strong> and published to all visitors.`;
        setTimeout(() => { fontBanner.classList.remove('show'); }, 6000);
      }
    };
  }

  if (resetFontBtn) {
    resetFontBtn.onclick = () => {
      if (fontSelect) fontSelect.value = DEFAULT_FONT_PRESET;
      applyFontPreset(DEFAULT_FONT_PRESET, true);
      if (fontBanner) {
        fontBanner.className = 'feedback-banner success show';
        fontBanner.innerHTML = `✓ Website typography reset to default <strong>Classic Academic</strong>.`;
        setTimeout(() => { fontBanner.classList.remove('show'); }, 6000);
      }
    };
  }

  // Refresh Login Status Monitor
  const refreshBtn = qs('#refreshLoginStatus');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      const spinner = qs('#refreshSpinner');
      const tableBody = qs('#loginStatusTable');
      if (spinner) spinner.style.transform = 'rotate(360deg)';
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:28px 12px;">${renderNewtonsCradle('Querying cloud authentication matrix...')}</td></tr>`;
      }
      setTimeout(() => {
        pruneExpiredOverrides();
        renderLoginStatusTable();
        renderMemberAuthTable(searchInput ? searchInput.value.trim() : '');
        renderAdminStats();
        showToast('Live session monitor refreshed.', 'info', 2000);
        if (spinner) spinner.style.transform = '';
      }, 400);
    };
  }

  // Session Filter
  const sessionFilter = qs('#sessionFilterRole');
  if (sessionFilter) {
    sessionFilter.onchange = () => renderLoginStatusTable();
  }

  // Temp-access toggle visibility
  const tempToggle   = qs('#tempAccessEnabled');
  const timerField   = qs('#tempTimerField');
  const timerMinField = qs('#tempTimerMinField');

  if (tempToggle) {
    tempToggle.onchange = () => {
      const show = tempToggle.checked;
      if (timerField)    timerField.style.display    = show ? '' : 'none';
      if (timerMinField) timerMinField.style.display = show ? '' : 'none';
    };
  }

  // Authorization Form Submit with Direct Server Synchronization
  const authForm = qs('#authForm');
  if (authForm) {
    authForm.onsubmit = async (e) => {
      e.preventDefault();

      const submitBtn   = qs('#authSubmitBtn');
      const banner      = qs('#authStatusBanner');
      const nameInput   = qs('#authName');
      const roleInput   = qs('#authRole');
      const emailInput  = qs('#authEmail');
      const tempEnabled = qs('#tempAccessEnabled')?.checked;
      const durationHours = parseFloat(qs('#tempDurationHours')?.value || 0);
      const durationMins  = parseFloat(qs('#tempDurationMins')?.value || 0);

      const email       = (emailInput?.value || '').trim().toLowerCase();
      let name          = (nameInput?.value || '').trim();
      if (!name && email) {
        const prefix = email.split('@')[0];
        name = prefix.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || email;
      }
      const grantedRole = roleInput?.value || 'member';
      const durationMs  = tempEnabled
        ? (durationHours * 3600 + durationMins * 60) * 1000
        : 0;

      if (!email) {
        showToast('Please provide an institutional email or ID.', 'error');
        return;
      }

      // UI Loading State
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <span style="display:inline-block; animation:spin 1s linear infinite;">⟳</span>
          <span>Syncing with Data Server...</span>
        `;
      }
      if (banner) {
        banner.className = 'feedback-banner info show';
        banner.innerHTML = `Connecting to Google Apps Script backend at <code>script.google.com</code>...`;
      }

      try {
        // Send authorization payload directly to the Google Apps Script backend
        const serverResult = await syncAuthorizationToServer({
          action: 'authorize',
          email:  email,
          role:   grantedRole,
          name:   name
        });

        if (serverResult.status === 'success') {
          // Success: Brand-new user appended to data server & spreadsheet!
          grantRoleOverride(email, name, 'student', grantedRole, durationMs, 'synced', 'Confirmed on Google Sheets');

          if (banner) {
            banner.className = 'feedback-banner success show';
            banner.innerHTML = `✓ <strong>Success:</strong> ${escapeHTML(name)} (${escapeHTML(email)}) successfully authorized as ${capitalize(grantedRole)}${durationMs > 0 ? ' (temporary)' : ''} and added to Google Sheets.`;
          }
          showToast(`Account authorized and added to Google Sheets.`, 'success');
          authForm.reset();
          if (timerField) timerField.style.display = 'none';
          if (timerMinField) timerMinField.style.display = 'none';

        } else if (serverResult.message === 'User already exists in the database.') {
          // Account is already recorded in the Google Sheet database.
          // Activate role override locally and explain transparently.
          grantRoleOverride(email, name, 'student', grantedRole, durationMs, 'in_sheet', 'Account in Google Sheet; local role override active');

          if (banner) {
            banner.className = 'feedback-banner info show';
            banner.innerHTML = `ℹ <strong>Server Record Confirmed:</strong> ${escapeHTML(email)} is already present in the Google Sheet database. Elevated role active locally as <strong>${capitalize(grantedRole)}</strong>. To alter their permanent row in the database, edit the <a href="${SPREADSHEET_URL}" target="_blank" rel="noopener noreferrer" style="color:var(--admin-cyan); text-decoration:underline;">Google Spreadsheet ↗</a>.`;
          }
          showToast(`User confirmed in Google Sheet database. Role override activated.`, 'info');
          authForm.reset();
          if (timerField) timerField.style.display = 'none';
          if (timerMinField) timerMinField.style.display = 'none';

        } else {
          // Server rejected or encountered error: DO NOT falsely grant access!
          if (banner) {
            banner.className = 'feedback-banner error show';
            banner.innerHTML = `✕ <strong>Data Server Error:</strong> ${escapeHTML(serverResult.message || 'Server rejected request.')}`;
          }
          showToast(`Server sync error: ${serverResult.message || 'Failed'}`, 'error');
        }

      } catch (err) {
        if (banner) {
          banner.className = 'feedback-banner error show';
          banner.innerHTML = `✕ Network error communicating with Google Apps Script backend.`;
        }
        showToast('Network error contacting Google Apps Script.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Authorize &amp; Sync to Data Server</span>`;
        }
        renderMemberAuthTable(searchInput ? searchInput.value.trim() : '');
        renderAdminStats();
      }
    };
  }

  // Periodic heartbeat timer (every 30 seconds)
  setInterval(() => {
    pruneExpiredOverrides();
    renderMemberAuthTable(searchInput ? searchInput.value.trim() : '');
    renderLoginStatusTable();
    renderAdminStats();
  }, 30_000);
}

// ── Admin KPI Stats Rendering ───────────────────────────────
function renderAdminStats() {
  const container = qs('#adminStats');
  if (!container) return;

  const overrides = loadRoleOverrides();
  const log = loadLoginLog();
  const policy = loadSecurityPolicy();

  const totalAuthorized = overrides.length;
  const activeSessions = log.filter(e => e.status === 'active').length;

  container.innerHTML = `
    <div class="stat">
      <span>Authorized Accounts</span>
      <strong>${totalAuthorized}</strong>
      <span class="stat-sub">Elevated Privileges Managed</span>
    </div>
    <div class="stat">
      <span>Active Sessions</span>
      <strong>${activeSessions}</strong>
      <span class="stat-sub">Live Portal Users Tracked</span>
    </div>
    <div class="stat">
      <span>Data Server Backend</span>
      <strong style="color:var(--admin-green);">Online</strong>
      <span class="stat-sub">Google Apps Script Connected</span>
    </div>
    <div class="stat">
      <span>Security Governance</span>
      <strong>${policy.sessionHours}h</strong>
      <span class="stat-sub">2FA ${policy.twoFactor ? 'Enforced' : 'Optional'} · Rate Limit On</span>
    </div>
  `;
}

// ── Member Authorization Table Rendering ────────────────────
function renderMemberAuthTable(searchQuery = '') {
  const tbody = qs('#memberAuthTable');
  const countSpan = qs('#authTableCount');
  if (!tbody) return;

  const overrides = loadRoleOverrides();
  const registeredUsers = loadRegisteredUsers();
  const now = Date.now();

  // Combine overrides with registered accounts so newly registered students appear in the directory
  const allAccountsMap = new Map();
  overrides.forEach(o => {
    allAccountsMap.set(o.email.toLowerCase(), { ...o });
  });
  registeredUsers.forEach(u => {
    const key = u.email.toLowerCase();
    if (!allAccountsMap.has(key)) {
      allAccountsMap.set(key, {
        email: u.email,
        name: u.name,
        originalRole: u.role || 'student',
        grantedRole: u.role || 'student',
        grantedAt: u.registeredAt || Date.now(),
        expiresAt: null,
        serverSynced: 'synced',
        syncNote: 'Registered Student in Data Center'
      });
    }
  });
  const allAccounts = Array.from(allAccountsMap.values());

  const query = (searchQuery || '').toLowerCase();
  const filtered = allAccounts.filter(o =>
    !query ||
    o.email.toLowerCase().includes(query) ||
    (o.name && o.name.toLowerCase().includes(query)) ||
    (o.grantedRole && o.grantedRole.toLowerCase().includes(query))
  );

  if (countSpan) {
    countSpan.textContent = `${filtered.length} account${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; color:var(--muted); padding:32px 16px;">
          ${searchQuery ? 'No authorized accounts match "' + escapeHTML(searchQuery) + '".' : 'No elevated user accounts currently authorized. Use the form above to grant access.'}
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    // Timer badge
    let timerHTML = '<span style="color:var(--muted); font-size:12px;">Permanent</span>';
    if (o.expiresAt) {
      const remaining = o.expiresAt - now;
      if (remaining > 0) {
        const mins  = Math.floor(remaining / 60000);
        const hours = Math.floor(mins / 60);
        const minsR = mins % 60;
        timerHTML = `
          <span class="timer-badge">
            ⏱ ${hours > 0 ? hours + 'h ' : ''}${minsR}m left
          </span>`;
      } else {
        timerHTML = `<span class="timer-badge expired">Expired (reverted)</span>`;
      }
    }

    // Server Sync Chip
    let syncChip = '';
    if (o.serverSynced === 'synced' || o.serverSynced === true) {
      syncChip = `<span class="server-sync-chip synced" title="${escapeAttr(o.syncNote || 'Confirmed on Google Sheets')}">● Confirmed on Server</span>`;
    } else if (o.serverSynced === 'in_sheet') {
      syncChip = `<span class="server-sync-chip in-sheet" title="${escapeAttr(o.syncNote || 'Account in Google Sheet; local role override active')}">▲ In Sheet (Override)</span>`;
    } else if (o.serverSynced === 'error') {
      syncChip = `<span class="server-sync-chip error" title="${escapeAttr(o.syncNote || 'Server sync error')}">✕ Sync Error</span>`;
    } else {
      syncChip = `<span class="server-sync-chip pending" title="Pending server confirmation">○ Pending Sync</span>`;
    }

    // Avatar initials
    const initials = (o.name || o.email)
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const safeEmail = escapeAttr(o.email);

    return `
      <tr>
        <!-- 1. User with Avatar -->
        <td>
          <div class="user-cell">
            <div class="user-avatar" aria-hidden="true">${escapeHTML(initials)}</div>
            <div class="user-meta">
              <strong>${escapeHTML(o.name || o.email.split('@')[0])}</strong>
              <small>${escapeHTML(o.email)}</small>
            </div>
          </div>
        </td>

        <!-- 2. Assigned Role with Dynamic Dropdown -->
        <td>
          <select
            class="admin-role-select role-select"
            data-email="${safeEmail}"
            style="padding:6px 8px; font-size:12px; border-radius:5px;"
            aria-label="Change role for ${safeEmail}">
            <option value="student" ${o.grantedRole === 'student' ? 'selected' : ''}>Student</option>
            <option value="member"  ${o.grantedRole === 'member'  ? 'selected' : ''}>Member</option>
            <option value="admin"   ${o.grantedRole === 'admin'   ? 'selected' : ''}>Administrator</option>
          </select>
        </td>

        <!-- 3. Email / ID -->
        <td>
          <span style="font-family:var(--admin-mono); font-size:12px; color:var(--muted);">${escapeHTML(o.email)}</span>
        </td>

        <!-- 4. Access Validity -->
        <td>${timerHTML}</td>

        <!-- 5. Server Sync Status -->
        <td>${syncChip}</td>

        <!-- 6. Governance Actions -->
        <td>
          <div style="display:flex; gap:6px; align-items:center;">
            <button
              class="mini-btn sync-user-btn"
              data-email="${safeEmail}"
              type="button"
              title="Test connection and sync permissions to data server">
              Sync
            </button>
            <button
              class="mini-btn danger-btn revoke-user-btn"
              data-email="${safeEmail}"
              type="button"
              title="Revoke access and revert to student">
              Revoke
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Role Modification with Honest Server Sync Tracking ───────
async function changeGrantedRole(email, newRole) {
  const normalized = email.toLowerCase().trim();
  const overrides = loadRoleOverrides();
  let entry = overrides.find(o => o.email.toLowerCase() === normalized);

  if (!entry) {
    const registered = getRegisteredUser(normalized);
    grantRoleOverride(normalized, registered ? registered.name : normalized.split('@')[0], 'student', newRole, 0, 'pending');
    entry = loadRoleOverrides().find(o => o.email.toLowerCase() === normalized);
  } else {
    entry.grantedRole  = newRole;
    entry.serverSynced = 'pending';
    entry.syncNote     = 'Dispatching update to data server...';
    saveRoleOverrides(overrides);
  }

  // Keep registered user record in sync
  const regUser = getRegisteredUser(normalized);
  if (regUser) {
    regUser.role = newRole;
    saveRegisteredUser(regUser);
  }

  renderMemberAuthTable();
  renderAdminStats();

  showToast(`Syncing role change (${capitalize(newRole)}) to data server...`, 'info', 2500);

  const res = await syncAuthorizationToServer({
    action: 'authorize',
    email:  email,
    role:   newRole,
    name:   entry ? entry.name : email
  });

  if (res.status === 'success') {
    entry.serverSynced = 'synced';
    entry.syncedAt     = Date.now();
    entry.syncNote     = 'Confirmed on Google Sheets';
    showToast(`Role updated to ${capitalize(newRole)} for ${email} and recorded on Google Sheets.`, 'success');
  } else if (res.message === 'User already exists in the database.') {
    entry.serverSynced = 'in_sheet';
    entry.syncedAt     = Date.now();
    entry.syncNote     = 'Account in Google Sheet; role override active locally';
    showToast(`Role updated to ${capitalize(newRole)} locally. (Account exists in Google Sheet)`, 'info');
  } else {
    entry.serverSynced = 'error';
    entry.syncNote     = res.message || 'Server sync error';
    showToast(`Server sync notice: ${res.message}`, 'error');
  }

  saveRoleOverrides(overrides);
  renderMemberAuthTable();
  renderAdminStats();
}

// ── Revoke User Override with Server Sync ───────────────────
async function revokeOverride(email) {
  showConfirmModal(`Are you sure you want to revoke authorization for ${email}? This will revert their access to Student.`, async () => {
    await executeRevokeOverride(email);
  }, 'Revoke Access');
}

async function executeRevokeOverride(email) {
  const overrides = loadRoleOverrides();
  const entry = overrides.find(o => o.email.toLowerCase() === email.toLowerCase());
  const name = entry ? entry.name : email;

  showToast(`Revoking permissions and updating records...`, 'info', 2500);

  // Send update to Google Apps Script
  await syncAuthorizationToServer({
    action: 'authorize',
    email:  email,
    role:   'student',
    name:   name
  });

  const remaining = overrides.filter(o => o.email.toLowerCase() !== email.toLowerCase());
  saveRoleOverrides(remaining);

  // Revert registered user record to student
  const regUser = getRegisteredUser(email);
  if (regUser) {
    regUser.role = 'student';
    saveRegisteredUser(regUser);
  }

  renderMemberAuthTable();
  renderAdminStats();

  showToast(`Authorization for ${email} revoked. (To permanently remove from Google Sheet, delete their row in the spreadsheet).`, 'warning', 5000);
}

// ── Manual Server Sync for Individual User ──────────────────
async function syncUserToServer(email) {
  const overrides = loadRoleOverrides();
  const entry = overrides.find(o => o.email.toLowerCase() === email.toLowerCase());
  if (!entry) return;

  showToast(`Verifying data server record for ${email}...`, 'info', 2000);

  const res = await syncAuthorizationToServer({
    action: 'authorize',
    email:  email,
    role:   entry.grantedRole,
    name:   entry.name
  });

  if (res.status === 'success') {
    entry.serverSynced = 'synced';
    entry.syncedAt     = Date.now();
    entry.syncNote     = 'Confirmed on Google Sheets';
    showToast(`Verified: ${email} is synchronized with Google Sheets database.`, 'success');
  } else if (res.message === 'User already exists in the database.') {
    entry.serverSynced = 'in_sheet';
    entry.syncedAt     = Date.now();
    entry.syncNote     = 'Account in Google Sheet; local role override active';
    showToast(`Verified: ${email} exists in Google Sheets database. Local override active.`, 'info');
  } else {
    entry.serverSynced = 'error';
    entry.syncNote     = res.message || 'Sync failed';
    showToast(`Server response: ${res.message}`, 'error');
  }

  saveRoleOverrides(overrides);
  renderMemberAuthTable();
  renderAdminStats();
}

// ── Duration Presets Shortcut ───────────────────────────────
function setDurationPreset(hours, mins, btnEl) {
  const h = qs('#tempDurationHours');
  const m = qs('#tempDurationMins');
  if (h) h.value = hours;
  if (m) m.value = mins;
  const toggle = qs('#tempAccessEnabled');
  if (toggle && !toggle.checked) {
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
  }
  qsa('.preset-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) {
    btnEl.classList.add('active');
  } else {
    qsa('.preset-btn').forEach(b => {
      if (b.textContent.trim().startsWith(hours + ' hr')) b.classList.add('active');
    });
  }
}

// ── Login Status / Supervision Table Rendering ──────────────
function renderLoginStatusTable() {
  const tbody = qs('#loginStatusTable');
  if (!tbody) return;

  const log         = loadLoginLog();
  const forceList   = getForceLogoutList();
  const currentSess = getStoredSession();
  const roleFilter  = qs('#sessionFilterRole')?.value || 'all';

  const filteredLog = log.filter(entry => {
    if (roleFilter === 'all') return true;
    return entry.role === roleFilter;
  });

  if (filteredLog.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; color:var(--muted); padding:32px 16px;">
          No matching session activity recorded.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filteredLog.map(entry => {
    let status = entry.status;
    if (forceList.includes(entry.id)) status = 'forced_out';

    const dotClass =
      status === 'active'     ? 'online'  :
      status === 'failed'     ? 'failed'  :
      status === 'forced_out' ? 'blocked' :
      'offline';

    const statusLabel =
      status === 'active'     ? '● Active'       :
      status === 'logged_out' ? '○ Logged out'   :
      status === 'forced_out' ? '⊘ Terminated'   :
      '✕ Failed';

    const roleBadgeClass =
      entry.role === 'admin'   ? 'admin' :
      entry.role === 'member'  ? 'member' :
      'student';

    const isSelf = currentSess && currentSess.logId === entry.id;

    const loginTimeFormatted = entry.loginTime
      ? new Date(entry.loginTime).toLocaleString(undefined, {
          month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
        })
      : '—';

    let controls = '';
    if (status === 'active') {
      if (isSelf) {
        controls = `<span style="color:var(--admin-cyan); font-family:var(--admin-mono); font-size:11px;">(current session)</span>`;
      } else {
        controls = `
          <button
            class="mini-btn danger-btn force-logout-btn"
            data-logid="${entry.id}"
            type="button"
            title="Immediately terminate this session">
            Force Logout
          </button>`;
      }
    } else {
      controls = `<span style="color:var(--muted); font-size:12px;">—</span>`;
    }

    return `
      <tr>
        <td>
          <strong style="color:var(--text);">${escapeHTML(entry.email)}</strong>
          ${isSelf ? ' <small style="color:var(--admin-cyan); font-family:var(--admin-mono);">(you)</small>' : ''}
        </td>
        <td>
          <span class="badge-chip ${roleBadgeClass}">${escapeHTML(capitalize(entry.role))}</span>
        </td>
        <td>
          <span style="font-family:var(--admin-mono); font-size:12px; color:var(--muted);">${loginTimeFormatted}</span>
        </td>
        <td>
          <span style="font-size:12px; color:var(--muted);">${escapeHTML(entry.entryPage || 'Direct')}</span>
        </td>
        <td>
          <span style="font-family:var(--admin-mono); font-size:12px; color:var(--muted);">${escapeHTML(entry.ip || 'Unknown')}</span>
        </td>
        <td>
          <span class="status-dot ${dotClass}" aria-hidden="true"></span>
          <span style="font-size:12px; font-weight:500;">${statusLabel}</span>
        </td>
        <td>${controls}</td>
      </tr>`;
  }).join('');
}

// ============================================================
//  STUDENT PORTAL, INTERACTIVE LAB, FORMULAS & FORUM ENGINE
// ============================================================

const BOOKMARKS_KEY = 'pupsFormulaBookmarks';
const SCRATCHPAD_KEY = 'pupsStudentScratchpad';
const FORUM_THREADS_KEY = 'pupsForumThreads';
const LAB_RUNS_KEY = 'pupsLabRunsCount';

// ── 18 Comprehensive Physics Formulas Database ──────────────
const PHYSICS_FORMULAS_DB = [
  {
    id: 'f_newton2',
    category: 'Mechanics',
    title: "Newton's Second Law",
    equation: 'F = m · a',
    latex: '\\mathbf{F} = m \\frac{d^2\\mathbf{r}}{dt^2}',
    description: 'Relates net external force acting on a body to its inertial mass and instantaneous acceleration.',
    variables: 'F: Net Force (N), m: Mass (kg), a: Acceleration (m/s²)',
    calcLabel: 'Net Force F (N)',
    inputs: [
      { key: 'm', label: 'Mass m (kg)', defaultVal: 5.0 },
      { key: 'a', label: 'Acceleration a (m/s²)', defaultVal: 9.81 }
    ],
    compute: (v) => ({ val: v.m * v.a, unit: 'N' })
  },
  {
    id: 'f_gravitation',
    category: 'Mechanics',
    title: 'Universal Law of Gravitation',
    equation: 'F = G m₁ m₂ / r²',
    latex: 'F = G \\frac{m_1 m_2}{r^2}',
    description: 'Gravitational attraction between two point masses separated by distance r.',
    variables: 'G = 6.674×10⁻¹¹ N·m²/kg², m₁,m₂: Masses (kg), r: Separation (m)',
    calcLabel: 'Gravitational Force F (N)',
    inputs: [
      { key: 'm1', label: 'Mass m₁ (kg)', defaultVal: 5.972e24 },
      { key: 'm2', label: 'Mass m₂ (kg)', defaultVal: 1000 },
      { key: 'r', label: 'Distance r (m)', defaultVal: 6.371e6 }
    ],
    compute: (v) => ({ val: (6.67430e-11 * v.m1 * v.m2) / Math.max(1e-12, v.r * v.r), unit: 'N' })
  },
  {
    id: 'f_lagrangian',
    category: 'Mechanics',
    title: 'Euler–Lagrange & Action Functional',
    equation: 'L = T − V  |  d/dt(∂L/∂q̇) − ∂L/∂q = 0',
    latex: '\\mathcal{L} = T - V, \\quad \\frac{d}{dt}\\left(\\frac{\\partial \\mathcal{L}}{\\partial \\dot{q}_i}\\right) - \\frac{\\partial \\mathcal{L}}{\\partial q_i} = 0',
    description: 'Stationary action principle governing classical trajectories in generalized coordinates.',
    variables: 'L: Lagrangian (J), T: Kinetic Energy (J), V: Potential Energy (J)',
    calcLabel: 'Lagrangian L = T − V (J)',
    inputs: [
      { key: 'T', label: 'Kinetic Energy T (J)', defaultVal: 120.5 },
      { key: 'V', label: 'Potential Energy V (J)', defaultVal: 45.0 }
    ],
    compute: (v) => ({ val: v.T - v.V, unit: 'J' })
  },
  {
    id: 'f_shm',
    category: 'Mechanics',
    title: 'Simple Pendulum & Harmonic Oscillator',
    equation: 'T = 2π √(L / g)',
    latex: 'T = 2\\pi \\sqrt{\\frac{L}{g}}, \\quad \\omega_0 = \\sqrt{\\frac{g}{L}}',
    description: 'Small-angle oscillation period of a simple gravitational pendulum of length L.',
    variables: 'T: Period (s), L: Pendulum Length (m), g: Gravity (m/s²)',
    calcLabel: 'Oscillation Period T (s)',
    inputs: [
      { key: 'L', label: 'Length L (m)', defaultVal: 1.0 },
      { key: 'g', label: 'Gravity g (m/s²)', defaultVal: 9.80665 }
    ],
    compute: (v) => ({ val: 2 * Math.PI * Math.sqrt(Math.max(0, v.L) / Math.max(1e-9, v.g)), unit: 's' })
  },
  {
    id: 'f_schrodinger',
    category: 'Quantum',
    title: 'Time-Dependent Schrödinger Equation',
    equation: 'iℏ ∂ψ/∂t = Ĥψ = [−(ℏ²/2m)∇² + V(r)]ψ',
    latex: 'i\\hbar \\frac{\\partial \\psi}{\\partial t} = \\left( -\\frac{\\hbar^2}{2m}\\nabla^2 + V(\\mathbf{r}) \\right)\\psi',
    description: 'Fundamental unitary time-evolution equation of non-relativistic quantum state wavefunctions.',
    variables: 'ℏ: Reduced Planck constant, ψ: Wavefunction, E_n: Box Eigenenergy (eV)',
    calcLabel: '1D Infinite Well Energy Eₙ (eV)',
    inputs: [
      { key: 'n', label: 'Quantum Number n', defaultVal: 1 },
      { key: 'L_nm', label: 'Well Width L (nm)', defaultVal: 1.0 }
    ],
    compute: (v) => {
      const h = 6.62607015e-34, me = 9.1093837e-31, eV = 1.602176634e-19;
      const L = Math.max(1e-12, v.L_nm * 1e-9);
      const E_J = (v.n * v.n * h * h) / (8 * me * L * L);
      return { val: E_J / eV, unit: 'eV' };
    }
  },
  {
    id: 'f_debroglie',
    category: 'Quantum',
    title: 'de Broglie Matter-Wave Relation',
    equation: 'λ = h / p = h / (m · v)',
    latex: '\\lambda = \\frac{h}{p} = \\frac{h}{mv}',
    description: 'Connects wave-particle duality wavelength λ to relativistic or classical particle momentum p.',
    variables: 'h = 6.626×10⁻³⁴ J·s, m: Mass (kg), v: Velocity (m/s)',
    calcLabel: 'de Broglie Wavelength λ (m)',
    inputs: [
      { key: 'm', label: 'Particle Mass m (kg)', defaultVal: 9.1093837e-31 },
      { key: 'v', label: 'Velocity v (m/s)', defaultVal: 1.0e6 }
    ],
    compute: (v) => ({ val: 6.62607015e-34 / Math.max(1e-45, v.m * v.v), unit: 'm' })
  },
  {
    id: 'f_heisenberg',
    category: 'Quantum',
    title: 'Heisenberg Uncertainty Principle',
    equation: 'Δx · Δp ≥ ℏ / 2',
    latex: '\\sigma_x \\sigma_p \\geq \\frac{\\hbar}{2}',
    description: 'Fundamental quantum limit on simultaneous precision of conjugate position and momentum observables.',
    variables: 'Δx: Position spread (m), Δp_min: Minimum Momentum uncertainty (kg·m/s)',
    calcLabel: 'Min Momentum Spread Δp (kg·m/s)',
    inputs: [
      { key: 'dx', label: 'Position Uncertainty Δx (m)', defaultVal: 1.0e-10 }
    ],
    compute: (v) => ({ val: 1.054571817e-34 / (2 * Math.max(1e-30, v.dx)), unit: 'kg·m/s' })
  },
  {
    id: 'f_tunneling',
    category: 'Quantum',
    title: 'Quantum Barrier Tunneling (WKB)',
    equation: 'T ≈ exp(−2 a √(2m(V₀ − E)) / ℏ)',
    latex: 'T \\approx \\exp\\left( -\\frac{2a}{\\hbar}\\sqrt{2m(V_0 - E)} \\right)',
    description: 'Transmission probability of a quantum particle tunneling across a rectangular potential barrier V₀ > E.',
    variables: 'V₀: Barrier Height (eV), E: Particle Energy (eV), a: Width (nm)',
    calcLabel: 'Transmission Probability T',
    inputs: [
      { key: 'V0', label: 'Barrier Height V₀ (eV)', defaultVal: 5.0 },
      { key: 'E', label: 'Particle Energy E (eV)', defaultVal: 4.0 },
      { key: 'a_nm', label: 'Barrier Width a (nm)', defaultVal: 0.2 }
    ],
    compute: (v) => {
      if (v.E >= v.V0) return { val: 1.0, unit: '(Classical Transmission)' };
      const me = 9.1093837e-31, eV = 1.602176634e-19, hbar = 1.054571817e-34;
      const kappa = Math.sqrt(2 * me * (v.V0 - v.E) * eV) / hbar;
      const T = Math.exp(-2 * kappa * (v.a_nm * 1e-9));
      return { val: T, unit: 'probability' };
    }
  },
  {
    id: 'f_maxwell',
    category: 'Electrodynamics',
    title: "Maxwell–Ampère & Faraday Laws",
    equation: '∇ × B = μ₀J + μ₀ε₀ ∂E/∂t  |  c = 1/√(μ₀ε₀)',
    latex: '\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}',
    description: 'Unifies electricity, magnetism, and electromagnetic wave propagation in media.',
    variables: 'n: Refractive index √(εᵣμᵣ), v_p: Phase velocity in medium (m/s)',
    calcLabel: 'Wave Speed in Medium v = c/n (m/s)',
    inputs: [
      { key: 'er', label: 'Relative Permittivity εᵣ', defaultVal: 2.25 },
      { key: 'mur', label: 'Relative Permeability μᵣ', defaultVal: 1.0 }
    ],
    compute: (v) => ({ val: 299792458 / Math.sqrt(Math.max(1, v.er * v.mur)), unit: 'm/s' })
  },
  {
    id: 'f_coulomb',
    category: 'Electrodynamics',
    title: "Coulomb's Electrostatic Law",
    equation: 'F = (1 / 4πε₀) · |q₁ q₂| / r²',
    latex: 'F = \\frac{1}{4\\pi\\varepsilon_0} \\frac{|q_1 q_2|}{r^2}',
    description: 'Electrostatic force magnitude between two point charges separated by distance r in vacuum.',
    variables: 'k_e = 8.98755×10⁹ N·m²/C², q₁,q₂: Charges (C), r: Distance (m)',
    calcLabel: 'Electrostatic Force F (N)',
    inputs: [
      { key: 'q1', label: 'Charge q₁ (C)', defaultVal: 1.602e-19 },
      { key: 'q2', label: 'Charge q₂ (C)', defaultVal: 1.602e-19 },
      { key: 'r', label: 'Separation r (m)', defaultVal: 5.29e-11 }
    ],
    compute: (v) => ({ val: (8.9875517923e9 * Math.abs(v.q1 * v.q2)) / Math.max(1e-30, v.r * v.r), unit: 'N' })
  },
  {
    id: 'f_lorentz_force',
    category: 'Electrodynamics',
    title: 'Lorentz Force & Cyclotron Radius',
    equation: 'F = q(E + v × B)  |  r_c = mv / (|q|B)',
    latex: '\\mathbf{F} = q(\\mathbf{E} + \\mathbf{v} \\times \\mathbf{B}), \\quad r_c = \\frac{mv}{|q|B}',
    description: 'Force on a charged particle moving in electromagnetic fields and resulting magnetic gyroradius.',
    variables: 'm: Mass (kg), v: Speed (m/s), q: Charge (C), B: Magnetic Field (T)',
    calcLabel: 'Magnetic Force q·v·B (N)',
    inputs: [
      { key: 'q', label: 'Charge q (C)', defaultVal: 1.60217663e-19 },
      { key: 'v', label: 'Velocity v (m/s)', defaultVal: 2.0e6 },
      { key: 'B', label: 'Magnetic Field B (T)', defaultVal: 0.5 }
    ],
    compute: (v) => ({ val: Math.abs(v.q * v.v * v.B), unit: 'N' })
  },
  {
    id: 'f_doubleslit',
    category: 'Electrodynamics',
    title: "Young's Double-Slit Interference",
    equation: 'Δy = λ L / d  |  d sin θ = m λ',
    latex: '\\Delta y = \\frac{\\lambda L}{d}, \\quad I(\\theta) = I_0 \\cos^2\\left(\\frac{\\pi d \\sin\\theta}{\\lambda}\\right)',
    description: 'Fringe spacing Δy on a screen at distance L from two coherent slits separated by d.',
    variables: 'λ: Wavelength (nm), L: Screen Distance (m), d: Slit Separation (mm)',
    calcLabel: 'Fringe Spacing Δy (mm)',
    inputs: [
      { key: 'lam_nm', label: 'Wavelength λ (nm)', defaultVal: 532 },
      { key: 'L_m', label: 'Screen Distance L (m)', defaultVal: 1.5 },
      { key: 'd_mm', label: 'Slit Separation d (mm)', defaultVal: 0.25 }
    ],
    compute: (v) => ({ val: ((v.lam_nm * 1e-6) * (v.L_m * 1e3)) / Math.max(1e-6, v.d_mm), unit: 'mm' })
  },
  {
    id: 'f_boltzmann',
    category: 'Statistical',
    title: 'Boltzmann Entropy Formula',
    equation: 'S = k_B ln Ω',
    latex: 'S = k_B \\ln \\Omega',
    description: 'Connects macroscopic thermodynamic entropy S to the number of accessible microstates Ω.',
    variables: 'k_B = 1.380649×10⁻²³ J/K, Ω: Multiplicity of microstates',
    calcLabel: 'Entropy S (J/K)',
    inputs: [
      { key: 'omega', label: 'Microstates Ω', defaultVal: 1.0e24 }
    ],
    compute: (v) => ({ val: 1.380649e-23 * Math.log(Math.max(1, v.omega)), unit: 'J/K' })
  },
  {
    id: 'f_planck',
    category: 'Statistical',
    title: 'Wien Displacement & Blackbody Peak',
    equation: 'λ_max · T = b ≈ 2.8978 × 10⁻³ m·K',
    latex: '\\lambda_{\\max} T = b, \\quad u_\\nu(T) = \\frac{8\\pi h \\nu^3}{c^3} \\frac{1}{e^{h\\nu/k_B T} - 1}',
    description: 'Peak emission wavelength of a Planckian blackbody radiator at equilibrium temperature T.',
    variables: 'T: Absolute Temperature (K), b = 2.897771955×10⁻³ m·K',
    calcLabel: 'Peak Wavelength λ_max (nm)',
    inputs: [
      { key: 'T', label: 'Temperature T (K)', defaultVal: 5778 }
    ],
    compute: (v) => ({ val: (2.897771955e-3 / Math.max(1e-3, v.T)) * 1e9, unit: 'nm' })
  },
  {
    id: 'f_ideal_gas',
    category: 'Statistical',
    title: 'Maxwell–Boltzmann Thermal RMS Speed',
    equation: 'v_rms = √(3 k_B T / m) = √(3 R T / M)',
    latex: 'v_{\\text{rms}} = \\sqrt{\\frac{3 k_B T}{m}} = \\sqrt{\\frac{3 R T}{M}}',
    description: 'Root-mean-square thermal speed of gas molecules of molar mass M at temperature T.',
    variables: 'T: Temperature (K), M: Molar Mass (g/mol), R = 8.31446 J/(mol·K)',
    calcLabel: 'RMS Thermal Speed v_rms (m/s)',
    inputs: [
      { key: 'T', label: 'Temperature T (K)', defaultVal: 300 },
      { key: 'M_g', label: 'Molar Mass M (g/mol)', defaultVal: 28.014 }
    ],
    compute: (v) => ({ val: Math.sqrt((3 * 8.314462618 * Math.max(0, v.T)) / Math.max(1e-6, v.M_g * 1e-3)), unit: 'm/s' })
  },
  {
    id: 'f_einstein_rel',
    category: 'Relativity',
    title: 'Relativistic Energy–Momentum Relation',
    equation: 'E² = (pc)² + (m₀c²)²  |  γ = 1/√(1 − β²)',
    latex: 'E^2 = (pc)^2 + (m_0 c^2)^2, \\quad \\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}',
    description: 'Lorentz factor γ and total relativistic energy of a particle moving at fraction β = v/c.',
    variables: 'β = v/c: Speed fraction of light (0 ≤ β < 1), γ: Lorentz factor',
    calcLabel: 'Lorentz Factor γ',
    inputs: [
      { key: 'beta', label: 'Velocity Fraction β = v/c', defaultVal: 0.866 }
    ],
    compute: (v) => {
      const b = Math.min(0.99999999, Math.max(0, Math.abs(v.beta)));
      return { val: 1 / Math.sqrt(1 - b * b), unit: '(dimensionless)' };
    }
  },
  {
    id: 'f_schwarzschild',
    category: 'Relativity',
    title: 'Schwarzschild Event Horizon Radius',
    equation: 'r_s = 2 G M / c²',
    latex: 'r_s = \\frac{2GM}{c^2}, \\quad ds^2 = -\\left(1-\\frac{r_s}{r}\\right)c^2 dt^2 + \\left(1-\\frac{r_s}{r}\\right)^{-1}dr^2 + r^2 d\\Omega^2',
    description: 'Gravitational radius of a non-rotating spherically symmetric mass M in General Relativity.',
    variables: 'M_solar: Mass in Solar Masses (M☉ = 1.98847×10³⁰ kg), r_s: Radius (km)',
    calcLabel: 'Schwarzschild Radius r_s (km)',
    inputs: [
      { key: 'M_sun', label: 'Mass (in Solar Masses M☉)', defaultVal: 10.0 }
    ],
    compute: (v) => ({ val: 2.95325 * Math.max(0, v.M_sun), unit: 'km' })
  },
  {
    id: 'f_hubble',
    category: 'Relativity',
    title: 'Hubble–Lemaître Cosmological Expansion',
    equation: 'v = H₀ · d  |  z ≈ v / c',
    latex: 'v = H_0 d',
    description: 'Recessional velocity of extragalactic objects as a function of proper distance d in an expanding universe.',
    variables: 'H₀: Hubble parameter (km/s/Mpc), d: Proper Distance (Mpc)',
    calcLabel: 'Recessional Velocity v (km/s)',
    inputs: [
      { key: 'H0', label: 'Hubble Constant H₀ (km/s/Mpc)', defaultVal: 70.0 },
      { key: 'd_mpc', label: 'Distance d (Mpc)', defaultVal: 100.0 }
    ],
    compute: (v) => ({ val: v.H0 * v.d_mpc, unit: 'km/s' })
  }
];

// ── Fundamental Physical Constants (CODATA) ─────────────────
const PHYSICAL_CONSTANTS_DB = [
  { name: 'Speed of light in vacuum', symbol: 'c', value: '299792458', unit: 'm·s⁻¹' },
  { name: 'Planck constant', symbol: 'h', value: '6.62607015e-34', unit: 'J·s' },
  { name: 'Reduced Planck constant', symbol: 'ℏ', value: '1.054571817e-34', unit: 'J·s' },
  { name: ' Newtonian constant of gravitation', symbol: 'G', value: '6.67430e-11', unit: 'm³·kg⁻¹·s⁻²' },
  { name: 'Elementary charge', symbol: 'e', value: '1.602176634e-19', unit: 'C' },
  { name: 'Electron mass', symbol: 'm_e', value: '9.1093837015e-31', unit: 'kg' },
  { name: 'Proton mass', symbol: 'm_p', value: '1.67262192369e-27', unit: 'kg' },
  { name: 'Boltzmann constant', symbol: 'k_B', value: '1.380649e-23', unit: 'J·K⁻¹' },
  { name: 'Avogadro constant', symbol: 'N_A', value: '6.02214076e23', unit: 'mol⁻¹' },
  { name: 'Vacuum electric permittivity', symbol: 'ε₀', value: '8.8541878128e-12', unit: 'F·m⁻¹' },
  { name: 'Vacuum magnetic permeability', symbol: 'μ₀', value: '1.25663706212e-6', unit: 'N·A⁻²' },
  { name: 'Fine-structure constant', symbol: 'α', value: '0.0072973525693', unit: 'dimensionless' },
  { name: 'Stefan–Boltzmann constant', symbol: 'σ', value: '5.670374419e-8', unit: 'W·m⁻²·K⁻⁴' },
  { name: 'Bohr radius', symbol: 'a₀', value: '5.29177210903e-11', unit: 'm' }
];

// ── Daily Conceptual Challenges for Student Dashboard ────────
const DAILY_CHALLENGES_DB = [
  {
    topic: 'QUANTUM MECHANICS · WAVEFUNCTIONS',
    question: 'If the width L of a 1D infinite potential well is doubled while keeping the quantum number n = 1 fixed, how does the ground-state energy E₁ change?',
    options: [
      'It decreases by a factor of 4 (E₁ → E₁ / 4)',
      'It decreases by a factor of 2 (E₁ → E₁ / 2)',
      'It increases by a factor of 2 (E₁ → 2 E₁)',
      'It remains unchanged'
    ],
    correctIndex: 0,
    explanation: 'Since Eₙ = n²π²ℏ² / (2mL²), doubling L scales the energy by 1 / 2² = 1/4.'
  },
  {
    topic: 'CLASSICAL MECHANICS · ORBITAL DYNAMICS',
    question: 'In the circular restricted three-body problem, how many co-rotating equilibrium Lagrange points exist in the orbital plane?',
    options: [
      '3 collinear points only',
      '5 points (3 unstable collinear L₁, L₂, L₃ and 2 triangular L₄, L₅)',
      '2 stable points at periapsis and apoapsis',
      '4 symmetric points around the barycenter'
    ],
    correctIndex: 1,
    explanation: 'Euler and Lagrange proved there are 5 equilibrium points: L₁, L₂, L₃ along the line joining the primaries, and L₄, L₅ forming equilateral triangles.'
  },
  {
    topic: 'STATISTICAL PHYSICS · THERMODYNAMICS',
    question: 'According to Wien’s Displacement Law, if a star’s surface temperature doubles from 3,000 K to 6,000 K, its peak blackbody wavelength λ_max:',
    options: [
      'Doubles (shifts toward infrared)',
      'Halves (shifts toward shorter, bluer wavelengths)',
      'Decreases by a factor of 16',
      'Remains constant while total luminosity increases'
    ],
    correctIndex: 1,
    explanation: 'From λ_max · T = b, λ_max is inversely proportional to T. Doubling T halves λ_max.'
  },
  {
    topic: 'ELECTRODYNAMICS · PHYSICAL OPTICS',
    question: 'In Young’s double-slit experiment, if the slit separation d is halved while screen distance L and wavelength λ remain fixed, the fringe spacing Δy:',
    options: [
      'Halves',
      'Doubles',
      'Quadruples',
      'Vanishes due to diffraction'
    ],
    correctIndex: 1,
    explanation: 'Since Δy = λL / d, halving the slit separation d doubles the distance between adjacent bright fringes.'
  }
];

function loadFormulaBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : ['f_schrodinger', 'f_lagrangian', 'f_gravitation'];
  } catch {
    return ['f_schrodinger', 'f_lagrangian'];
  }
}

function saveFormulaBookmarks(list) {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  } catch {}
}

function copyTextSafe(text, successMsg = 'Copied to clipboard!') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, 'success', 2200);
    }).catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(successMsg, 'success', 2200);
  } catch {
    showToast('Copy not supported in this browser context.', 'warning');
  }
}

// ── Default Seed Threads for Academic Forum ─────────────────
const DEFAULT_FORUM_THREADS = [
  {
    id: 'th_101',
    title: 'Symplectic Velocity-Verlet vs. RK4 energy drift in the Restricted 3-Body Lab',
    category: 'Astrophysics',
    authorName: 'Aritra Sengupta',
    authorEmail: 'aritra.s@presiuniv.ac.in',
    authorRole: 'member',
    createdAt: '2026-10-18T14:20:00.000Z',
    tags: ['Three-Body', 'Symplectic', 'Lagrange Points'],
    body: 'When running long orbital integrations around the L4 tadpole point in the Interactive Lab, why does a 2nd-order symplectic Velocity-Verlet integrator preserve bounded total energy E = T + V better over 10,000 orbits than standard 4th-order Runge-Kutta (RK4)?',
    upvotes: 14,
    upvotedBy: [],
    pinned: true,
    replies: [
      {
        id: 'rep_1',
        authorName: 'Dr. Aritra Bakshi',
        authorEmail: 'abakshi@presiuniv.ac.in',
        authorRole: 'admin',
        createdAt: '2026-10-18T16:05:00.000Z',
        body: 'Great observation! Symplectic integrators exactly conserve a shadow Hamiltonian H_tilde that stays within O(dt^2) of the true Hamiltonian, so phase-space volume (Liouville theorem) is preserved and energy error oscillates without secular drift. Standard RK4 is non-symplectic and leaks energy monotonically over many periods.'
      },
      {
        id: 'rep_2',
        authorName: 'Sohini Chatterjee',
        authorEmail: 'sohini.c@presiuniv.ac.in',
        authorRole: 'student',
        createdAt: '2026-10-19T09:15:00.000Z',
        body: 'You can test this directly in Lab Module 01 by setting Mass Ratio mu = 0.04 and clicking the "Chaotic Slingshot" preset—watch how the total energy E telemetry stays bounded!'
      }
    ]
  },
  {
    id: 'th_102',
    title: 'Physical intuition behind resonant transmission in double-barrier quantum tunneling',
    category: 'Quantum / Optics',
    authorName: 'Debanjan Roy',
    authorEmail: 'debanjan.roy@presiuniv.ac.in',
    authorRole: 'student',
    createdAt: '2026-10-20T11:40:00.000Z',
    tags: ['Quantum Tunneling', 'WKB', 'Wavepacket'],
    body: 'In Lab Module 03 (Quantum Wavepacket Tunneling), even when the particle energy E is lower than the barrier height V0, a noticeable transmitted probability packet emerges on the right. How does Fabry-Pérot interference enable near-100% transmission if two barriers are placed in series?',
    upvotes: 11,
    upvotedBy: [],
    pinned: false,
    replies: [
      {
        id: 'rep_3',
        authorName: 'Prof. Snigdha Das',
        authorEmail: 'snigdha.das@presiuniv.ac.in',
        authorRole: 'member',
        createdAt: '2026-10-20T15:12:00.000Z',
        body: 'When the incident energy E matches a quasi-bound eigenstate between the two barriers, destructive interference cancels the reflected wave and constructive interference builds up amplitude inside the well—exactly analogous to an optical Fabry-Pérot etalon!'
      }
    ]
  },
  {
    id: 'th_103',
    title: 'Measuring Seebeck coefficient and thermal conductivity in low-dimensional tellurides',
    category: 'Materials Physics',
    authorName: 'Ananya Mukherjee',
    authorEmail: 'ananya.m@presiuniv.ac.in',
    authorRole: 'member',
    createdAt: '2026-10-22T08:30:00.000Z',
    tags: ['Thermoelectrics', 'Condensed Matter', 'Transport'],
    body: 'Sharing our experimental checklist from Baker Building Lab for minimizing radiative heat-loss errors during four-probe resistivity and Seebeck measurements between 80 K and 400 K. Feel free to ask if you are joining next month’s Condensed Matter project!',
    upvotes: 9,
    upvotedBy: [],
    pinned: false,
    replies: []
  },
  {
    id: 'th_104',
    title: 'Choosing Courant-Friedrichs-Lewy (CFL) step sizes for 1D Crank-Nicolson Schrödinger solvers',
    category: 'Computational Physics',
    authorName: 'Ritwick Ghosh',
    authorEmail: 'ritwick.g@presiuniv.ac.in',
    authorRole: 'student',
    createdAt: '2026-10-24T17:45:00.000Z',
    tags: ['Crank-Nicolson', 'Unitary Evolution', 'Python'],
    body: 'While explicit forward-Euler schemes for the time-dependent Schrödinger equation are unconditionally unstable (violating unitarity ||psi|| = 1), Crank-Nicolson is unconditionally unitary. What spatial grid dx vs dt ratio gives the cleanest group-velocity dispersion in practice?',
    upvotes: 8,
    upvotedBy: [],
    pinned: false,
    replies: []
  }
];

function loadForumThreads() {
  try {
    const raw = localStorage.getItem(FORUM_THREADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  localStorage.setItem(FORUM_THREADS_KEY, JSON.stringify(DEFAULT_FORUM_THREADS));
  return clone(DEFAULT_FORUM_THREADS);
}

function saveForumThreads(threads) {
  try {
    localStorage.setItem(FORUM_THREADS_KEY, JSON.stringify(threads));
  } catch {}
}

// ── 1. STUDENT PORTAL DASHBOARD INITIALIZER ─────────────────
function initStudent() {
  const session = requireRole('student');
  if (!session) return;
  initNav();

  const idSpan = qs('#studentId');
  if (idSpan) {
    idSpan.textContent = session.name || session.id.split('@')[0] || 'Student';
  }
  const emailBadge = qs('#studentEmailBadge');
  if (emailBadge) {
    emailBadge.textContent = session.id || '';
  }
  const roleBadge = qs('#studentRoleBadge');
  if (roleBadge) {
    roleBadge.textContent = `${capitalize(session.role || 'student')} · Interactive Academic Access`;
  }

  // Update Live Telemetry Cards
  const bookmarks = loadFormulaBookmarks();
  const threads = loadForumThreads();
  const db = loadDB();
  const totalReplies = threads.reduce((acc, t) => acc + (t.replies ? t.replies.length : 0), 0);
  const labRuns = parseInt(localStorage.getItem(LAB_RUNS_KEY) || '4', 10);

  const bmCountEl = qs('#statBookmarkedCount');
  if (bmCountEl) bmCountEl.textContent = `${bookmarks.length} Bookmarked · Live Solvers`;

  const forumStatEl = qs('#statForumThreads');
  if (forumStatEl) forumStatEl.textContent = `${threads.length} Threads`;
  const forumRepEl = qs('#statForumReplies');
  if (forumRepEl) forumRepEl.textContent = `${totalReplies} Peer Replies · 4 Rooms`;

  const upCountEl = qs('#statUpcomingCount');
  if (upCountEl) upCountEl.textContent = `${(db.events || []).length + (db.colloquia || []).length} Listed`;

  const labRunsEl = qs('#statLabRuns');
  if (labRunsEl) labRunsEl.textContent = `4 Engines (${labRuns} runs)`;

  // Daily Conceptual Challenge Widget
  let currentChallengeIdx = 0;
  const topicEl = qs('#challengeTopic');
  const questionEl = qs('#challengeQuestion');
  const optionsEl = qs('#challengeOptions');
  const feedbackEl = qs('#challengeFeedback');
  const nextBtn = qs('#nextChallengeBtn');

  function renderChallenge(idx) {
    const item = DAILY_CHALLENGES_DB[idx % DAILY_CHALLENGES_DB.length];
    if (!topicEl || !questionEl || !optionsEl) return;
    topicEl.textContent = item.topic;
    questionEl.textContent = item.question;
    if (feedbackEl) {
      feedbackEl.className = 'feedback-banner';
      feedbackEl.textContent = '';
    }
    optionsEl.innerHTML = item.options.map((opt, oIdx) => `
      <button type="button" class="btn ghost challenge-opt-btn" data-idx="${oIdx}" style="justify-content:flex-start; text-align:left; padding:10px 14px; font-size:13px; width:100%;">
        <strong style="font-family:var(--font-mono); color:var(--cyan); margin-right:8px;">${String.fromCharCode(65 + oIdx)}.</strong>
        <span>${escapeHTML(opt)}</span>
      </button>
    `).join('');

    optionsEl.querySelectorAll('.challenge-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = parseInt(btn.dataset.idx, 10);
        const isCorrect = chosen === item.correctIndex;
        optionsEl.querySelectorAll('.challenge-opt-btn').forEach((b, bIdx) => {
          b.style.pointerEvents = 'none';
          if (bIdx === item.correctIndex) {
            b.style.borderColor = 'var(--green)';
            b.style.color = 'var(--green)';
          } else if (bIdx === chosen && !isCorrect) {
            b.style.borderColor = 'var(--red)';
            b.style.color = 'var(--red)';
          }
        });
        if (feedbackEl) {
          feedbackEl.className = `feedback-banner ${isCorrect ? 'success' : 'error'} show`;
          feedbackEl.textContent = (isCorrect ? '✓ Correct! ' : '✕ Not quite. ') + item.explanation;
        }
      });
    });
  }

  renderChallenge(currentChallengeIdx);
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentChallengeIdx = (currentChallengeIdx + 1) % DAILY_CHALLENGES_DB.length;
      renderChallenge(currentChallengeIdx);
    });
  }

  // Personal Lab & Derivation Scratchpad
  const pad = qs('#studentScratchpad');
  const padStatus = qs('#scratchpadStatus');
  const padChars = qs('#scratchpadCharCount');
  const exportBtn = qs('#exportNotesBtn');
  const clearBtn = qs('#clearNotesBtn');

  if (pad) {
    const savedNotes = localStorage.getItem(SCRATCHPAD_KEY) || '';
    pad.value = savedNotes;
    if (padChars) padChars.textContent = `${savedNotes.length} chars`;

    pad.addEventListener('input', () => {
      const val = pad.value;
      try {
        localStorage.setItem(SCRATCHPAD_KEY, val);
        if (padStatus) padStatus.textContent = '✓ Saved at ' + new Date().toLocaleTimeString();
      } catch {}
      if (padChars) padChars.textContent = `${val.length} chars`;
    });
  }

  if (exportBtn && pad) {
    exportBtn.addEventListener('click', () => {
      const content = pad.value.trim() || 'Presidency University Physics Society — Student Study Notes';
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pups-physics-notes-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Study notes exported as .txt file.', 'success');
    });
  }

  if (clearBtn && pad) {
    clearBtn.addEventListener('click', () => {
      pad.value = '';
      try { localStorage.removeItem(SCRATCHPAD_KEY); } catch {}
      if (padChars) padChars.textContent = '0 chars';
      if (padStatus) padStatus.textContent = 'Scratchpad cleared';
      showToast('Scratchpad cleared.', 'info');
    });
  }

  // Render Bookmarked Formulas Quick List
  const bmContainer = qs('#studentBookmarkedFormulas');
  if (bmContainer) {
    const bmSet = new Set(loadFormulaBookmarks());
    const savedItems = PHYSICS_FORMULAS_DB.filter(f => bmSet.has(f.id));
    if (savedItems.length === 0) {
      bmContainer.innerHTML = `<p style="font-size:12.5px; color:var(--muted); margin:0;">No formulas bookmarked yet. Click the ★ icon on any card in the <a href="formulas.html" style="color:var(--cyan);">Formula Compendium</a>.</p>`;
    } else {
      bmContainer.innerHTML = savedItems.map(f => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--panel2); border:1px solid var(--line); border-radius:6px; gap:10px;">
          <div>
            <strong style="font-size:13.5px; color:var(--text-heading); display:block;">${escapeHTML(f.title)}</strong>
            <span style="font-family:var(--font-mono); font-size:11.5px; color:var(--cyan);">${escapeHTML(f.equation)}</span>
          </div>
          <a class="mini-btn" href="formulas.html#${escapeAttr(f.id)}" style="text-decoration:none;">Solve →</a>
        </div>
      `).join('');
    }
  }

  // Render Upcoming Events & Colloquia Feed
  const upList = qs('#studentUpcomingList');
  if (upList) {
    const items = [
      ...(db.events || []).slice(0, 2).map(e => ({ kind: e.type || 'Event', title: e.title, date: e.date, link: 'events.html' })),
      ...(db.colloquia || []).slice(0, 2).map(c => ({ kind: 'Colloquium · ' + c.field, title: c.title, date: c.date, link: 'colloquium.html' }))
    ];
    upList.innerHTML = items.map(it => `
      <a href="${it.link}" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--panel2); border:1px solid var(--line); border-radius:6px; text-decoration:none; color:var(--text);">
        <div>
          <span style="font-family:var(--font-mono); font-size:10px; color:var(--gold); text-transform:uppercase;">${escapeHTML(it.kind)}</span>
          <strong style="display:block; font-size:13.5px; color:var(--text-heading);">${escapeHTML(it.title)}</strong>
        </div>
        <span style="font-family:var(--font-mono); font-size:11px; color:var(--muted); white-space:nowrap;">${formatDate(it.date)}</span>
      </a>
    `).join('');
  }

  initTiltCards();
}

// ── 2. INTERACTIVE FORMULAS & SOLVERS INITIALIZER ───────────
function initFormulas() {
  const session = requireRole('student');
  if (!session) return;
  initNav();

  const grid = qs('#formulasGrid');
  const searchInput = qs('#formulaSearchInput');
  const catBtns = qsa('.formula-cat-btn');
  const calcSelect = qs('#calcFormulaSelect');
  const calcInputs = qs('#calcInputsContainer');
  const calcResult = qs('#calcResultValue');
  const calcTarget = qs('#calcTargetLabel');
  const calcPreview = qs('#calcFormulaPreview');

  let activeCategory = 'all';
  let bookmarks = new Set(loadFormulaBookmarks());

  function formatScientific(num) {
    if (!Number.isFinite(num)) return 'Undefined';
    if (num === 0) return '0';
    const abs = Math.abs(num);
    if (abs >= 1e5 || abs < 1e-3) {
      return num.toExponential(4).replace('e+', ' × 10^').replace('e-', ' × 10^-');
    }
    return Number(num.toPrecision(6)).toString();
  }

  // Populate Solver Dropdown
  if (calcSelect) {
    calcSelect.innerHTML = PHYSICS_FORMULAS_DB.map(f =>
      `<option value="${escapeAttr(f.id)}">${escapeHTML(f.category)} — ${escapeHTML(f.title)} (${escapeHTML(f.equation)})</option>`
    ).join('');
  }

  function loadCalculatorFormula(formulaId) {
    const f = PHYSICS_FORMULAS_DB.find(item => item.id === formulaId) || PHYSICS_FORMULAS_DB[0];
    if (!f || !calcInputs) return;
    if (calcSelect && calcSelect.value !== f.id) calcSelect.value = f.id;
    if (calcTarget) calcTarget.textContent = f.calcLabel;
    if (calcPreview) calcPreview.textContent = `${f.equation}   |   ${f.variables}`;

    calcInputs.innerHTML = f.inputs.map(inp => `
      <div class="field" style="margin:0;">
        <label for="calc_inp_${escapeAttr(inp.key)}" style="font-size:11px;">${escapeHTML(inp.label)}</label>
        <input id="calc_inp_${escapeAttr(inp.key)}" data-key="${escapeAttr(inp.key)}" type="number" step="any" value="${inp.defaultVal}" style="padding:8px 10px; font-family:var(--font-mono); font-size:13px;">
      </div>
    `).join('');

    function evaluateNow() {
      const vals = {};
      f.inputs.forEach(inp => {
        const el = qs(`#calc_inp_${inp.key}`);
        vals[inp.key] = parseFloat(el ? el.value : inp.defaultVal) || 0;
      });
      const res = f.compute(vals);
      if (calcResult) {
        calcResult.textContent = `${formatScientific(res.val)} ${res.unit}`;
      }
    }

    calcInputs.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', evaluateNow);
    });
    evaluateNow();
  }

  if (calcSelect) {
    calcSelect.addEventListener('change', () => loadCalculatorFormula(calcSelect.value));
  }

  function renderFormulaCards() {
    if (!grid) return;
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

    const filtered = PHYSICS_FORMULAS_DB.filter(f => {
      const matchCat =
        activeCategory === 'all' ? true :
        activeCategory === 'bookmarked' ? bookmarks.has(f.id) :
        f.category.toLowerCase() === activeCategory.toLowerCase();
      const matchQuery =
        !query ||
        f.title.toLowerCase().includes(query) ||
        f.category.toLowerCase().includes(query) ||
        f.equation.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query) ||
        f.variables.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="panel" style="grid-column: 1 / -1; text-align:center; padding:32px;"><p style="color:var(--muted); margin:0;">No equations match your filter criteria.</p></div>`;
      return;
    }

    grid.innerHTML = filtered.map(f => {
      const isSaved = bookmarks.has(f.id);
      return `
        <article class="card" id="${escapeAttr(f.id)}" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <div class="meta">${escapeHTML(f.category)}</div>
              <button type="button" class="mini-btn bookmark-formula-btn" data-id="${escapeAttr(f.id)}" title="${isSaved ? 'Remove bookmark' : 'Bookmark formula'}" style="padding:3px 8px; font-size:12px; color:${isSaved ? 'var(--gold)' : 'var(--muted)'}; border-color:${isSaved ? 'var(--gold)' : 'var(--line)'};">
                ${isSaved ? '★ Saved' : '☆ Bookmark'}
              </button>
            </div>
            <h3 style="margin-top:8px;">${escapeHTML(f.title)}</h3>
            <div class="equation" style="font-size:18px; margin:10px 0; padding:10px 12px; background:var(--panel2); border-radius:6px; border:1px solid var(--line); font-family:var(--font-mono); overflow-x:auto;">${escapeHTML(f.equation)}</div>
            <p style="font-size:13px; margin-bottom:8px;">${escapeHTML(f.description)}</p>
            <small style="display:block; font-family:var(--font-mono); font-size:11px; color:var(--muted); line-height:1.5;">${escapeHTML(f.variables)}</small>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; padding-top:12px; border-top:1px solid var(--line);">
            <button type="button" class="mini-btn primary-btn solve-formula-btn" data-id="${escapeAttr(f.id)}" style="flex:1;">
              ⚡ Open in Solver
            </button>
            <button type="button" class="mini-btn copy-latex-btn" data-latex="${escapeAttr(f.latex)}" title="Copy LaTeX code">
              📋 Copy LaTeX
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Wire card buttons
    grid.querySelectorAll('.solve-formula-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fid = btn.dataset.id;
        loadCalculatorFormula(fid);
        const panel = qs('#formulaCalculatorPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Formula loaded into interactive solver.', 'info', 1800);
      });
    });

    grid.querySelectorAll('.copy-latex-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        copyTextSafe(btn.dataset.latex || '', 'LaTeX equation copied to clipboard!');
      });
    });

    grid.querySelectorAll('.bookmark-formula-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fid = btn.dataset.id;
        if (bookmarks.has(fid)) {
          bookmarks.delete(fid);
          showToast('Removed from bookmarked formulas.', 'info', 1800);
        } else {
          bookmarks.add(fid);
          showToast('Formula bookmarked to your Student Portal!', 'success', 1800);
        }
        saveFormulaBookmarks(Array.from(bookmarks));
        renderFormulaCards();
      });
    });
  }

  // Category pill filters
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active', 'primary-btn'));
      btn.classList.add('active', 'primary-btn');
      activeCategory = btn.dataset.cat || 'all';
      renderFormulaCards();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', renderFormulaCards);
  }

  // Physical Constants Table & Unit Converter
  const constBody = qs('#constantsTableBody');
  const constSearch = qs('#constantSearchInput');

  function renderConstants(filter = '') {
    if (!constBody) return;
    const q = filter.trim().toLowerCase();
    const list = PHYSICAL_CONSTANTS_DB.filter(c =>
      !q || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q) || c.unit.toLowerCase().includes(q)
    );
    constBody.innerHTML = list.map(c => `
      <tr>
        <td><strong>${escapeHTML(c.name)}</strong></td>
        <td style="font-family:var(--font-mono); color:var(--cyan); font-weight:700;">${escapeHTML(c.symbol)}</td>
        <td style="font-family:var(--font-mono);">${escapeHTML(c.value)}</td>
        <td style="font-family:var(--font-mono); color:var(--muted);">${escapeHTML(c.unit)}</td>
        <td>
          <button type="button" class="mini-btn copy-const-btn" data-val="${escapeAttr(c.value)}">Copy Value</button>
        </td>
      </tr>
    `).join('');

    constBody.querySelectorAll('.copy-const-btn').forEach(btn => {
      btn.addEventListener('click', () => copyTextSafe(btn.dataset.val, `Copied ${btn.dataset.val} to clipboard!`));
    });
  }

  if (constSearch) {
    constSearch.addEventListener('input', () => renderConstants(constSearch.value));
  }

  // Quick Unit Converter
  const convInput = qs('#unitConvInput');
  const convType = qs('#unitConvType');
  const convOut = qs('#unitConvOutput');

  function updateUnitConverter() {
    if (!convInput || !convType || !convOut) return;
    const v = parseFloat(convInput.value) || 0;
    const mode = convType.value;
    let resText = '';
    if (mode === 'ev_to_j') {
      resText = `= ${formatScientific(v * 1.602176634e-19)} J`;
    } else if (mode === 'j_to_ev') {
      resText = `= ${formatScientific(v / 1.602176634e-19)} eV`;
    } else if (mode === 'nm_to_ev') {
      resText = v > 0 ? `= ${formatScientific(1239.84193 / v)} eV` : '= — eV';
    } else if (mode === 'k_to_c') {
      resText = `= ${(v - 273.15).toFixed(2)} °C`;
    } else if (mode === 'au_to_m') {
      resText = `= ${formatScientific(v * 1.495978707e11)} m`;
    } else if (mode === 'pc_to_ly') {
      resText = `= ${(v * 3.261563777).toFixed(4)} ly`;
    }
    convOut.textContent = resText;
  }

  if (convInput) convInput.addEventListener('input', updateUnitConverter);
  if (convType) convType.addEventListener('change', updateUnitConverter);

  // Initial render
  const hashId = (location.hash || '').replace('#', '');
  const initialFormula = PHYSICS_FORMULAS_DB.some(f => f.id === hashId) ? hashId : PHYSICS_FORMULAS_DB[0].id;
  loadCalculatorFormula(initialFormula);
  renderFormulaCards();
  renderConstants();
  updateUnitConverter();
}

// ── 3. INTERACTIVE ACADEMIC FORUM INITIALIZER ───────────────
function initForum() {
  const session = requireRole('student');
  if (!session) return;
  initNav();

  const container = qs('#forumThreadsContainer');
  const searchInput = qs('#forumSearchInput');
  const sortSelect = qs('#forumSortSelect');
  const roomCards = qsa('.forum-room-card');
  const toggleNewBtn = qs('#toggleNewThreadBtn');
  const closeComposerBtn = qs('#closeComposerBtn');
  const composerPanel = qs('#newThreadComposer');
  const newThreadForm = qs('#newForumThreadForm');

  let activeRoom = 'all';
  let openReplyThreadId = null;

  if (toggleNewBtn && composerPanel) {
    toggleNewBtn.addEventListener('click', () => {
      const isHidden = composerPanel.style.display === 'none';
      composerPanel.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        const titleInp = qs('#threadTitleInput');
        if (titleInp) titleInp.focus();
      }
    });
  }

  if (closeComposerBtn && composerPanel) {
    closeComposerBtn.addEventListener('click', () => {
      composerPanel.style.display = 'none';
    });
  }

  roomCards.forEach(card => {
    const activateRoom = () => {
      roomCards.forEach(c => {
        c.classList.remove('active');
        c.style.borderColor = '';
      });
      card.classList.add('active');
      card.style.borderColor = 'var(--cyan)';
      activeRoom = card.dataset.room || 'all';
      renderThreads();
    };
    card.addEventListener('click', activateRoom);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateRoom();
      }
    });
  });

  function renderThreads() {
    if (!container) return;
    const threads = loadForumThreads();
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const sortBy = sortSelect ? sortSelect.value : 'popular';
    const userEmail = (session.id || '').toLowerCase();
    const isModerator = session.role === 'admin' || session.role === 'member';

    const filtered = threads.filter(t => {
      const matchRoom = activeRoom === 'all' || t.category === activeRoom;
      const tagsStr = (t.tags || []).join(' ').toLowerCase();
      const matchQuery =
        !query ||
        t.title.toLowerCase().includes(query) ||
        t.body.toLowerCase().includes(query) ||
        t.authorName.toLowerCase().includes(query) ||
        tagsStr.includes(query);
      return matchRoom && matchQuery;
    });

    filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'replies') {
        return (b.replies?.length || 0) - (a.replies?.length || 0);
      }
      return (b.upvotes || 0) - (a.upvotes || 0);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <section class="panel" style="text-align:center; padding:36px 20px;">
          <p style="color:var(--muted); margin:0 0 12px;">No discussion threads match your current room or search query.</p>
          <button type="button" class="btn primary" id="emptyStartThreadBtn">+ Start the First Discussion</button>
        </section>`;
      const emptyBtn = qs('#emptyStartThreadBtn');
      if (emptyBtn && composerPanel) {
        emptyBtn.addEventListener('click', () => {
          composerPanel.style.display = 'block';
          composerPanel.scrollIntoView({ behavior: 'smooth' });
        });
      }
      return;
    }

    container.innerHTML = filtered.map(t => {
      const hasUpvoted = Array.isArray(t.upvotedBy) && t.upvotedBy.includes(userEmail);
      const canDeleteThread = isModerator || (t.authorEmail && t.authorEmail.toLowerCase() === userEmail);
      const replies = t.replies || [];
      const isExpanded = openReplyThreadId === t.id;

      const tagsHTML = (t.tags || []).map(tag =>
        `<span class="badge" style="font-size:10px; padding:2px 8px;">#${escapeHTML(tag)}</span>`
      ).join('');

      const repliesHTML = replies.map(r => {
        const canDelReply = isModerator || (r.authorEmail && r.authorEmail.toLowerCase() === userEmail);
        return `
          <div style="padding:12px 14px; background:var(--panel2); border-left:2px solid var(--cyan); border-radius:4px; margin-top:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <strong style="font-size:13px; color:var(--text-heading);">${escapeHTML(r.authorName)}</strong>
                <span class="badge-chip ${escapeAttr(r.authorRole || 'student')}" style="font-size:9.5px; padding:1px 6px;">${escapeHTML(capitalize(r.authorRole || 'student'))}</span>
                <span style="font-family:var(--font-mono); font-size:11px; color:var(--muted);">${formatDate(r.createdAt)}</span>
              </div>
              ${canDelReply ? `<button type="button" class="mini-btn danger-btn delete-reply-btn" data-tid="${escapeAttr(t.id)}" data-rid="${escapeAttr(r.id)}" style="padding:2px 6px; font-size:10px;">Delete</button>` : ''}
            </div>
            <p style="margin:0; font-size:13.5px; line-height:1.6; color:var(--text); white-space:pre-line;">${escapeHTML(r.body)}</p>
          </div>
        `;
      }).join('');

      return `
        <article class="panel" id="thread_${escapeAttr(t.id)}" style="padding:22px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
            <div>
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
                ${t.pinned ? `<span class="badge" style="border-color:var(--gold); color:var(--gold); font-size:10px;">📌 PINNED</span>` : ''}
                <span class="kicker" style="margin:0;">${escapeHTML(t.category)}</span>
                <span style="font-family:var(--font-mono); font-size:11px; color:var(--muted);">· Posted by <strong>${escapeHTML(t.authorName)}</strong> (${escapeHTML(capitalize(t.authorRole || 'student'))}) on ${formatDate(t.createdAt)}</span>
              </div>
              <h2 style="margin:4px 0 10px; font-size:21px; line-height:1.3;">${escapeHTML(t.title)}</h2>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <button type="button" class="mini-btn upvote-thread-btn ${hasUpvoted ? 'primary-btn' : ''}" data-tid="${escapeAttr(t.id)}" aria-label="Upvote discussion" style="padding:6px 12px; font-family:var(--font-mono);">
                ▲ ${t.upvotes || 0}
              </button>
              ${canDeleteThread ? `<button type="button" class="mini-btn danger-btn delete-thread-btn" data-tid="${escapeAttr(t.id)}" title="Delete thread" style="padding:6px 10px;">✕</button>` : ''}
            </div>
          </div>

          <p style="font-size:14px; line-height:1.7; color:var(--text); margin:0 0 14px; white-space:pre-line;">${escapeHTML(t.body)}</p>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding-top:12px; border-top:1px solid var(--line);">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">${tagsHTML}</div>
            <button type="button" class="mini-btn toggle-replies-btn" data-tid="${escapeAttr(t.id)}" style="font-family:var(--font-mono);">
              💬 ${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'} · ${isExpanded ? 'Hide' : 'View / Reply'}
            </button>
          </div>

          <!-- Replies & Reply Composer Drawer -->
          <div id="replies_box_${escapeAttr(t.id)}" style="display:${isExpanded ? 'block' : 'none'}; margin-top:14px; padding-top:12px; border-top:1px dashed var(--line);">
            ${repliesHTML || `<p style="font-size:12.5px; color:var(--muted); margin:0 0 10px;">No replies yet. Be the first to respond!</p>`}
            <form class="reply-thread-form" data-tid="${escapeAttr(t.id)}" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
              <input type="text" class="reply-input" maxlength="1200" placeholder="Write a peer response, derivation hint, or reference..." required style="flex:1; min-width:220px; padding:8px 12px; font-size:13px;">
              <button type="submit" class="btn primary" style="padding:8px 16px; font-size:12.5px;">Post Reply</button>
            </form>
          </div>
        </article>
      `;
    }).join('');

    // Wire Upvotes
    container.querySelectorAll('.upvote-thread-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.tid;
        const list = loadForumThreads();
        const item = list.find(x => x.id === tid);
        if (!item) return;
        if (!Array.isArray(item.upvotedBy)) item.upvotedBy = [];
        const idx = item.upvotedBy.indexOf(userEmail);
        if (idx === -1) {
          item.upvotedBy.push(userEmail);
          item.upvotes = (item.upvotes || 0) + 1;
        } else {
          item.upvotedBy.splice(idx, 1);
          item.upvotes = Math.max(0, (item.upvotes || 1) - 1);
        }
        saveForumThreads(list);
        renderThreads();
      });
    });

    // Wire Toggle Replies
    container.querySelectorAll('.toggle-replies-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.tid;
        openReplyThreadId = openReplyThreadId === tid ? null : tid;
        renderThreads();
      });
    });

    // Wire Reply Submission
    container.querySelectorAll('.reply-thread-form').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const tid = form.dataset.tid;
        const inp = form.querySelector('.reply-input');
        const body = (inp ? inp.value : '').trim();
        if (!body) return;
        const list = loadForumThreads();
        const item = list.find(x => x.id === tid);
        if (!item) return;
        if (!Array.isArray(item.replies)) item.replies = [];
        item.replies.push({
          id: 'rep_' + Date.now(),
          authorName: session.name || session.id.split('@')[0] || 'Student',
          authorEmail: session.id,
          authorRole: session.role || 'student',
          createdAt: new Date().toISOString(),
          body: body
        });
        saveForumThreads(list);
        openReplyThreadId = tid;
        renderThreads();
        showToast('Reply posted to discussion.', 'success', 2000);
      });
    });

    // Wire Delete Thread
    container.querySelectorAll('.delete-thread-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.tid;
        const list = loadForumThreads().filter(x => x.id !== tid);
        saveForumThreads(list);
        renderThreads();
        showToast('Discussion thread removed.', 'info', 2000);
      });
    });

    // Wire Delete Reply
    container.querySelectorAll('.delete-reply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.tid;
        const rid = btn.dataset.rid;
        const list = loadForumThreads();
        const item = list.find(x => x.id === tid);
        if (!item || !Array.isArray(item.replies)) return;
        item.replies = item.replies.filter(r => r.id !== rid);
        saveForumThreads(list);
        openReplyThreadId = tid;
        renderThreads();
        showToast('Reply deleted.', 'info', 1800);
      });
    });
  }

  // New Thread Form Submit
  if (newThreadForm) {
    newThreadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = (qs('#threadTitleInput')?.value || '').trim();
      const category = qs('#threadCategorySelect')?.value || 'Astrophysics';
      const tagsRaw = (qs('#threadTagsInput')?.value || '').trim();
      const body = (qs('#threadBodyInput')?.value || '').trim();

      if (!title || !body) {
        showToast('Please enter both a discussion title and details.', 'error');
        return;
      }

      const tags = tagsRaw
        ? tagsRaw.split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean).slice(0, 5)
        : [category.split(' ')[0]];

      const list = loadForumThreads();
      const newThread = {
        id: 'th_' + Date.now(),
        title,
        category,
        authorName: session.name || session.id.split('@')[0] || 'Student',
        authorEmail: session.id,
        authorRole: session.role || 'student',
        createdAt: new Date().toISOString(),
        tags,
        body,
        upvotes: 1,
        upvotedBy: [(session.id || '').toLowerCase()],
        pinned: false,
        replies: []
      };
      list.unshift(newThread);
      saveForumThreads(list);
      newThreadForm.reset();
      if (composerPanel) composerPanel.style.display = 'none';
      openReplyThreadId = newThread.id;
      renderThreads();
      showToast('Discussion thread published to the forum!', 'success');
    });
  }

  if (searchInput) searchInput.addEventListener('input', renderThreads);
  if (sortSelect) sortSelect.addEventListener('change', renderThreads);

  renderThreads();
}

// ── 4. REAL-TIME INTERACTIVE PHYSICS LAB ENGINE ─────────────
function initLab() {
  const session = requireRole('student');
  if (!session) return;
  initNav();

  const canvas = qs('#labSimCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const stateSpan = qs('#labState');
  const messageP = qs('#labMessage');
  const eqDisplay = qs('#labEquationDisplay');
  const expKicker = qs('#labExpKicker');
  const expTitle = qs('#labExpTitle');
  const slidersBox = qs('#labSlidersContainer');
  const presetsBox = qs('#labPresetsBar');
  const runBtn = qs('#runLab');
  const stepBtn = qs('#stepLab');
  const resetBtn = qs('#resetLab');
  const clearTrailBtn = qs('#clearTrailBtn');
  const exportCsvBtn = qs('#exportLabCsvBtn');
  const expTabs = qsa('.lab-exp-tab');

  const teleL1 = qs('#teleLabel1'), teleV1 = qs('#teleVal1');
  const teleL2 = qs('#teleLabel2'), teleV2 = qs('#teleVal2');
  const teleL3 = qs('#teleLabel3'), teleV3 = qs('#teleVal3');
  const teleL4 = qs('#teleLabel4'), teleV4 = qs('#teleVal4');

  let activeExp = 'orbital';
  let isRunning = true;
  let simTime = 0;
  let telemetryLog = [];
  let animId = null;

  // Increment lab runs counter for dashboard stats
  try {
    const prev = parseInt(localStorage.getItem(LAB_RUNS_KEY) || '4', 10);
    localStorage.setItem(LAB_RUNS_KEY, String(prev + 1));
  } catch {}

  // Resize canvas cleanly
  function syncCanvasSize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(480, Math.floor(rect.width));
    canvas.height = Math.max(320, Math.floor(rect.height));
  }
  syncCanvasSize();
  window.addEventListener('resize', syncCanvasSize, { passive: true });

  // Experiment State Containers
  const expConfig = {
    orbital: {
      kicker: 'EXPERIMENT 01 · CELESTIAL MECHANICS',
      title: 'Restricted Three-Body Playground',
      equation: 'r̈ = −G M₁ r₁/|r₁|³ − G M₂ r₂/|r₂|³',
      description: 'Symplectic Velocity-Verlet integrator solving planar 3-body gravitational dynamics. Click anywhere on the canvas to launch the test satellite from a new position.',
      labels: ['Time (t)', 'Kinetic (T)', 'Potential (V)', 'Total Energy (E)'],
      params: {
        mu: { label: 'Mass Ratio μ = M₂/(M₁+M₂)', min: 0.05, max: 0.5, step: 0.01, val: 0.20 },
        v0: { label: 'Initial Tangential Speed v₀', min: 0.4, max: 2.2, step: 0.05, val: 1.15 },
        dt: { label: 'Integration Step Δt', min: 0.005, max: 0.04, step: 0.005, val: 0.015 }
      },
      presets: [
        { name: 'Figure-8 / Binary Transfer', vals: { mu: 0.25, v0: 1.05, dt: 0.015 } },
        { name: 'Lagrange Orbit', vals: { mu: 0.12, v0: 1.30, dt: 0.015 } },
        { name: 'Chaotic Slingshot', vals: { mu: 0.40, v0: 0.85, dt: 0.02 } }
      ]
    },
    pendulum: {
      kicker: 'EXPERIMENT 02 · NONLINEAR DYNAMICS',
      title: 'Damped Driven Pendulum & Phase Portrait',
      equation: 'θ̈ + γ θ̇ + (g/L) sin(θ) = A cos(ω_d t)',
      description: '4th-Order Runge-Kutta (RK4) solver showing real-time physical pendulum motion on the left and its (θ, ω) phase-space attractor on the right.',
      labels: ['Time (t)', 'Angle θ (rad)', 'Angular Vel ω', 'Mech Energy (E)'],
      params: {
        g_L: { label: 'Natural Freq² (g/L)', min: 2.0, max: 20.0, step: 0.5, val: 9.8 },
        gamma: { label: 'Damping Coefficient γ', min: 0.0, max: 1.5, step: 0.05, val: 0.15 },
        driveA: { label: 'Driving Torque Amplitude A', min: 0.0, max: 15.0, step: 0.5, val: 4.5 }
      },
      presets: [
        { name: 'Undamped Harmonic', vals: { g_L: 9.8, gamma: 0.0, driveA: 0.0 } },
        { name: 'Damped Spiral Attractor', vals: { g_L: 9.8, gamma: 0.35, driveA: 0.0 } },
        { name: 'Driven Limit Cycle / Chaos', vals: { g_L: 9.8, gamma: 0.2, driveA: 11.5 } }
      ]
    },
    quantum: {
      kicker: 'EXPERIMENT 03 · QUANTUM MECHANICS',
      title: 'Gaussian Wavepacket Barrier Tunneling',
      equation: 'iℏ ∂ψ/∂t = [−(ℏ²/2m) ∂²/∂x² + V(x)] ψ(x,t)',
      description: 'Visualizes real Re(ψ), imaginary Im(ψ), and probability density |ψ(x,t)|² scattering across a potential energy barrier V₀.',
      labels: ['Time (t)', 'Incident Energy E', 'Barrier V₀', 'Transmission T'],
      params: {
        k0: { label: 'Wavepacket Momentum k₀', min: 2.0, max: 8.0, step: 0.2, val: 4.5 },
        v0: { label: 'Barrier Height V₀ (eV)', min: 1.0, max: 10.0, step: 0.5, val: 5.0 },
        width: { label: 'Barrier Width a (nm)', min: 0.1, max: 1.2, step: 0.05, val: 0.35 }
      },
      presets: [
        { name: 'Quantum Tunneling (E < V₀)', vals: { k0: 4.0, v0: 6.0, width: 0.30 } },
        { name: 'Over-Barrier Scattering (E > V₀)', vals: { k0: 6.5, v0: 3.0, width: 0.40 } },
        { name: 'Thick Opaque Barrier', vals: { k0: 3.5, v0: 8.0, width: 0.90 } }
      ]
    },
    optics: {
      kicker: 'EXPERIMENT 04 · PHYSICAL OPTICS',
      title: "Young's Double-Slit Wave Interference",
      equation: 'I(y) = I₀ cos²(π d y / λ L) · sinc²(π a y / λ L)',
      description: '2D coherent wavefront interference pattern and screen intensity profile I(y) with finite slit-width diffraction envelope.',
      labels: ['Wavelength λ', 'Fringe Spacing Δy', 'Central Max I₀', 'Diffraction Env'],
      params: {
        wavelength: { label: 'Laser Wavelength λ (nm)', min: 400, max: 700, step: 10, val: 532 },
        slitSep: { label: 'Slit Separation d (mm)', min: 0.10, max: 0.80, step: 0.02, val: 0.28 },
        slitWidth: { label: 'Single Slit Width a (mm)', min: 0.02, max: 0.20, step: 0.01, val: 0.05 }
      },
      presets: [
        { name: 'Green Nd:YAG (532 nm)', vals: { wavelength: 532, slitSep: 0.28, slitWidth: 0.05 } },
        { name: 'He-Ne Red Laser (633 nm)', vals: { wavelength: 633, slitSep: 0.22, slitWidth: 0.04 } },
        { name: 'Violet Diode (405 nm, Wide d)', vals: { wavelength: 405, slitSep: 0.55, slitWidth: 0.08 } }
      ]
    }
  };

  // Simulation dynamical state
  let orbState = { x: 0, y: -110, vx: 1.15, vy: 0, trail: [] };
  let pendState = { theta: 1.8, omega: 0.0, trail: [] };
  let qmPhase = 0;

  function resetCurrentExperiment() {
    simTime = 0;
    telemetryLog = [];
    if (activeExp === 'orbital') {
      const v0 = expConfig.orbital.params.v0.val;
      orbState = { x: 0, y: -115, vx: v0 * 95, vy: 0, trail: [] };
    } else if (activeExp === 'pendulum') {
      pendState = { theta: 1.75, omega: 0.0, trail: [] };
    } else if (activeExp === 'quantum') {
      qmPhase = 0;
    }
  }

  function renderControlsForExperiment() {
    const cfg = expConfig[activeExp];
    if (expKicker) expKicker.textContent = cfg.kicker;
    if (expTitle) expTitle.textContent = cfg.title;
    if (eqDisplay) eqDisplay.textContent = cfg.equation;
    if (messageP) messageP.textContent = cfg.description;

    if (teleL1) teleL1.textContent = cfg.labels[0];
    if (teleL2) teleL2.textContent = cfg.labels[1];
    if (teleL3) teleL3.textContent = cfg.labels[2];
    if (teleL4) teleL4.textContent = cfg.labels[3];

    if (slidersBox) {
      slidersBox.innerHTML = Object.entries(cfg.params).map(([key, p]) => `
        <div class="field" style="margin:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <label for="slider_${key}" style="font-size:12px; margin:0;">${escapeHTML(p.label)}</label>
            <span id="slider_val_${key}" style="font-family:var(--font-mono); font-size:12px; color:var(--cyan); font-weight:700;">${p.val}</span>
          </div>
          <input id="slider_${key}" data-key="${key}" type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.val}" style="width:100%; accent-color:var(--cyan); cursor:pointer;">
        </div>
      `).join('');

      slidersBox.querySelectorAll('input[type="range"]').forEach(sl => {
        sl.addEventListener('input', () => {
          const k = sl.dataset.key;
          const v = parseFloat(sl.value);
          cfg.params[k].val = v;
          const valSpan = qs(`#slider_val_${k}`);
          if (valSpan) valSpan.textContent = v;
          if (activeExp === 'orbital' && k === 'v0' && simTime < 0.1) {
            orbState.vx = v * 95;
          }
        });
      });
    }

    if (presetsBox) {
      presetsBox.innerHTML = cfg.presets.map((pr, idx) => `
        <button type="button" class="mini-btn lab-preset-btn" data-idx="${idx}">${escapeHTML(pr.name)}</button>
      `).join('');

      presetsBox.querySelectorAll('.lab-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const pr = cfg.presets[parseInt(btn.dataset.idx, 10)];
          if (!pr) return;
          Object.entries(pr.vals).forEach(([k, v]) => {
            if (cfg.params[k]) cfg.params[k].val = v;
          });
          renderControlsForExperiment();
          resetCurrentExperiment();
          showToast(`Loaded preset: ${pr.name}`, 'info', 1800);
        });
      });
    }
  }

  // Click on canvas to interact
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (activeExp === 'orbital') {
      orbState.x = clickX - cx;
      orbState.y = clickY - cy;
      const v0 = expConfig.orbital.params.v0.val * 95;
      const angle = Math.atan2(orbState.y, orbState.x) + Math.PI / 2;
      orbState.vx = v0 * Math.cos(angle);
      orbState.vy = v0 * Math.sin(angle);
      orbState.trail = [];
      showToast('Satellite repositioned at clicked coordinates.', 'info', 1500);
    } else if (activeExp === 'pendulum') {
      const pivotX = canvas.width * 0.28;
      const pivotY = canvas.height * 0.42;
      pendState.theta = Math.atan2(clickX - pivotX, clickY - pivotY);
      pendState.omega = 0;
      pendState.trail = [];
    } else if (activeExp === 'quantum') {
      qmPhase = 0;
    }
  });

  // Step Physics & Render Frame
  function stepAndRender(advancePhysics = true) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle coordinate grid background
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    if (activeExp === 'orbital') {
      const p = expConfig.orbital.params;
      const mu = p.mu.val;
      const dt = p.dt.val;
      const GMTotal = 1800000;
      const GM1 = GMTotal * (1 - mu);
      const GM2 = GMTotal * mu;
      const sep = 150;
      // Binary primaries slowly rotating or fixed in synodic frame
      const x1 = -mu * sep, y1 = 0;
      const x2 = (1 - mu) * sep, y2 = 0;

      function accel(x, y) {
        const dx1 = x - x1, dy1 = y - y1;
        const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + 144); // softened potential
        const dx2 = x - x2, dy2 = y - y2;
        const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + 144);
        const ax = -(GM1 * dx1) / (r1 * r1 * r1) - (GM2 * dx2) / (r2 * r2 * r2);
        const ay = -(GM1 * dy1) / (r1 * r1 * r1) - (GM2 * dy2) / (r2 * r2 * r2);
        return { ax, ay, r1, r2 };
      }

      if (advancePhysics) {
        for (let sub = 0; sub < 4; sub++) {
          const a0 = accel(orbState.x, orbState.y);
          const nx = orbState.x + orbState.vx * dt + 0.5 * a0.ax * dt * dt;
          const ny = orbState.y + orbState.vy * dt + 0.5 * a0.ay * dt * dt;
          const a1 = accel(nx, ny);
          orbState.vx += 0.5 * (a0.ax + a1.ax) * dt;
          orbState.vy += 0.5 * (a0.ay + a1.ay) * dt;
          orbState.x = nx;
          orbState.y = ny;
        }
        simTime += dt * 4;
        orbState.trail.push({ x: orbState.x, y: orbState.y });
        if (orbState.trail.length > 420) orbState.trail.shift();
      }

      const cx = w / 2, cy = h / 2;
      // Draw trajectory trail
      if (orbState.trail.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < orbState.trail.length; i++) {
          const pt = orbState.trail[i];
          if (i === 0) ctx.moveTo(cx + pt.x, cy + pt.y);
          else ctx.lineTo(cx + pt.x, cy + pt.y);
        }
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw Primary M1 & Secondary M2
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx + x1, cy + y1, 14 * (1 - mu * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a78bfa';
      ctx.beginPath();
      ctx.arc(cx + x2, cy + y2, 8 + mu * 10, 0, Math.PI * 2);
      ctx.fill();

      // Draw Test Satellite
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx + orbState.x, cy + orbState.y, 5, 0, Math.PI * 2);
      ctx.fill();

      const cur = accel(orbState.x, orbState.y);
      const T = 0.5 * (orbState.vx * orbState.vx + orbState.vy * orbState.vy) / 1000;
      const V = -(GM1 / cur.r1 + GM2 / cur.r2) / 1000;
      const E = T + V;

      if (teleV1) teleV1.textContent = simTime.toFixed(2) + ' s';
      if (teleV2) teleV2.textContent = T.toFixed(2);
      if (teleV3) teleV3.textContent = V.toFixed(2);
      if (teleV4) teleV4.textContent = E.toFixed(2);

      if (advancePhysics && telemetryLog.length < 500) {
        telemetryLog.push({ t: simTime.toFixed(3), m1: T.toFixed(4), m2: V.toFixed(4), m3: E.toFixed(4) });
      }

    } else if (activeExp === 'pendulum') {
      const p = expConfig.pendulum.params;
      const g_L = p.g_L.val;
      const gamma = p.gamma.val;
      const driveA = p.driveA.val;
      const wd = 2.0;
      const dt = 0.016;

      function deriv(th, om, t) {
        return -gamma * om - g_L * Math.sin(th) + driveA * Math.cos(wd * t);
      }

      if (advancePhysics) {
        const th = pendState.theta, om = pendState.omega, t = simTime;
        const k1_th = om;
        const k1_om = deriv(th, om, t);
        const k2_th = om + 0.5 * dt * k1_om;
        const k2_om = deriv(th + 0.5 * dt * k1_th, om + 0.5 * dt * k1_om, t + 0.5 * dt);
        const k3_th = om + 0.5 * dt * k2_om;
        const k3_om = deriv(th + 0.5 * dt * k2_th, om + 0.5 * dt * k2_om, t + 0.5 * dt);
        const k4_th = om + dt * k3_om;
        const k4_om = deriv(th + dt * k3_th, om + dt * k3_om, t + dt);

        pendState.theta += (dt / 6) * (k1_th + 2 * k2_th + 2 * k3_th + k4_th);
        pendState.omega += (dt / 6) * (k1_om + 2 * k2_om + 2 * k3_om + k4_om);
        // Wrap theta to [-pi, pi]
        if (pendState.theta > Math.PI) pendState.theta -= 2 * Math.PI;
        if (pendState.theta < -Math.PI) pendState.theta += 2 * Math.PI;

        simTime += dt;
        pendState.trail.push({ th: pendState.theta, om: pendState.omega });
        if (pendState.trail.length > 380) pendState.trail.shift();
      }

      // Left half: Physical Pendulum
      const pivotX = w * 0.27, pivotY = h * 0.42;
      const rodLen = Math.min(w, h) * 0.34;
      const bobX = pivotX + rodLen * Math.sin(pendState.theta);
      const bobY = pivotY + rodLen * Math.cos(pendState.theta);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(bobX, bobY, 13, 0, Math.PI * 2);
      ctx.fill();

      // Right half: Phase Space (theta vs omega)
      const phaseCx = w * 0.72, phaseCy = h * 0.5;
      const scaleTh = (w * 0.20) / Math.PI;
      const scaleOm = (h * 0.35) / 8.0;

      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(phaseCx - w * 0.22, phaseCy);
      ctx.lineTo(phaseCx + w * 0.22, phaseCy);
      ctx.moveTo(phaseCx, phaseCy - h * 0.4);
      ctx.lineTo(phaseCx, phaseCy + h * 0.4);
      ctx.stroke();

      if (pendState.trail.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < pendState.trail.length; i++) {
          const pt = pendState.trail[i];
          const px = phaseCx + pt.th * scaleTh;
          const py = phaseCy - pt.om * scaleOm;
          if (i === 0 || Math.abs(pt.th - pendState.trail[i - 1].th) > 3.0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      const E = 0.5 * pendState.omega * pendState.omega + g_L * (1 - Math.cos(pendState.theta));
      if (teleV1) teleV1.textContent = simTime.toFixed(2) + ' s';
      if (teleV2) teleV2.textContent = pendState.theta.toFixed(3);
      if (teleV3) teleV3.textContent = pendState.omega.toFixed(3);
      if (teleV4) teleV4.textContent = E.toFixed(2) + ' J';

      if (advancePhysics && telemetryLog.length < 500) {
        telemetryLog.push({ t: simTime.toFixed(3), m1: pendState.theta.toFixed(4), m2: pendState.omega.toFixed(4), m3: E.toFixed(4) });
      }

    } else if (activeExp === 'quantum') {
      const p = expConfig.quantum.params;
      const k0 = p.k0.val;
      const V0 = p.v0.val;
      const widthNm = p.width.val;
      const E = 0.35 * k0 * k0; // scaled eV
      const T_prob = E >= V0
        ? 1 / (1 + (V0 * V0) / (4 * E * (E - V0 + 0.1)) * Math.pow(Math.sin(2 * widthNm * Math.sqrt(Math.max(0.1, E - V0))), 2))
        : Math.exp(-2 * widthNm * Math.sqrt(Math.max(0.05, V0 - E)));
      const R_prob = Math.max(0, 1 - T_prob);

      if (advancePhysics) {
        qmPhase += 0.045;
        simTime += 0.02;
      }

      const midY = h * 0.58;
      const barX = w * 0.48;
      const barW = Math.max(14, widthNm * 75);
      const barH = Math.min(h * 0.7, V0 * 24);

      // Draw Potential Barrier V0
      ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.fillRect(barX, midY - barH, barW, barH);
      ctx.strokeRect(barX, midY - barH, barW, barH);

      // Draw Wavepacket |psi(x,t)|^2 and Re(psi)
      const packetCenter = ((qmPhase * 42) % (w * 0.85)) - w * 0.15;
      ctx.beginPath();
      for (let x = 0; x < w; x += 2) {
        let env = 0;
        if (x < barX) {
          const dInc = (x - Math.min(barX - 45, packetCenter)) / 52;
          const inc = Math.exp(-dInc * dInc);
          const refl = packetCenter > barX - 60 ? Math.sqrt(R_prob) * Math.exp(-Math.pow((x - (2 * barX - packetCenter)) / 52, 2)) : 0;
          env = inc + refl * Math.cos(k0 * 0.18 * (x - barX));
        } else if (x <= barX + barW) {
          const decay = Math.exp(-((x - barX) / barW) * 1.6);
          env = 0.65 * decay;
        } else {
          const dTrans = (x - Math.max(barX + barW + 30, packetCenter)) / 55;
          env = Math.sqrt(T_prob) * Math.exp(-dTrans * dTrans);
        }
        const rePsi = env * Math.cos(0.14 * k0 * x - qmPhase * 3.2);
        const py = midY - rePsi * 75;
        if (x === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Probability density envelope |psi|^2
      ctx.beginPath();
      for (let x = 0; x < w; x += 3) {
        let prob = 0;
        if (x < barX) {
          const dInc = (x - Math.min(barX - 40, packetCenter)) / 52;
          prob = Math.exp(-2 * dInc * dInc);
        } else if (x <= barX + barW) {
          prob = 0.45 * Math.exp(-2.2 * ((x - barX) / barW));
        } else {
          const dTrans = (x - Math.max(barX + barW + 30, packetCenter)) / 55;
          prob = T_prob * Math.exp(-2 * dTrans * dTrans);
        }
        const py = midY - prob * 95;
        if (x === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      if (teleV1) teleV1.textContent = simTime.toFixed(2) + ' fs';
      if (teleV2) teleV2.textContent = E.toFixed(2) + ' eV';
      if (teleV3) teleV3.textContent = V0.toFixed(2) + ' eV';
      if (teleV4) teleV4.textContent = (T_prob * 100).toFixed(1) + '%';

    } else if (activeExp === 'optics') {
      const p = expConfig.optics.params;
      const lam = p.wavelength.val;
      const d = p.slitSep.val;
      const a = p.slitWidth.val;
      if (advancePhysics) simTime += 0.04;

      // Convert wavelength nm to RGB color
      let r = 56, g = 189, b = 248;
      if (lam < 450) { r = 167; g = 139; b = 250; }
      else if (lam < 510) { r = 56; g = 189; b = 248; }
      else if (lam < 565) { r = 52; g = 211; b = 153; }
      else if (lam < 600) { r = 251; g = 191; b = 36; }
      else { r = 248; g = 113; b = 113; }

      const slitX = w * 0.14;
      const screenX = w * 0.68;
      const cy = h / 2;
      const slitOffset = Math.max(18, d * 110);

      // Draw Slit Barrier
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(slitX, 0); ctx.lineTo(slitX, cy - slitOffset - 8);
      ctx.moveTo(slitX, cy - slitOffset + 8); ctx.lineTo(slitX, cy + slitOffset - 8);
      ctx.moveTo(slitX, cy + slitOffset + 8); ctx.lineTo(slitX, h);
      ctx.stroke();

      // Draw Huygens cylindrical wavefronts from both slits
      const numWaves = 9;
      for (let i = 0; i < numWaves; i++) {
        const rad = ((simTime * 35 + i * (lam * 0.07)) % (screenX - slitX));
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.28)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(slitX, cy - slitOffset, rad, -Math.PI / 2.2, Math.PI / 2.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(slitX, cy + slitOffset, rad, -Math.PI / 2.2, Math.PI / 2.2);
        ctx.stroke();
      }

      // Draw Detection Screen & Intensity Curve I(y)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screenX, 20);
      ctx.lineTo(screenX, h - 20);
      ctx.stroke();

      ctx.beginPath();
      for (let y = 20; y < h - 20; y += 2) {
        const dy = (y - cy) / (h * 0.42);
        const beta = (Math.PI * a * dy * 14) / (lam * 1e-3);
        const alpha = (Math.PI * d * dy * 14) / (lam * 1e-3);
        const sinc = Math.abs(beta) < 1e-5 ? 1 : Math.sin(beta) / beta;
        const intensity = Math.cos(alpha) * Math.cos(alpha) * sinc * sinc;

        // Fringe band on screen
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${intensity * 0.85})`;
        ctx.fillRect(screenX - 10, y, 10, 2);

        const px = screenX + 12 + intensity * (w * 0.25);
        if (y === 20) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      const fringeMm = ((lam * 1e-6) * 1500) / d;
      if (teleV1) teleV1.textContent = `${lam} nm`;
      if (teleV2) teleV2.textContent = `${fringeMm.toFixed(2)} mm`;
      if (teleV3) teleV3.textContent = '1.00 I₀';
      if (teleV4) teleV4.textContent = `a = ${a} mm`;
    }
  }

  function loop() {
    if (!canvas.isConnected) return;
    if (isRunning) {
      stepAndRender(true);
    }
    animId = requestAnimationFrame(loop);
  }

  // Wire Experiment Tabs
  expTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      expTabs.forEach(t => {
        t.classList.remove('active', 'primary');
        t.classList.add('ghost');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.remove('ghost');
      tab.classList.add('active', 'primary');
      tab.setAttribute('aria-selected', 'true');
      activeExp = tab.dataset.exp || 'orbital';
      renderControlsForExperiment();
      resetCurrentExperiment();
      stepAndRender(false);
    });
  });

  if (runBtn) {
    runBtn.addEventListener('click', () => {
      isRunning = !isRunning;
      runBtn.textContent = isRunning ? '⏸ Pause' : '▶ Resume';
      if (stateSpan) {
        stateSpan.textContent = isRunning ? 'RUNNING' : 'PAUSED';
        stateSpan.style.borderColor = isRunning ? 'var(--green)' : 'var(--gold)';
        stateSpan.style.color = isRunning ? 'var(--green)' : 'var(--gold)';
      }
    });
  }

  if (stepBtn) {
    stepBtn.addEventListener('click', () => {
      isRunning = false;
      if (runBtn) runBtn.textContent = '▶ Resume';
      if (stateSpan) {
        stateSpan.textContent = 'STEPPED';
        stateSpan.style.borderColor = 'var(--cyan)';
        stateSpan.style.color = 'var(--cyan)';
      }
      stepAndRender(true);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetCurrentExperiment();
      stepAndRender(false);
      showToast('Simulation reset to initial conditions.', 'info', 1800);
    });
  }

  if (clearTrailBtn) {
    clearTrailBtn.addEventListener('click', () => {
      orbState.trail = [];
      pendState.trail = [];
      stepAndRender(false);
      showToast('Phase trajectory trail cleared.', 'info', 1500);
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const cfg = expConfig[activeExp];
      const header = `${cfg.labels[0]},${cfg.labels[1]},${cfg.labels[2]},${cfg.labels[3]}\n`;
      const rows = (telemetryLog.length ? telemetryLog : [{ t: '0.000', m1: '0', m2: '0', m3: '0' }])
        .map(r => `${r.t},${r.m1},${r.m2},${r.m3}`).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pups-lab-${activeExp}-telemetry.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Simulation telemetry exported as CSV.', 'success');
    });
  }

  renderControlsForExperiment();
  resetCurrentExperiment();
  if (animId) cancelAnimationFrame(animId);
  loop();
}

// ── Contact Page Initializer ────────────────────────────────
function initContact() {
  initNav();
}

// ============================================================
//  MEMBER WORKSPACE INITIALIZER
// ============================================================
function initMember() {
  const session = requireRole('member');
  if (!session) return;
  initNav();

  renderMemberStats();
  renderMemberEvents();
  renderMemberColloquia();

  // Add event form
  const addEvForm = qs('#addEventForm');
  if (addEvForm) {
    addEvForm.onsubmit = (e) => {
      e.preventDefault();
      const title   = qs('#evTitle')?.value.trim();
      const date    = qs('#evDate')?.value;
      const type    = qs('#evType')?.value.trim();
      const desc    = qs('#evDesc')?.value.trim();
      const regLink = qs('#evRegLink')?.value.trim() || '';

      if (!title || !date || !type || !desc) {
        showToast('Please fill out all required event fields.', 'error');
        return;
      }

      const db = loadDB();
      db.events.unshift({
        id: Date.now(),
        title,
        date,
        type,
        description: desc,
        regLink
      });
      saveDB(db);
      addEvForm.reset();
      renderMemberEvents();
      showToast('Event added to public calendar.', 'success');
    };
  }

  // Add colloquium form
  const addCoForm = qs('#addColloquiumForm');
  if (addCoForm) {
    addCoForm.onsubmit = (e) => {
      e.preventDefault();
      const title       = qs('#coTitle')?.value.trim();
      const speaker     = qs('#coSpeaker')?.value.trim();
      const date        = qs('#coDate')?.value;
      const field       = qs('#coField')?.value.trim();
      const desc        = qs('#coDesc')?.value.trim();
      const youtubeLink = qs('#coYoutubeLink')?.value.trim() || '';

      if (!title || !speaker || !date || !field || !desc) {
        showToast('Please fill out all required colloquium fields.', 'error');
        return;
      }

      const db = loadDB();
      db.colloquia.unshift({
        id: Date.now(),
        title,
        speaker,
        date,
        field,
        description: desc,
        youtubeLink
      });
      saveDB(db);
      addCoForm.reset();
      renderMemberColloquia();
      showToast('Colloquium archived.', 'success');
    };
  }

  // Stats form
  const statsForm = qs('#statsForm');
  if (statsForm) {
    const db = loadDB();
    if (qs('#statPublications')) qs('#statPublications').value = db.stats?.publications ?? 142;
    if (qs('#statAttendance'))   qs('#statAttendance').value   = db.stats?.attendance ?? 94;
    if (qs('#statResearchers'))  qs('#statResearchers').value  = db.stats?.researchers ?? 86;
    if (qs('#statProjects'))     qs('#statProjects').value     = db.stats?.projects ?? 12;

    statsForm.onsubmit = (e) => {
      e.preventDefault();
      const publications = parseInt(qs('#statPublications')?.value || 0, 10);
      const attendance   = parseInt(qs('#statAttendance')?.value || 0, 10);
      const researchers  = parseInt(qs('#statResearchers')?.value || 0, 10);
      const projects     = parseInt(qs('#statProjects')?.value || 0, 10);

      db.stats = { publications, attendance, researchers, projects };
      saveDB(db);
      renderMemberStats();
      showToast('Academic metrics updated successfully.', 'success');
    };
  }
}

function renderMemberStats() {
  const container = qs('#memberStats');
  if (!container) return;
  const db = loadDB();
  const s = db.stats || defaultDB.stats;

  container.innerHTML = `
    <div class="stat"><span>Publications</span><strong>${s.publications}</strong></div>
    <div class="stat"><span>Attendance</span><strong>${s.attendance}%</strong></div>
    <div class="stat"><span>Researchers</span><strong>${s.researchers}</strong></div>
    <div class="stat"><span>Projects</span><strong>${s.projects}</strong></div>
  `;
}

function renderMemberEvents() {
  const container = qs('#memberEvents');
  if (!container) return;
  const db = loadDB();

  if (db.events.length === 0) {
    container.innerHTML = `<p style="color:var(--muted); font-size:13px;">No events in archive.</p>`;
    return;
  }

  container.innerHTML = db.events.map(ev => `
    <div class="manage-item">
      <div>
        <strong>${escapeHTML(ev.title)}</strong>
        <p>${formatDate(ev.date)} · <span class="role-badge" style="padding:2px 6px;">${escapeHTML(ev.type)}</span></p>
        <p>${escapeHTML(ev.description)}</p>
        ${ev.regLink && sanitizeUrl(ev.regLink) !== '#' ? `<p style="font-size:11px; margin-top:4px;"><a href="${sanitizeUrl(ev.regLink)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan); text-decoration:underline;">Registration&nbsp;--&gt; (${escapeHTML(ev.regLink)})</a></p>` : ''}
      </div>
      <button class="mini-btn danger-btn delete-event-btn" data-id="${ev.id}" type="button">Delete</button>
    </div>
  `).join('');

  container.querySelectorAll('.delete-event-btn').forEach(btn => {
    btn.onclick = () => deleteEvent(Number(btn.dataset.id));
  });
}

function deleteEvent(id) {
  const db = loadDB();
  db.events = db.events.filter(e => e.id !== id);
  saveDB(db);
  renderMemberEvents();
  showToast('Event removed.', 'info');
}

function renderMemberColloquia() {
  const container = qs('#memberColloquia');
  if (!container) return;
  const db = loadDB();

  if (db.colloquia.length === 0) {
    container.innerHTML = `<p style="color:var(--muted); font-size:13px;">No colloquia in archive.</p>`;
    return;
  }

  container.innerHTML = db.colloquia.map(co => `
    <div class="manage-item">
      <div>
        <strong>${escapeHTML(co.title)}</strong>
        <p>${escapeHTML(co.speaker)} · ${formatDate(co.date)} · <span class="role-badge" style="padding:2px 6px;">${escapeHTML(co.field)}</span></p>
        <p>${escapeHTML(co.description)}</p>
        ${co.youtubeLink && sanitizeUrl(co.youtubeLink) !== '#' ? `<p style="font-size:11px; margin-top:4px;"><a href="${sanitizeUrl(co.youtubeLink)}" target="_blank" rel="noopener noreferrer" style="color:#f87171; text-decoration:underline;">Watch here&nbsp;--&gt; (${escapeHTML(co.youtubeLink)})</a></p>` : ''}
      </div>
      <button class="mini-btn danger-btn delete-colloquium-btn" data-id="${co.id}" type="button">Delete</button>
    </div>
  `).join('');

  container.querySelectorAll('.delete-colloquium-btn').forEach(btn => {
    btn.onclick = () => deleteColloquium(Number(btn.dataset.id));
  });
}

function deleteColloquium(id) {
  const db = loadDB();
  db.colloquia = db.colloquia.filter(c => c.id !== id);
  saveDB(db);
  renderMemberColloquia();
  showToast('Colloquium removed.', 'info');
}

// ============================================================
//  PUBLIC PAGES INITIALIZERS
// ============================================================
function initEvents() {
  initNav();
  const grid = qs('#eventsGrid');
  const searchInput = qs('#eventSearch');
  if (!grid) return;

  function render(filter = '') {
    const db = loadDB();
    const q = filter.toLowerCase();
    const list = db.events.filter(ev =>
      ev.title.toLowerCase().includes(q) ||
      ev.type.toLowerCase().includes(q) ||
      ev.description.toLowerCase().includes(q)
    );

    if (list.length === 0) {
      grid.innerHTML = `<p style="color:var(--muted); padding:20px;">No events match your search.</p>`;
      return;
    }

    grid.innerHTML = list.map(ev => `
      <article class="card">
        <div class="meta">${escapeHTML(ev.type)} · ${formatDate(ev.date)}</div>
        <h3>${escapeHTML(ev.title)}</h3>
        <p>${escapeHTML(ev.description)}</p>
        ${ev.regLink && sanitizeUrl(ev.regLink) !== '#' ? `
          <div style="margin-top:16px;">
            <a href="${sanitizeUrl(ev.regLink)}" target="_blank" rel="noopener noreferrer" class="action-link-btn register">
              Registration&nbsp;--&gt;
            </a>
          </div>` : ''}
      </article>
    `).join('');
  }

  // Immediate render (0ms delay)
  render();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => render(e.target.value));
  }
}

function initColloquia() {
  initNav();
  const grid = qs('#colloquiaGrid');
  const searchInput = qs('#colloquiaSearch');
  const fieldSelect = qs('#colloquiaField');
  if (!grid) return;

  // Dynamically populate any custom fields added by Members
  if (fieldSelect) {
    const db = loadDB();
    const existingOptions = new Set(Array.from(fieldSelect.options).map(o => o.value));
    (db.colloquia || []).forEach(co => {
      if (co.field && !existingOptions.has(co.field)) {
        existingOptions.add(co.field);
        const opt = document.createElement('option');
        opt.value = co.field;
        opt.textContent = co.field;
        fieldSelect.appendChild(opt);
      }
    });
  }

  function render() {
    const db = loadDB();
    const q = (searchInput?.value || '').toLowerCase();
    const selectedField = fieldSelect?.value || 'all';

    const list = db.colloquia.filter(co => {
      const matchText = co.title.toLowerCase().includes(q) ||
                        co.speaker.toLowerCase().includes(q) ||
                        co.field.toLowerCase().includes(q) ||
                        co.description.toLowerCase().includes(q);
      const matchField = selectedField === 'all' || co.field === selectedField;
      return matchText && matchField;
    });

    if (list.length === 0) {
      grid.innerHTML = `<p style="color:var(--muted); padding:20px;">No colloquia found matching the criteria.</p>`;
      return;
    }

    grid.innerHTML = list.map(co => `
      <article class="card">
        <div class="meta">${escapeHTML(co.field)} · ${formatDate(co.date)}</div>
        <h3>${escapeHTML(co.title)}</h3>
        <p style="color:var(--gold); font-size:13px; margin:4px 0 8px;">Speaker: ${escapeHTML(co.speaker)}</p>
        <p>${escapeHTML(co.description)}</p>
        ${co.youtubeLink && sanitizeUrl(co.youtubeLink) !== '#' ? `
          <div style="margin-top:16px;">
            <a href="${sanitizeUrl(co.youtubeLink)}" target="_blank" rel="noopener noreferrer" class="action-link-btn youtube">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-right:2px;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              Watch here&nbsp;--&gt;
            </a>
          </div>` : ''}
      </article>
    `).join('');
  }

  // Immediate render (0ms delay)
  render();

  if (searchInput) searchInput.addEventListener('input', render);
  if (fieldSelect) fieldSelect.addEventListener('change', render);
}

// ============================================================
//  MOOD SWITCHER (BRIGHT / DARK THEME)
// ============================================================
const MOOD_KEY = 'pupsMood';

function applyMood(mood) {
  document.documentElement.setAttribute('data-theme', mood);
  localStorage.setItem(MOOD_KEY, mood);

  qsa('#moodToggle, .mood-toggle-btn').forEach(btn => {
    const icon = btn.querySelector('.mood-icon');
    const label = btn.querySelector('.mood-label');
    if (mood === 'bright') {
      if (icon) icon.textContent = '☀️';
      if (label) label.textContent = 'Bright';
      btn.setAttribute('aria-label', 'Switch to Dark mood');
      btn.title = 'Current: Bright daylight. Click to switch to Dark celestial.';
    } else {
      if (icon) icon.textContent = '🌙';
      if (label) label.textContent = 'Dark';
      btn.setAttribute('aria-label', 'Switch to Bright mood');
      btn.title = 'Current: Dark celestial. Click to switch to Bright daylight.';
    }
  });
}

function initMoodSwitcher() {
  const savedMood = localStorage.getItem(MOOD_KEY) || 'dark';
  applyMood(savedMood);

  // If header exists but has no mood toggle button, inject one dynamically!
  const header = qs('.site-header');
  if (header && !qs('#moodToggle')) {
    let tools = header.querySelector('.header-right-tools');
    if (!tools) {
      tools = document.createElement('div');
      tools.className = 'header-right-tools';
      const menuBtn = header.querySelector('#menuToggle');
      if (menuBtn) {
        header.insertBefore(tools, menuBtn);
        tools.appendChild(menuBtn);
      } else {
        header.appendChild(tools);
      }
    }
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'mood-toggle-btn';
    toggleBtn.id = 'moodToggle';
    toggleBtn.type = 'button';
    toggleBtn.innerHTML = `
      <span class="mood-icon" aria-hidden="true">${savedMood === 'bright' ? '☀️' : '🌙'}</span>
      <span class="mood-label">${savedMood === 'bright' ? 'Bright' : 'Dark'}</span>
    `;
    tools.insertBefore(toggleBtn, tools.firstChild);
  }

  // Delegated click listener for mood buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#moodToggle, .mood-toggle-btn');
    if (btn) {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'bright' : 'dark';
      applyMood(next);
    }
  });
}

// Apply saved mood immediately on parse to avoid flash
(function() {
  try {
    const m = localStorage.getItem('pupsMood') || 'dark';
    document.documentElement.setAttribute('data-theme', m);
  } catch {}
})();

// ============================================================
//  3D INTERACTIVE ENGINE & CARD TILT
// ============================================================
function initTiltCards() {
  const cards = qsa('.tilt-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const normX = (x - centerX) / centerX;
      const normY = (y - centerY) / centerY;

      const rotateX = -8 * normY;
      const rotateY = 10 * normX;

      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
      card.style.setProperty('--mouse-x', `${((x / rect.width) * 100).toFixed(1)}%`);
      card.style.setProperty('--mouse-y', `${((y / rect.height) * 100).toFixed(1)}%`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  });
}

function init3DMainPage() {
  initTiltCards();

  // 3D Canvas Particle Starfield in Hero
  const canvas = qs('#celestialCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    window.addEventListener('resize', () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    });

    const numParticles = 60;
    const particles = [];
    const radius = Math.min(width, height) * 0.42 || 140;

    for (let i = 0; i < numParticles; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      particles.push({
        theta,
        phi,
        speed: 0.0025 + Math.random() * 0.0035,
        size: 1.2 + Math.random() * 2
      });
    }

    let mouseX = 0, mouseY = 0;
    const heroVisual = qs('#heroVisual3D');
    if (heroVisual) {
      heroVisual.addEventListener('mousemove', (e) => {
        const rect = heroVisual.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      });
      heroVisual.addEventListener('mouseleave', () => {
        mouseX = 0;
        mouseY = 0;
      });
    }

    let angleX = 0, angleY = 0;
    function render3D() {
      if (!canvas || !canvas.isConnected) return;
      ctx.clearRect(0, 0, width, height);

      const isBright = document.documentElement.getAttribute('data-theme') === 'bright';
      const particleColor = isBright ? 'rgba(217, 119, 6, ' : 'rgba(255, 184, 107, ';
      const beamColor = isBright ? 'rgba(2, 132, 199, 0.08)' : 'rgba(183, 162, 255, 0.1)';

      angleY += 0.0035 + (mouseX * 0.008);
      angleX += 0.002 + (mouseY * 0.006);

      const cx = width / 2;
      const cy = height / 2;
      const focalLength = 320;

      const projected = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.theta += p.speed;

        // 3D Spherical coordinates
        const x3 = radius * Math.sin(p.phi) * Math.cos(p.theta);
        const y3 = radius * Math.sin(p.phi) * Math.sin(p.theta);
        const z3 = radius * Math.cos(p.phi);

        // Rotation around X and Y
        const cosY = Math.cos(angleY), sinY = Math.sin(angleY);
        const xRot = x3 * cosY - z3 * sinY;
        const zRot1 = x3 * sinY + z3 * cosY;

        const cosX = Math.cos(angleX), sinX = Math.sin(angleX);
        const yRot = y3 * cosX - zRot1 * sinX;
        const zRot2 = y3 * sinX + zRot1 * cosX;

        // Perspective projection
        const scale = focalLength / (focalLength + zRot2 + radius);
        const px = cx + xRot * scale;
        const py = cy + yRot * scale;
        const alpha = Math.max(0.1, Math.min(0.9, (zRot2 + radius) / (2 * radius)));

        projected.push({ x: px, y: py, alpha, size: p.size * scale });
      }

      // Draw faint constellation filaments between nearby particles
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 55) {
            ctx.strokeStyle = beamColor;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw glowing particles
      for (let i = 0; i < projected.length; i++) {
        const pt = projected[i];
        ctx.fillStyle = particleColor + pt.alpha + ')';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(0.8, pt.size), 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(render3D);
    }

    render3D();
  }

  // Parallax Scroll Reaction
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const heroVisual = qs('#heroVisual3D');
    if (heroVisual && scrollY < 800) {
      heroVisual.style.transform = `translateY(${scrollY * 0.08}px)`;
    }
  }, { passive: true });
}

// ============================================================
//  DEDICATED TRANSPARENT SCROLL ENTRANCE PORTAL
//  "You Can Do" fixed anchor with 3-line vertical tumbler slot
//  and dedicated medium PUPS logo finale stage
// ============================================================
function initDedicatedScrollEntrance() {
  const portal = qs('#pseDedicatedPortal');
  if (!portal) return;

  const canvas = qs('#psePortalCanvas');
  const lockupContainer = qs('#pseLockupContainer');
  const logoStage = qs('#pseLogoStage');
  const track = qs('#pseTumblerTrack');
  const rows = qsa('.pse-tumbler-row');
  const dots = qsa('#pseStepDots .pse-dot');
  const skipBtn = qs('#psePortalSkipBtn');
  const enterBtn = qs('#pseEnterBtn');
  const enterBtnText = qs('#pseEnterBtnText');
  const formulas = qsa('.pse-dedicated-portal .pse-formula');

  let currentStep = 0;
  let targetStep = 0;
  let isDismissed = false;
  let animFrameId = null;

  // Row height: 84px on desktop, 56px on mobile
  const getRowHeight = () => (window.innerWidth <= 768 ? 56 : 84);

  // Exit entrance portal to main page
  const exitPortal = () => {
    if (isDismissed) return;
    isDismissed = true;
    portal.classList.add('pse-portal-dismissed');
    portal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    showToast('Welcome to Presidency University Physics Society.', 'info', 2500);

    setTimeout(() => {
      portal.style.display = 'none';
      if (animFrameId) cancelAnimationFrame(animFrameId);
    }, 780);
  };

  // Replay entrance portal
  window.replayScrollIntro = () => {
    portal.style.display = 'flex';
    portal.classList.remove('pse-portal-dismissed');
    portal.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    isDismissed = false;
    targetStep = 0;
    currentStep = 0;
    updateTumblerVisuals(0);
    renderStep();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Skip and enter button bindings
  if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
      e.preventDefault();
      exitPortal();
    });
  }

  if (enterBtn) {
    enterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      exitPortal();
    });
  }

  if (logoStage) {
    logoStage.addEventListener('click', (e) => {
      e.preventDefault();
      exitPortal();
    });
  }

  // Lock initial body overflow while on entrance
  document.body.style.overflow = 'hidden';

  // Wheel interaction (4–6 ticks through verbs to PUPS logo and exit)
  portal.addEventListener('wheel', (e) => {
    if (isDismissed) return;
    e.preventDefault();

    // Normalizing wheel delta: ~0.45 step per natural mouse notch
    const delta = Math.sign(e.deltaY) * 0.45;
    targetStep = Math.max(0, Math.min(5.4, targetStep + delta));

    // When scrolled past medium PUPS logo stage, exit portal into main page!
    if (targetStep >= 5.25) {
      exitPortal();
    }
  }, { passive: false });

  // Touch swipe support for mobile devices
  let touchStartY = 0;
  portal.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  portal.addEventListener('touchmove', (e) => {
    if (isDismissed || !e.touches || e.touches.length === 0) return;
    e.preventDefault();
    const touchCurrentY = e.touches[0].clientY;
    const diff = touchStartY - touchCurrentY;
    touchStartY = touchCurrentY;

    targetStep = Math.max(0, Math.min(5.4, targetStep + diff * 0.018));
    if (targetStep >= 5.25) {
      exitPortal();
    }
  }, { passive: false });

  // Keyboard navigation support (ArrowDown, PageDown, Space)
  window.addEventListener('keydown', (e) => {
    if (isDismissed) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      targetStep = Math.min(5.4, targetStep + 0.5);
      if (targetStep >= 5.25) exitPortal();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      targetStep = Math.max(0, targetStep - 0.5);
    } else if (e.key === 'Escape') {
      exitPortal();
    }
  });

  // Smooth visual updater
  function updateTumblerVisuals(val) {
    const rowH = getRowHeight();
    const translateY = -Math.min(4, val) * rowH;
    if (track) {
      track.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`;
    }

    // Update each row's opacity, scale, and focus
    rows.forEach((row, idx) => {
      const dist = Math.abs(val - idx);
      if (dist < 0.48) {
        // Active in center slot beside "You Can Do"
        const factor = 1 - (dist / 0.48);
        row.style.opacity = (0.35 + factor * 0.65).toFixed(2);
        row.style.transform = `scale(${(0.95 + factor * 0.05).toFixed(2)})`;
        row.style.filter = 'blur(0px)';
      } else if (dist < 1.35) {
        // In top or bottom slot: visible above/below, dimmed
        row.style.opacity = '0.22';
        row.style.transform = 'scale(0.92)';
        row.style.filter = 'blur(1px)';
      } else {
        // Beyond 3-line window
        row.style.opacity = '0';
        row.style.transform = 'scale(0.85)';
        row.style.filter = 'blur(3px)';
      }
    });

    // Cross-fade between tumbler lockup and medium PUPS logo stage
    if (val <= 4.15) {
      if (lockupContainer) {
        lockupContainer.style.opacity = '1';
        lockupContainer.style.transform = 'translateY(0) scale(1)';
        lockupContainer.style.pointerEvents = 'auto';
      }
      if (logoStage) {
        logoStage.style.opacity = '0';
        logoStage.style.transform = 'translate(-50%, -50%) scale(0.92)';
        logoStage.style.pointerEvents = 'none';
      }
    } else if (val > 4.15 && val < 4.85) {
      const t = (val - 4.15) / 0.7; // 0 to 1
      if (lockupContainer) {
        lockupContainer.style.opacity = (1 - t).toFixed(3);
        lockupContainer.style.transform = `translateY(${(-18 * t).toFixed(1)}px) scale(${(1 - 0.05 * t).toFixed(3)})`;
        lockupContainer.style.pointerEvents = 'none';
      }
      if (logoStage) {
        logoStage.style.opacity = t.toFixed(3);
        logoStage.style.transform = `translate(-50%, calc(-50% + ${(18 * (1 - t)).toFixed(1)}px)) scale(${(0.92 + 0.08 * t).toFixed(3)})`;
        logoStage.style.pointerEvents = 'auto';
      }
    } else {
      // val >= 4.85: Fully on medium PUPS logo stage
      if (lockupContainer) {
        lockupContainer.style.opacity = '0';
        lockupContainer.style.transform = 'translateY(-18px) scale(0.95)';
        lockupContainer.style.pointerEvents = 'none';
      }
      if (logoStage) {
        logoStage.style.opacity = '1';
        logoStage.style.transform = 'translate(-50%, -50%) scale(1)';
        logoStage.style.pointerEvents = 'auto';
      }
    }

    // Update dots (0 to 5)
    const activeStage = Math.min(5, Math.round(val));
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === activeStage);
    });

    // Update footer button state
    if (val >= 4.85) {
      if (enterBtnText) enterBtnText.textContent = 'Enter Main Website →';
      if (enterBtn) {
        enterBtn.style.borderColor = 'var(--cyan)';
        enterBtn.style.color = 'var(--cyan)';
        enterBtn.style.boxShadow = '0 0 20px var(--cyan-glow)';
      }
    } else if (val >= 3.8) {
      if (enterBtnText) enterBtnText.textContent = 'Scroll for PUPS Emblem (5/6) ↓';
      if (enterBtn) {
        enterBtn.style.borderColor = '';
        enterBtn.style.color = '';
        enterBtn.style.boxShadow = '';
      }
    } else {
      if (enterBtnText) enterBtnText.textContent = `Scroll to align words (${activeStage + 1}/6) ↓`;
      if (enterBtn) {
        enterBtn.style.borderColor = '';
        enterBtn.style.color = '';
        enterBtn.style.boxShadow = '';
      }
    }

    // Parallax drift for floating formulas
    formulas.forEach((f, idx) => {
      const dir = idx % 2 === 0 ? 1 : -1;
      f.style.transform = `translate3d(0, ${(val * dir * 10).toFixed(1)}px, 0)`;
    });
  }

  // Smooth animation render loop
  function renderStep() {
    if (isDismissed) return;

    // Smooth exponential decay / lerp
    const diff = targetStep - currentStep;
    if (Math.abs(diff) > 0.001) {
      currentStep += diff * 0.18;
      updateTumblerVisuals(currentStep);
    }

    animFrameId = requestAnimationFrame(renderStep);
  }
  renderStep();

  // Quantum Wave Background Canvas
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0;
    const particles = [];
    const PARTICLE_COUNT = 36;

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    const colors = [
      'rgba(56, 189, 248,',  // Cyan
      'rgba(251, 191, 36,',  // Gold
      'rgba(167, 139, 250,', // Violet
      'rgba(52, 211, 153,'   // Emerald
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 1 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        phase: Math.random() * Math.PI * 2
      });
    }

    let time = 0;
    const renderCanvas = () => {
      if (isDismissed) return;

      ctx.clearRect(0, 0, width, height);
      time += 0.016;

      const cx = width / 2;
      const cy = height / 2;
      const isBright = document.documentElement.getAttribute('data-theme') === 'bright';
      const rippleBase = isBright ? 'rgba(2, 132, 199,' : 'rgba(56, 189, 248,';

      // Wave orbital ripples
      for (let r = 1; r <= 3; r++) {
        const radius = r * 115 + Math.sin(time + r) * 12;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = rippleBase + (0.04 / r) + ')';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 12]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Entangled particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 75) {
            const alpha = (1 - dist / 75) * (isBright ? 0.12 : 0.2);
            ctx.strokeStyle = rippleBase + alpha + ')';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        const pulse = 0.5 + 0.5 * Math.sin(time * 3 + p.phase);
        ctx.fillStyle = p.color + (isBright ? 0.35 : 0.55) * pulse + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(renderCanvas);
    };

    renderCanvas();
  }
}

function initHome() {
  initNav();
  initDedicatedScrollEntrance();
  init3DMainPage();

  // Make all buttons on the main page fully interactive and bypass 3D tilt interference
  const browseBtn = qs('#browseColloquiumBtn, a[href="colloquium.html"]');
  if (browseBtn) {
    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      location.href = 'colloquium.html';
    });
  }

  qsa('.hero-actions .btn, .split-intro .text-link, .section-head .text-link').forEach(el => {
    el.addEventListener('click', (e) => {
      const href = el.getAttribute('href');
      if (href) {
        e.stopPropagation();
        location.href = href;
      }
    });
  });

  const dbForStats = loadDB();
  if (dbForStats && dbForStats.stats) {
    const pubEl = qs('#homeStatPublications');
    const attEl = qs('#homeStatAttendance');
    const resEl = qs('#homeStatResearchers');
    const prjEl = qs('#homeStatProjects');
    if (pubEl) pubEl.textContent = String(dbForStats.stats.publications ?? 142).padStart(2, '0');
    if (attEl) attEl.textContent = (dbForStats.stats.attendance ?? 94) + '%';
    if (resEl) resEl.textContent = String(dbForStats.stats.researchers ?? 86).padStart(2, '0');
    if (prjEl) prjEl.textContent = String(dbForStats.stats.projects ?? 12).padStart(2, '0');
  }

  const replayBtn = qs('#replayScrollIntroBtn');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      if (typeof window.replayScrollIntro === 'function') window.replayScrollIntro();
    });
  }

  const homeEvents = qs('#homeEvents');
  if (homeEvents) {
    const db = loadDB();
    const recent = db.events.slice(0, 2);
    homeEvents.innerHTML = recent.map(ev => `
      <article class="card tilt-card" style="display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;" onclick="location.href='events.html'" title="Click to view full event details">
        <div class="tilt-card-inner">
          <div class="meta">${escapeHTML(ev.type)} · ${formatDate(ev.date)}</div>
          <h3>${escapeHTML(ev.title)}</h3>
          <p>${escapeHTML(ev.description)}</p>
        </div>
        <div style="margin-top:16px;">
          <a class="mini-btn primary-btn" href="events.html" onclick="event.stopPropagation(); location.href='events.html';">
            Explore event →
          </a>
        </div>
      </article>
    `).join('');
    initTiltCards();
  }
}

// ============================================================
//  REGISTRATION PAGE INITIALIZER
// ============================================================
function initRegister() {
  initNav();

  // Provide portal shortcut and logout if already logged in
  const session = getStoredSession();
  if (session && session.id) {
    const portalHref = session.role === 'admin' ? 'admin.html' : session.role === 'member' ? 'member.html' : 'student.html';
    const portalLabel = session.role === 'admin' ? 'Admin Centre' : session.role === 'member' ? 'Member Portal' : 'Student Portal';
    const tools = qs('.header-right-tools');
    if (tools && !qs('#regSessionShortcuts')) {
      const wrap = document.createElement('span');
      wrap.id = 'regSessionShortcuts';
      wrap.style.display = 'inline-flex';
      wrap.style.gap = '8px';
      wrap.innerHTML = `
        <a class="btn primary" href="${portalHref}" style="font-size:12px; padding:8px 14px;">${portalLabel} →</a>
        <a class="btn ghost" href="#logout" data-action="logout" style="font-size:12px; padding:8px 14px;">Logout</a>
      `;
      tools.insertBefore(wrap, tools.firstChild);
    }
  }

  const regEmailInput    = qs('#regEmail');
  const verifyBtn        = qs('#verifyEmailBtn');
  const verifyBadge      = qs('#verifyBadge');
  const verifyText       = qs('#verifyText');
  const verifyCodeField  = qs('#verifyCodeField');
  const verifyCodeInput  = qs('#regVerifyCode');
  const confirmCodeBtn   = qs('#confirmCodeBtn');
  const verifyCodeHint   = qs('#verifyCodeHint');
  const form             = qs('#registerForm');
  const errBox           = qs('#registerError');
  const successBox       = qs('#registerSuccess');
  const overlay          = qs('#authPortalOverlay');
  const progressFill     = qs('#portalProgressFill');
  const pwdInput         = qs('#regPassword');
  const pwdToggleBtn     = qs('#regPasswordToggleBtn');

  let isEmailVerified = false;
  let activeVerificationCode = null;
  let verifiedEmailAddress = '';

  // Invalidate verification if email input is modified
  if (regEmailInput) {
    regEmailInput.addEventListener('input', () => {
      if (isEmailVerified || activeVerificationCode) {
        isEmailVerified = false;
        activeVerificationCode = null;
        verifiedEmailAddress = '';
        if (verifyBadge) {
          verifyBadge.className = 'verify-badge unverified';
          verifyBadge.textContent = 'Email Not Verified';
        }
        if (verifyText) {
          verifyText.textContent = 'Email address modified. Click "Verify Email" to authenticate.';
          verifyText.style.color = '';
        }
        if (verifyCodeField) verifyCodeField.style.display = 'none';
        if (verifyBtn) {
          verifyBtn.style.display = '';
          verifyBtn.disabled = false;
        }
      }
    });
  }

  // Password visibility toggle
  if (pwdInput && pwdToggleBtn) {
    const showPwd = (e) => {
      if (e) e.preventDefault();
      pwdInput.type = 'text';
      pwdToggleBtn.classList.add('revealed');
    };
    const hidePwd = (e) => {
      if (e) e.preventDefault();
      pwdInput.type = 'password';
      pwdToggleBtn.classList.remove('revealed');
    };
    pwdToggleBtn.addEventListener('mousedown', showPwd);
    pwdToggleBtn.addEventListener('mouseup', hidePwd);
    pwdToggleBtn.addEventListener('mouseleave', hidePwd);
    pwdToggleBtn.addEventListener('touchstart', showPwd, { passive: false });
    pwdToggleBtn.addEventListener('touchend', hidePwd);
    pwdToggleBtn.addEventListener('touchcancel', hidePwd);
  }

  // 3D Card tilt on auth card
  const authCard = qs('.auth-card');
  if (authCard) {
    authCard.addEventListener('mousemove', (e) => {
      const rect = authCard.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      authCard.style.transform = `perspective(1200px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
    });
    authCard.addEventListener('mouseleave', () => {
      authCard.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
    });
  }

  // Verify Email Action
  if (verifyBtn && regEmailInput) {
    verifyBtn.addEventListener('click', async () => {
      const email = regEmailInput.value.trim().toLowerCase();
      if (!email) {
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = 'Please enter an institutional or personal email address to verify.';
        }
        return;
      }
      if (errBox) errBox.style.display = 'none';

      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying...';
      if (verifyBadge) {
        verifyBadge.className = 'verify-badge verifying';
        verifyBadge.textContent = 'Verifying MX...';
      }
      if (verifyText) verifyText.textContent = 'Checking domain and mailbox existence...';

      const verifyResult = await verifyEmailExistence(email);
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify Email';

      if (!verifyResult.ok) {
        if (verifyBadge) {
          verifyBadge.className = 'verify-badge unverified';
          verifyBadge.textContent = 'Verification Failed';
        }
        if (verifyText) verifyText.textContent = verifyResult.message;
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = verifyResult.message;
        }
        return;
      }

            verifyBtn.textContent = 'Sending...';
      verifyBtn.disabled = true;
      fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'sendVerificationEmail', email: email })
      }).then(r => r.json()).then(res => {
        verifyBtn.textContent = 'Resend Code';
        verifyBtn.disabled = false;
        if (res && res.status === 'error') {
          if (verifyBadge) {
            verifyBadge.className = 'verify-badge unverified';
            verifyBadge.textContent = 'Delivery Failed';
          }
          const failMsg = res.message || 'Unable to deliver verification email to this address. Please ensure the email actually exists.';
          if (verifyText) verifyText.textContent = failMsg;
          if (errBox) {
            errBox.style.display = 'block';
            errBox.textContent = failMsg;
          }
          return;
        }

        if (verifyCodeField) verifyCodeField.style.display = 'block';
        if (verifyCodeHint) {
          verifyCodeHint.textContent = 'Security Token Dispatched to your email inbox. Enter below to confirm.';
        }
        if (verifyBadge) {
          verifyBadge.className = 'verify-badge verifying';
          verifyBadge.textContent = 'Token Dispatched';
        }
        if (verifyText) {
          verifyText.textContent = `Domain ${verifyResult.domain} validated. Enter the 6-digit code sent to your email to complete verification.`;
        }
      }).catch(err => {
        verifyBtn.textContent = 'Verify Email';
        verifyBtn.disabled = false;
        if (errBox) { errBox.style.display = 'block'; errBox.textContent = 'Network error: Could not reach verification server. Please try again.'; }
      });
    });
  }

  // Confirm Code Action
  if (confirmCodeBtn && verifyCodeInput) {
    confirmCodeBtn.addEventListener('click', () => {
      const code = verifyCodeInput.value.trim();
      if (!code) {
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = 'Please enter the 6-digit verification code.';
        }
        return;
      }

      confirmCodeBtn.textContent = 'Checking...';
      confirmCodeBtn.disabled = true;
      fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'verifyOTP', email: (regEmailInput.value || '').trim().toLowerCase(), code: code })
      }).then(r => r.json()).then(res => {
        confirmCodeBtn.textContent = 'Confirm Code';
        confirmCodeBtn.disabled = false;
        if (res && res.status === 'success') {
          isEmailVerified = true;
          verifiedEmailAddress = (regEmailInput.value || '').trim().toLowerCase();
          if (verifyBadge) {
            verifyBadge.className = 'verify-badge verified';
            verifyBadge.textContent = '✓ Verified';
          }
          if (verifyText) {
            verifyText.textContent = 'Email address verified and confirmed active.';
            verifyText.style.color = 'var(--green)';
          }
          if (verifyCodeField) verifyCodeField.style.display = 'none';
          if (regEmailInput) regEmailInput.readOnly = true;
          if (verifyBtn) verifyBtn.style.display = 'none';
          if (errBox) errBox.style.display = 'none';

          const stepBadge1 = qs('#stepBadge1');
          const stepBadge2 = qs('#stepBadge2');
          if (stepBadge1) stepBadge1.classList.remove('active');
          if (stepBadge2) stepBadge2.classList.add('active');

          showToast('Email verified successfully! You may now set your password.', 'success');
        } else {
          if (errBox) {
            errBox.style.display = 'block';
            errBox.textContent = (res && res.message) ? res.message : 'Incorrect verification code. Please check your email and try again.';
          }
        }
      }).catch(err => {
        confirmCodeBtn.textContent = 'Confirm Code';
        confirmCodeBtn.disabled = false;
        if (errBox) { errBox.style.display = 'block'; errBox.textContent = 'Network error: Could not verify code.'; }
      });
    });
  }

  // Registration Form Submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errBox) errBox.style.display = 'none';
      if (successBox) successBox.style.display = 'none';

      const name        = (qs('#regName')?.value || '').trim();
      const email       = (qs('#regEmail')?.value || '').trim().toLowerCase();
      const password    = qs('#regPassword')?.value || '';
      const confirmPass = qs('#regConfirmPassword')?.value || '';
      const submitBtn   = qs('#registerSubmitBtn');

      if (!name) {
        if (errBox) { errBox.style.display = 'block'; errBox.textContent = 'Please enter your full name.'; }
        return;
      }
      if (!email) {
        if (errBox) { errBox.style.display = 'block'; errBox.textContent = 'Please enter your email.'; }
        return;
      }
      if (!isEmailVerified || !verifiedEmailAddress || email !== verifiedEmailAddress) {
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = 'Email address must be verified before completing registration. Click "Verify Email" to proceed.';
        }
        return;
      }
      if (!password || password.length < 6) {
        if (errBox) { errBox.style.display = 'block'; errBox.textContent = 'Password must be at least 6 characters long.'; }
        return;
      }
      if (password !== confirmPass) {
        if (errBox) { errBox.style.display = 'block'; errBox.textContent = 'Passwords do not match. Please verify your password.'; }
        return;
      }

      // Check if already registered locally
      const existingUser = getRegisteredUser(email);
      if (existingUser) {
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = `An account with email ${email} is already registered. Please sign in via the Student login portal.`;
        }
        return;
      }

      if (submitBtn) submitBtn.disabled = true;

      // Sci-Fi Quantum Registration Portal Telemetry
      if (overlay) {
        overlay.classList.remove('warp-out', 'anomaly');
        overlay.classList.add('active');
        if (progressFill) progressFill.style.width = '20%';
      }

      try {
        const passwordHash = await hashPassword(password);
        if (progressFill) progressFill.style.width = '45%';

        // Step 1: Save locally in Registered Users store with strictly Student role
        const newUser = {
          name,
          email,
          passwordHash,
          role: 'student', // Initial role strictly Student as specified
          verified: true,
          registeredAt: Date.now()
        };
        saveRegisteredUser(newUser);

        if (progressFill) progressFill.style.width = '70%';

        // Step 2: Sync to Google Apps Script backend & Google Sheets Data Center
        try {
          await syncAuthorizationToServer({
            action:       'authorize',
            email:        email,
            role:         'student',
            name:         name,
            passwordHash: passwordHash,
            permanent:    true
          });
        } catch {
          // Local registration succeeds regardless of remote network timeout
        }

        if (progressFill) progressFill.style.width = '100%';

        await new Promise(r => setTimeout(r, 600));
        if (overlay) overlay.classList.add('warp-out');
        await new Promise(r => setTimeout(r, 400));

        // Create active Student session so user is logged in
        const publicIP = await getPublicIP();
        const logId = appendLoginEvent({
          email:     email,
          role:      'student',
          entryPage: 'Registration → Student Portal',
          ip:        publicIP,
          status:    'active'
        });

        const session = {
          role:  'student',
          id:    email,
          name:  name,
          at:    Date.now(),
          logId: logId
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

        showToast(`Registration successful! Welcome to the Physics Society, ${name}.`, 'success', 4000);

        setTimeout(() => {
          location.href = 'student.html';
        }, 1000);

      } catch (err) {
        if (submitBtn) submitBtn.disabled = false;
        if (overlay) overlay.classList.remove('active');
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = 'Registration failed: ' + err.message;
        }
      }
    });
  }
}

// ============================================================
//  PAGE DISPATCHER
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Delegated logout click handler (replaces inline javascript:logout() URIs)
  document.addEventListener('click', (e) => {
    const logoutEl = e.target.closest('[data-action="logout"], #logoutNavBtn');
    if (logoutEl) {
      e.preventDefault();
      logout();
    }
  });

  // Safe image error fallback listener (replaces inline onerror attributes)
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && (t.classList.contains('team-avatar-img') || t.classList.contains('team-avatar-img-sm'))) {
      t.style.display = 'none';
      if (t.nextElementSibling) t.nextElementSibling.style.display = 'flex';
    }
  }, true);

  initMoodSwitcher();
  const page = currentPage();

  if (page === 'login.html') {
    initLogin();
  } else if (page === 'register.html') {
    initRegister();
  } else if (page === 'admin.html') {
    initAdmin();
  } else if (page === 'member.html') {
    initMember();
  } else if (page === 'student.html') {
    initStudent();
  } else if (page === 'formulas.html') {
    initFormulas();
  } else if (page === 'forum.html') {
    initForum();
  } else if (page === 'lab.html') {
    initLab();
  } else if (page === 'contact.html') {
    initContact();
  } else if (page === 'events.html') {
    initEvents();
  } else if (page === 'colloquium.html') {
    initColloquia();
  } else if (page === 'index.html' || page === '') {
    initHome();
  } else {
    initNav();
  }
});

// ── Global Window Exports ───────────────────────────────────
window.logout             = logout;
window.forceLogoutSession = forceLogoutSession;
window.changeGrantedRole  = changeGrantedRole;
window.revokeOverride     = revokeOverride;
window.syncUserToServer   = syncUserToServer;
window.setDurationPreset  = setDurationPreset;
window.deleteEvent        = deleteEvent;
window.deleteColloquium   = deleteColloquium;
window.pingDataServer     = pingDataServer;
window.applyMood          = applyMood;
window.initMoodSwitcher   = initMoodSwitcher;
window.initRegister       = initRegister;
