/* auth.js — shared frontend auth helpers */
'use strict';

function getToken() { return localStorage.getItem('token'); }
function getUser()  {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.href = '/login';
}

/** Redirect if not logged in / wrong role */
function requireAuth(roles = []) {
  const token = getToken();
  const user  = getUser();
  if (!token || !user) { location.href = '/login'; return null; }
  if (roles.length && !roles.includes(user.role)) { location.href = '/login'; return null; }
  return user;
}

/** Authenticated fetch — auto-logout on 401 */
async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { logout(); return; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ── Formatters ────────────────────────────── */
const fmt = {
  date(d) {
    return new Date(d).toLocaleDateString('en-US',
      { weekday: 'short', month: 'short', day: 'numeric' });
  },
  dateL(d) {
    return new Date(d).toLocaleDateString('en-US',
      { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  },
  money(cents) { return `$${(cents / 100).toFixed(2)}`; },
  rating(r)   { return r ? `${r.toFixed(1)}★` : 'No ratings'; },
};

function statusBadge(s) {
  return `<span class="badge badge-${s}">${s.replace('_',' ')}</span>`;
}

function avatar(firstName, lastName) {
  return `${(firstName||'?')[0]}${(lastName||'')[0]}`.toUpperCase();
}

function showAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

function setGreeting(elId) {
  const user = getUser();
  const el   = document.getElementById(elId);
  if (el && user) el.textContent = `Hi, ${user.firstName}!`;
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
