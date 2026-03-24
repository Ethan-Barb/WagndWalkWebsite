/* ═══════════════════════════════════════════════
   auth.js — Shared helpers for all pages
   ═══════════════════════════════════════════════ */

const API_BASE = '/api';

/* ── Token management ─────────────────────────── */
function getToken()  { return localStorage.getItem('token'); }
function getUser()   { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } }
function isLoggedIn(){ return !!getToken(); }
function logout()    { localStorage.removeItem('token'); localStorage.removeItem('user'); location.href = '/login'; }

/* ── API wrapper ──────────────────────────────── */
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { ...headers, ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    logout();
    throw new Error('Session expired');
  }

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ── Toast notifications ──────────────────────── */
function ensureToastContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}

function showToast(message, type = 'info') {
  const container = ensureToastContainer();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4000);
}

/* ── Protect page ─────────────────────────────── */
function requireAuth(allowedRoles) {
  if (!isLoggedIn()) { location.href = '/login'; return false; }
  const user = getUser();
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    location.href = '/login';
    return false;
  }
  return true;
}

/* ── Render nav for dashboard pages ───────────── */
function renderDashNav(containerId) {
  const user = getUser();
  if (!user) return;
  const initials = (user.firstName?.[0] || '') + (user.lastName?.[0] || '');

  const links = {
    client: [
      { icon: '—', label: 'Dashboard',  href: '/dashboard/client' },
      { icon: '—', label: 'My Dogs',    href: '/dashboard/client#dogs' },
      { icon: '—', label: 'Book a Walk', href: '/dashboard/client#book' },
      { icon: '—', label: 'Payments',    href: '/dashboard/client#payments' },
    ],
    walker: [
      { icon: '—', label: 'Dashboard', href: '/dashboard/walker' },
      { icon: '—', label: 'Schedule',  href: '/dashboard/walker#schedule' },
      { icon: '—', label: 'Earnings',  href: '/dashboard/walker#earnings' },
      { icon: '—', label: 'Profile',   href: '/dashboard/walker#profile' },
    ],
    admin: [
      { icon: '—', label: 'Dashboard',    href: '/dashboard/admin' },
      { icon: '—', label: 'Users',        href: '/dashboard/admin#users' },
      { icon: '—', label: 'Bookings',     href: '/dashboard/admin#bookings' },
      { icon: '—', label: 'Payments',     href: '/dashboard/admin#payments' },
      { icon: '—', label: 'Analytics',    href: '/dashboard/admin#analytics' },
      { icon: '—', label: 'Site Content', href: '/dashboard/admin#cms' },
    ],
  };

  const navItems = links[user.role] || [];
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="logo" style="padding:0 20px;margin-bottom:32px;display:flex;">
      <span class="logo-mark"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 9.5C5.5 5.5 8.5 3 12 3c3.5 0 6.5 2.5 7.5 6.5.5 2-.5 4-2 5l-1 3.5c-.3 1-1.2 1.5-2.2 1.5h-4.6c-1 0-1.9-.5-2.2-1.5l-1-3.5c-1.5-1-2.5-3-2-5z"/></svg></span>
      Wag &amp; Walk
    </div>
    <nav class="sidebar-nav">
      ${navItems.map(l => `
        <a href="${l.href}"><span class="nav-icon">${l.icon}</span> ${l.label}</a>
      `).join('')}
      <a href="#" onclick="logout(); return false;"><span class="nav-icon">—</span> Log Out</a>
    </nav>
    <div class="sidebar-user">
      <div class="avatar">${initials}</div>
      <div>
        <div class="name">${user.firstName} ${user.lastName}</div>
        <div class="role-label">${user.role}</div>
      </div>
    </div>
  `;
}

/* ── Format helpers ───────────────────────────── */
function formatCents(cents)  { return '$' + (cents / 100).toFixed(2); }
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
function formatTime(time) { // "15:00" → "3:00 PM"
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}
function statusBadge(status) {
  return `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;
}
function starRating(rating) {
  return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
}
