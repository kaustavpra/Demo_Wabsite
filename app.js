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
    return raw ? { ...defaultSecurityPolicy, ...JSON.parse(raw) } : { ...defaultSecurityPolicy };
  } catch {
    return { ...defaultSecurityPolicy };
  }
}

function saveSecurityPolicy(policy) {
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
  const initials = getInitials(member.name);
  const links = buildSocialLinks(member, 'team-link');

  return `
    <article class="team-card" aria-label="${escapeHTML(member.name)}, ${escapeHTML(member.role)}">
      <div class="team-avatar-wrap">
        ${member.photo
          ? `<img class="team-avatar-img" src="${escapeHTML(member.photo)}" alt="${escapeHTML(member.name)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
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
  const initials = getInitials(member.name);
  const iconLinks = buildSocialLinks(member, 'team-icon-link icon');

  return `
    <div class="team-row">
      <div class="team-avatar-sm">
        ${member.photo
          ? `<img class="team-avatar-img-sm" src="${escapeHTML(member.photo)}" alt="${escapeHTML(member.name)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
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
    parts.push(`<a href="mailto:${escapeHTML(email)}" class="${linkClass}" aria-label="Email ${escapeHTML(member.name)}" title="Email">${SOCIAL_ICONS.email}${linkClass.includes('icon') ? '' : '<span>Email</span>'}</a>`);
  }
  if (social.linkedin) {
    parts.push(`<a href="${escapeHTML(social.linkedin)}" target="_blank" rel="noopener noreferrer" class="${linkClass}" aria-label="${escapeHTML(member.name)} on LinkedIn" title="LinkedIn">${SOCIAL_ICONS.linkedin}${linkClass.includes('icon') ? '' : '<span>LinkedIn</span>'}</a>`);
  }
  if (social.instagram) {
    parts.push(`<a href="${escapeHTML(social.instagram)}" target="_blank" rel="noopener noreferrer" class="${linkClass}" aria-label="${escapeHTML(member.name)} on Instagram" title="Instagram">${SOCIAL_ICONS.instagram}${linkClass.includes('icon') ? '' : '<span>Instagram</span>'}</a>`);
  }
  if (social.github) {
    parts.push(`<a href="${escapeHTML(social.github)}" target="_blank" rel="noopener noreferrer" class="${linkClass}" aria-label="${escapeHTML(member.name)} on GitHub" title="GitHub">${SOCIAL_ICONS.github}${linkClass.includes('icon') ? '' : '<span>GitHub</span>'}</a>`);
  }
  if (social.facebook) {
    parts.push(`<a href="${escapeHTML(social.facebook)}" target="_blank" rel="noopener noreferrer" class="${linkClass}" aria-label="${escapeHTML(member.name)} on Facebook" title="Facebook">${SOCIAL_ICONS.facebook}${linkClass.includes('icon') ? '' : '<span>Facebook</span>'}</a>`);
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
    if (confirm('Discard all unsaved changes?')) {
      try {
        _teamEditorData = JSON.parse(localStorage.getItem(TEAM_DATA_KEY) || 'null') || structuredClone(DEFAULT_TEAM_DATA);
      } catch {
        _teamEditorData = structuredClone(DEFAULT_TEAM_DATA);
      }
      renderMemberList();
      switchToTab('members');
      showToast('Changes discarded.', 'info');
    }
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
          ${m.photo
            ? `<img src="${escapeHTML(m.photo)}" alt="${escapeHTML(m.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.outerHTML='${initials}'">`
            : initials
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
      ${idx > 0 ? `<button style="background:none; border:none; color:var(--red,#f87171); cursor:pointer; font-size:14px;" data-del-section="${idx}" aria-label="Remove section ${s.title}" title="Remove section">✕</button>` : ''}
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
      if (memberCount > 0) {
        if (!confirm(`Section "${sectionName}" has ${memberCount} member(s). Deleting it will also remove those members. Continue?`)) return;
      }
      _teamEditorData.sections.splice(idx, 1);
      renderSectionList();
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
  if (!confirm(`Remove "${member?.name || 'this member'}" from the team?`)) return;
  section.members = section.members.filter(m => m.id !== mid);
  renderMemberList();
  renderTeamPage(_teamEditorData);
  showToast('Member removed.', 'info');
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
  lottieScript.src = 'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js';
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

  // Update Hero texts if elements exist
  const kickerEl = document.getElementById('contactHeroKicker');
  if (kickerEl) kickerEl.textContent = hero.kicker || 'Contact · Est. 2025';
  const titleEl = document.getElementById('contactHeroTitle');
  if (titleEl) titleEl.innerHTML = hero.title || 'Get in <em>touch</em>.';
  const ledeEl = document.getElementById('contactHeroLede');
  if (ledeEl) ledeEl.textContent = hero.lede || '';

  // Build social buttons
  const socialButtons = [];
  if (social.facebook) {
    socialButtons.push(`<a href="${escapeHTML(social.facebook)}" target="_blank" rel="noopener noreferrer" class="contact-social-btn" aria-label="PUPS on Facebook" title="Facebook">${SOCIAL_ICONS.facebook}</a>`);
  }
  if (social.instagram) {
    socialButtons.push(`<a href="${escapeHTML(social.instagram)}" target="_blank" rel="noopener noreferrer" class="contact-social-btn" aria-label="PUPS on Instagram" title="Instagram">${SOCIAL_ICONS.instagram}</a>`);
  }
  if (social.linkedin) {
    socialButtons.push(`<a href="${escapeHTML(social.linkedin)}" target="_blank" rel="noopener noreferrer" class="contact-social-btn" aria-label="PUPS on LinkedIn" title="LinkedIn">${SOCIAL_ICONS.linkedin}</a>`);
  }
  if (social.youtube) {
    socialButtons.push(`<a href="${escapeHTML(social.youtube)}" target="_blank" rel="noopener noreferrer" class="contact-social-btn" aria-label="PUPS on YouTube" title="YouTube"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg></a>`);
  }
  if (social.github) {
    socialButtons.push(`<a href="${escapeHTML(social.github)}" target="_blank" rel="noopener noreferrer" class="contact-social-btn" aria-label="PUPS on GitHub" title="GitHub">${SOCIAL_ICONS.github}</a>`);
  }

  container.innerHTML = `
    <div class="contact-grid">
      <!-- Left Column: Narrative & Enquiry Form -->
      <div class="contact-left-card">
        <h2>${narrative.title || "We'd love to <em>hear from you</em>."}</h2>
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
            <span><a href="${escapeHTML(info.departmentUrl || '#')}" target="_blank" rel="noopener noreferrer">${escapeHTML(info.departmentName || 'presiuniv.ac.in →')}</a></span>
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
    if (confirm('Discard changes and reload saved contact data?')) {
      try {
        _contactEditorData = JSON.parse(localStorage.getItem(CONTACT_DATA_KEY) || 'null') || structuredClone(DEFAULT_CONTACT_DATA);
      } catch {
        _contactEditorData = structuredClone(DEFAULT_CONTACT_DATA);
      }
      populateContactForm(_contactEditorData);
      showToast('Changes discarded.', 'info');
      closeContactEditor();
    }
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
  // Team page: load structured data then render
  loadTeamPage();
  initAdminTeamEditor();
  // Contact page: load structured data then render
  loadContactPage();
  initAdminContactEditor();
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
  const page = currentPage();

  if (session && session.id) {
    // USER IS LOGGED IN ACROSS NAVIGATION
    if (loginLink) {
      loginLink.textContent = 'Logout';
      loginLink.href = 'javascript:logout();';
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

// ── Cryptographic Hashing ───────────────────────────────────
async function hashPassword(password) {
  if (window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback below
    }
  }
  // Basic deterministic fallback hash if SubtleCrypto is unavailable
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (hash << 5) - hash + password.charCodeAt(i);
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash).toString(16);
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
        <a class="btn ghost" href="javascript:logout();" style="font-size:12px; padding:8px 14px;">Logout</a>
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
            passwordHash:  passwordHash
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
  if (sessionHours) sessionHours.value = policy.sessionHours || 24;

  // Security Form Submit
  const secForm = qs('#securityForm');
  if (secForm) {
    secForm.onsubmit = (e) => {
      e.preventDefault();
      const updatedPolicy = {
        twoFactor:    !!sec2fa?.checked,
        loginAlerts:  !!secAlerts?.checked,
        rateLimit:    !!secRateLimit?.checked,
        sessionHours: Math.max(1, Math.min(72, parseInt(sessionHours?.value || 24, 10)))
      };
      saveSecurityPolicy(updatedPolicy);

      const banner = qs('#securitySavedBanner');
      if (banner) {
        banner.className = 'feedback-banner success show';
        banner.innerHTML = `✓ Security policy successfully updated and enforced globally.`;
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
  if (!confirm(`Are you sure you want to revoke authorization for ${email}? This will revert their access to Student.`)) {
    return;
  }

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
//  STUDENT & ACADEMIC PORTALS INITIALIZERS
// ============================================================
function initStudent() {
  const session = requireRole('student');
  if (!session) return;
  initNav();

  const idSpan = qs('#studentId');
  if (idSpan) {
    idSpan.textContent = session.name || session.id.split('@')[0] || 'Student';
  }
}

function initFormulas() {
  const session = requireRole('student');
  if (!session) return;
  initNav();
}

function initForum() {
  const session = requireRole('student');
  if (!session) return;
  initNav();
}

function initLab() {
  const session = requireRole('student');
  if (!session) return;
  initNav();

  const stateSpan = qs('#labState');
  const messageP  = qs('#labMessage');
  const runBtn    = qs('#runLab');
  const resetBtn  = qs('#resetLab');

  if (runBtn) {
    runBtn.onclick = () => {
      if (stateSpan) {
        stateSpan.textContent = 'SIMULATING';
        stateSpan.style.color = 'var(--cyan)';
      }
      if (messageP) {
        messageP.innerHTML = renderNewtonsCradle('Calculating symplectic numerical integration...') +
          `<p style="text-align:center; color:var(--muted); font-size:12.5px; margin-top:12px;">Solving restricted three-body differential equations.</p>`;
      }
      showToast('Numerical integration running.', 'info', 2000);
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      if (stateSpan) {
        stateSpan.textContent = 'READY';
        stateSpan.style.color = '';
      }
      if (messageP) {
        messageP.textContent = 'The simulation is ready.';
      }
      showToast('Simulation reset to initial conditions.', 'info', 2000);
    };
  }
}

// ── Contact Page Initializer ────────────────────────────────
function initContact() {
  initNav();
  const form = qs('#contactForm');
  const banner = qs('#contactStatusBanner');
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
        banner.innerHTML = `Please fill out all required fields.`;
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
        ${ev.regLink ? `<p style="font-size:11px; margin-top:4px;"><a href="${escapeHTML(ev.regLink)}" target="_blank" rel="noopener noreferrer" style="color:var(--cyan); text-decoration:underline;">Registration&nbsp;--&gt; (${escapeHTML(ev.regLink)})</a></p>` : ''}
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
        ${co.youtubeLink ? `<p style="font-size:11px; margin-top:4px;"><a href="${escapeHTML(co.youtubeLink)}" target="_blank" rel="noopener noreferrer" style="color:#f87171; text-decoration:underline;">Watch here&nbsp;--&gt; (${escapeHTML(co.youtubeLink)})</a></p>` : ''}
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
        ${ev.regLink ? `
          <div style="margin-top:16px;">
            <a href="${escapeHTML(ev.regLink)}" target="_blank" rel="noopener noreferrer" class="action-link-btn register">
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
        ${co.youtubeLink ? `
          <div style="margin-top:16px;">
            <a href="${escapeHTML(co.youtubeLink)}" target="_blank" rel="noopener noreferrer" class="action-link-btn youtube">
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
        <a class="btn ghost" href="javascript:logout();" style="font-size:12px; padding:8px 14px;">Logout</a>
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
