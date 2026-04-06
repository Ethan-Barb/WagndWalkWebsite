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
      { icon: '—', label: 'Messages',   href: '/dashboard/client#messages' },
      { icon: '—', label: 'Payments',    href: '/dashboard/client#payments' },
    ],
    walker: [
      { icon: '—', label: 'Dashboard', href: '/dashboard/walker' },
      { icon: '—', label: 'Schedule',  href: '/dashboard/walker#schedule' },
      { icon: '—', label: 'Messages',  href: '/dashboard/walker#messages' },
      { icon: '—', label: 'Earnings',  href: '/dashboard/walker#earnings' },
      { icon: '—', label: 'Profile',   href: '/dashboard/walker#profile' },
    ],
    admin: [
      { icon: '—', label: 'Dashboard',    href: '/dashboard/admin' },
      { icon: '—', label: 'Users',        href: '/dashboard/admin#users' },
      { icon: '—', label: 'Bookings',     href: '/dashboard/admin#bookings' },
      { icon: '—', label: 'Messages',     href: '/dashboard/admin#messages' },
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
      <span class="logo-mark"><svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><g transform="translate(40,40)"><rect x="-14" y="-5" width="28" height="10" rx="3" fill="currentColor"/><circle cx="-14" cy="-5" r="5.5" fill="currentColor"/><circle cx="-14" cy="5" r="5.5" fill="currentColor"/><circle cx="14" cy="-5" r="5.5" fill="currentColor"/><circle cx="14" cy="5" r="5.5" fill="currentColor"/></g></svg></span>
      Wag &amp; Walk
    </div>
    <nav class="sidebar-nav">
      ${navItems.map(l => `
        <a href="${l.href}"><span class="nav-icon">${l.icon}</span> ${l.label}</a>
      `).join('')}
      <a href="#" onclick="logout(); return false;"><span class="nav-icon">—</span> Log Out</a>
    </nav>
    <div style="padding:12px 20px;border-top:1px solid rgba(255,255,255,.06);">
      <div id="notif-bell-wrap" style="position:relative;display:inline-block;cursor:pointer;" onclick="toggleNotifPanel()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        <span id="notif-dot" class="nav-bell-dot" style="display:none;position:absolute;top:-2px;right:-2px;width:8px;height:8px;background:var(--danger);border-radius:50%;"></span>
      </div>
      <div id="notif-panel" class="notif-panel"></div>
    </div>
    <div class="sidebar-user">
      <div class="avatar">${initials}</div>
      <div>
        <div class="name">${user.firstName} ${user.lastName}</div>
        <div class="role-label">${user.role}</div>
      </div>
    </div>
  `;

  // Load notifications
  loadNotifications().then(data => {
    if (!data) return;
    if (data.unreadCount > 0) {
      document.getElementById('notif-dot').style.display = 'block';
    }
    const panel = document.getElementById('notif-panel');
    if (data.notifications.length === 0) {
      panel.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-muted);font-size:.82rem;">No notifications yet</div>';
    } else {
      panel.innerHTML = '<div style="padding:12px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-light);"><span style="font-size:.82rem;font-weight:600;">Notifications</span><button class="btn btn-ghost btn-sm" onclick="markAllRead()" style="font-size:.7rem;">Mark all read</button></div>' +
        data.notifications.slice(0, 15).map(n => {
          const time = new Date(n.createdAt);
          const ago = getTimeAgo(time);
          return '<div class="notif-item ' + (n.isRead ? '' : 'unread') + '" onclick="readNotif(\'' + n._id + '\', this)"><div class="notif-title">' + n.title + '</div><div class="notif-msg">' + n.message.substring(0, 80) + '</div><div class="notif-time">' + ago + '</div></div>';
        }).join('');
    }
  });
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  panel.classList.toggle('open');
  const bell = document.querySelector('#notif-bell-wrap svg');
  if (bell) bell.classList.add('bell-ring');
  setTimeout(() => bell?.classList.remove('bell-ring'), 600);
}

async function readNotif(id, el) {
  if (el) el.classList.remove('unread');
  await markNotificationRead(id);
}

async function markAllRead() {
  await markAllNotificationsRead();
  document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
  document.getElementById('notif-dot').style.display = 'none';
  showToast('All notifications marked as read', 'info');
}

function getTimeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
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

/* ── Advanced Animations ──────────────────────── */

// Scroll reveal observer (used on every page)
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.06, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.reveal,.reveal-scale,.reveal-left,.reveal-right').forEach(el => obs.observe(el));
  return obs;
}

// Section in-view observer
function initSectionObserver() {
  const sObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: 0.05 });
  document.querySelectorAll('.section').forEach(el => sObs.observe(el));
}

// Button ripple effect
function initRippleButtons() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn || btn.disabled) return;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

// Animated counter
function animateCounters() {
  document.querySelectorAll('.counter[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target) || 0;
    const duration = 1500;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(ease * target) + (el.dataset.suffix || '');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// Parallax on scroll
function initParallax() {
  const els = document.querySelectorAll('.parallax-img');
  if (!els.length) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        els.forEach(el => {
          const rect = el.parentElement.getBoundingClientRect();
          const speed = parseFloat(el.dataset.speed) || 0.15;
          const offset = rect.top * speed;
          el.style.transform = `translateY(${offset}px) scale(1.1)`;
        });
        ticking = false;
      });
      ticking = true;
    }
  });
}

// Nav scroll effect
function initNavScroll() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// Notifications
async function loadNotifications() {
  if (!isLoggedIn()) return;
  try {
    const data = await api('/notifications');
    return data;
  } catch (e) { return { notifications: [], unreadCount: 0 }; }
}

async function markNotificationRead(id) {
  try { await api(`/notifications/${id}/read`, { method: 'PATCH' }); } catch (e) {}
}

async function markAllNotificationsRead() {
  try { await api('/notifications/read-all', { method: 'PATCH' }); } catch (e) {}
}

// Stripe Checkout redirect
async function redirectToCheckout(bookingId) {
  try {
    const data = await api('/checkout/create-session', { method: 'POST', body: { bookingId } });
    if (data.url) window.location.href = data.url;
    else showToast('Payment setup failed', 'error');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Initialize all animations on page load
function initAnimations() {
  initScrollReveal();
  initSectionObserver();
  initRippleButtons();
  initNavScroll();
  initParallax();
}

// Status progress tracker UI helper
function renderStatusTracker(currentStatus) {
  const statuses = [
    { key: 'pending', label: 'Requested' },
    { key: 'accepted', label: 'Confirmed' },
    { key: 'walker_assigned', label: 'Assigned' },
    { key: 'on_the_way', label: 'On the Way' },
    { key: 'in_progress', label: 'Walking' },
    { key: 'completed', label: 'Done' },
  ];

  if (currentStatus === 'cancelled' || currentStatus === 'declined') {
    return '<div style="display:flex;align-items:center;gap:6px;margin:8px 0;"><span class="badge badge-cancelled">' + currentStatus + '</span></div>';
  }

  const currentIdx = statuses.findIndex(s => s.key === currentStatus);
  return '<div class="status-tracker">' +
    statuses.map((s, i) => {
      const isDone = i < currentIdx;
      const isActive = i === currentIdx;
      const dotClass = isDone ? 'done' : (isActive ? 'active' : '');
      const labelClass = isDone ? 'done' : (isActive ? 'active' : '');
      return '<div class="status-step">' +
        '<div class="status-step-wrap">' +
          '<div class="status-dot ' + dotClass + '"></div>' +
          '<div class="status-step-label ' + labelClass + '">' + s.label + '</div>' +
        '</div>' +
        (i < statuses.length - 1 ? '<div class="status-line ' + (isDone ? 'done' : '') + '"></div>' : '') +
      '</div>';
    }).join('') + '</div>';
}
