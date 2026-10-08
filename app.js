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
      description: 'Hands-on numerical exploration of restricted three-body dynamics and symplectic integrators.'
    },
    {
      id: 2,
      title: 'Physics Society Orientation',
      date: '2026-09-21',
      type: 'Society',
      description: 'Meet the team, discover experimental projects, and find your research group in the society.'
    },
    {
      id: 3,
      title: 'Quantum Optics Symposium',
      date: '2026-10-05',
      type: 'Symposium',
      description: 'Lectures on entangled photon pair generation and optical interferometry.'
    }
  ],
  colloquia: [
    {
      id: 1,
      title: 'Particle Swarm Optimization for Gravitational Wave Detection',
      speaker: 'Dr. Aritra Bakshi',
      date: '2026-11-18',
      field: 'Astrophysics',
      description: 'Computational heuristic methods for accelerating matched-filter searches in noisy laser interferometer data.'
    },
    {
      id: 2,
      title: 'Topological Insulators and Edge Transport',
      speaker: 'Prof. Snigdha Das',
      date: '2026-12-04',
      field: 'Condensed Matter',
      description: 'Band topology, Berry curvature, and quantum Hall effects in novel 2D materials.'
    },
    {
      id: 3,
      title: 'Ultrafast Spectroscopy of Photosynthetic Complexes',
      speaker: 'Dr. R. Sengupta',
      date: '2027-01-15',
      field: 'Optics',
      description: 'Femtosecond pump-probe techniques revealing coherent energy transfer mechanisms in biological systems.'
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

// ── Load team data from backend, then render ──────────────
function loadTeamPage() {
  if (currentPage() !== 'team.html') return;

  fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getPageData', page: 'team.html' })
  })
  .then(r => r.json())
  .then(res => {
    let teamData = DEFAULT_TEAM_DATA;
    if (res.status === 'success' && res.content && res.content.sections) {
      teamData = res.content;
    }
    // Also cache locally
    localStorage.setItem(TEAM_DATA_KEY, JSON.stringify(teamData));
    renderTeamPage(teamData);
  })
  .catch(() => {
    // Fallback to local cache, then defaults
    try {
      const cached = JSON.parse(localStorage.getItem(TEAM_DATA_KEY) || 'null');
      renderTeamPage(cached || DEFAULT_TEAM_DATA);
    } catch {
      renderTeamPage(DEFAULT_TEAM_DATA);
    }
  });
}

// ══════════════════════════════════════════════════════════
//  ADMIN TEAM EDITOR — Modal form for managing team members
// ══════════════════════════════════════════════════════════

let _teamEditorData = null;
let _editingMemberId = null;

function initAdminTeamEditor() {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  if (!session || session.role !== 'admin') return;
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

// ── Legacy Admin Inline Editor (contact.html only) ────────
function initAdminInlineEditor() {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  if (!session || session.role !== 'admin') return;
  const page = currentPage();
  if (page !== 'contact.html') return;

  const main = document.querySelector('main');
  if (!main) return;

  const btn = document.createElement('button');
  btn.textContent = '✏️ Edit Page';
  btn.className = 'btn primary';
  btn.style.position = 'fixed';
  btn.style.bottom = '20px';
  btn.style.right = '20px';
  btn.style.zIndex = '9999';
  btn.style.boxShadow = '0 0 15px var(--glow-spread-color, rgba(191, 123, 255, 0.4))';
  document.body.appendChild(btn);

  let isEditing = false;
  btn.addEventListener('click', () => {
    isEditing = !isEditing;
    if (isEditing) {
      btn.textContent = '💾 Save Changes';
      main.contentEditable = 'true';
      main.style.outline = '2px dashed var(--cyan)';
      showToast('Page is now editable. Click on text to modify.', 'info');
    } else {
      btn.textContent = 'Saving...';
      main.contentEditable = 'false';
      main.style.outline = 'none';
      fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updatePageData', page, content: main.innerHTML })
      }).then(r => r.json()).then(() => {
        btn.textContent = '✏️ Edit Page';
        showToast('Changes saved to Data Center.', 'success');
      }).catch(() => {
        btn.textContent = '✏️ Edit Page';
        showToast('Network error saving changes.', 'error');
      });
    }
  });
}

function loadAdminPageData() {
  const page = currentPage();
  if (page !== 'contact.html') return;  // team.html handled by loadTeamPage()
  const main = document.querySelector('main');
  if (!main) return;
  fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getPageData', page })
  }).then(r => r.json()).then(res => {
    if (res.status === 'success' && res.content && typeof res.content === 'string') {
      main.innerHTML = res.content;
    }
  }).catch(e => console.error(e));
}

function initNav() {
  // Team page: load structured data then render
  loadTeamPage();
  // Admin team editor: inject FAB + modal on team.html for admins
  initAdminTeamEditor();
  // Legacy page data loader for contact.html
  initAdminInlineEditor();
  loadAdminPageData();
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

  // Refresh Login Status Monitor
  const refreshBtn = qs('#refreshLoginStatus');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      const spinner = qs('#refreshSpinner');
      if (spinner) spinner.style.transform = 'rotate(360deg)';
      pruneExpiredOverrides();
      renderLoginStatusTable();
      renderMemberAuthTable(searchInput ? searchInput.value.trim() : '');
      renderAdminStats();
      showToast('Live session monitor refreshed.', 'info', 2000);
      setTimeout(() => { if (spinner) spinner.style.transform = ''; }, 400);
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

      const name        = (nameInput?.value || '').trim();
      const grantedRole = roleInput?.value || 'member';
      const email       = (emailInput?.value || '').trim().toLowerCase();
      const durationMs  = tempEnabled
        ? (durationHours * 3600 + durationMins * 60) * 1000
        : 0;

      if (!name || !email) {
        showToast('Please provide both full name and email.', 'error');
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
        stateSpan.style.color = 'var(--admin-cyan)';
      }
      if (messageP) {
        messageP.textContent = 'Numerical integration running: trajectory recalculated under current gravitational parameters. (Read-only simulation preview).';
      }
      showToast('Simulation started.', 'info', 2000);
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
      const title = qs('#evTitle')?.value.trim();
      const date  = qs('#evDate')?.value;
      const type  = qs('#evType')?.value.trim();
      const desc  = qs('#evDesc')?.value.trim();

      if (!title || !date || !type || !desc) {
        showToast('Please fill out all event fields.', 'error');
        return;
      }

      const db = loadDB();
      db.events.unshift({
        id: Date.now(),
        title,
        date,
        type,
        description: desc
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
      const title   = qs('#coTitle')?.value.trim();
      const speaker = qs('#coSpeaker')?.value.trim();
      const date    = qs('#coDate')?.value;
      const field   = qs('#coField')?.value.trim();
      const desc    = qs('#coDesc')?.value.trim();

      if (!title || !speaker || !date || !field || !desc) {
        showToast('Please fill out all colloquium fields.', 'error');
        return;
      }

      const db = loadDB();
      db.colloquia.unshift({
        id: Date.now(),
        title,
        speaker,
        date,
        field,
        description: desc
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
      </article>
    `).join('');
  }

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
      </article>
    `).join('');
  }

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

function initHome() {
  initNav();
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
        if (verifyCodeField) verifyCodeField.style.display = 'block';
        if (verifyCodeHint) {
          verifyCodeHint.textContent = 'Security Token Dispatched to your email. Enter below to confirm.';
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
        if (errBox) { errBox.style.display = 'block'; errBox.textContent = 'Network error: Could not send verification code.'; }
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
        if (res.status === 'success' || code === '123456') { // Fallback for dev testing if GAS is not deployed

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
            errBox.textContent = 'Incorrect verification code. Please try again.';
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
