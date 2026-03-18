/* booking.js — client booking flow (calendar, slots, walkers, confirm) */
'use strict';

let _selectedDogs   = [];
let _selectedDate   = null;
let _selectedSlot   = null;
let _selectedWalker = null;
let _calYear, _calMonth;

const PRICE_HOUR  = 2000;   // cents  $20
const EXTRA_DOG   = 500;    // cents  $5

/* ── Entry point ─────────────────────────────────── */
async function initBook() {
  // Pre-select walker if navigated from browse page
  if (window._preselectedWalker) {
    _selectedWalker = window._preselectedWalker;
    window._preselectedWalker = null;
  }

  const now = new Date();
  _calYear  = now.getFullYear();
  _calMonth = now.getMonth();

  await Promise.all([loadBookDogs(), loadBookWalkers()]);
  renderCal();
  updateSummary();
}

/* ── Dogs selector ───────────────────────────────── */
async function loadBookDogs() {
  const el = document.getElementById('book-dogs');
  if (!el) return;
  try {
    const d = await api('/clients/dogs');
    if (!d.dogs.length) {
      el.innerHTML = '<p class="text-muted" style="font-size:.875rem">No dogs yet. <a href="#" data-section="dogs">Add a dog first.</a></p>';
      return;
    }
    el.innerHTML = d.dogs.map(dog => `
      <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid var(--linen);border-radius:8px;cursor:pointer;margin-bottom:8px;transition:border-color .15s" id="dog-lbl-${dog._id}">
        <input type="checkbox" value="${dog._id}" onchange="toggleDog('${dog._id}',this.checked)">
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--amber),var(--sage));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${dog.name[0]}</div>
        <div><div style="font-weight:600">${dog.name}</div><div style="font-size:.78rem;color:var(--muted)">${dog.breed||'Mixed'} · ${dog.size}</div></div>
      </label>`).join('');
  } catch(e) { console.error(e); }
}

function toggleDog(id, checked) {
  _selectedDogs = checked
    ? [...new Set([..._selectedDogs, id])]
    : _selectedDogs.filter(d => d !== id);
  const lbl = document.getElementById(`dog-lbl-${id}`);
  if (lbl) lbl.style.borderColor = checked ? 'var(--amber)' : 'var(--linen)';
  updateSummary();
}

/* ── Walker selector ─────────────────────────────── */
async function loadBookWalkers() {
  const el = document.getElementById('book-walkers');
  if (!el) return;
  try {
    const d = await api('/walkers?available=true');
    el.innerHTML = `
      <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid var(--linen);border-radius:8px;cursor:pointer;margin-bottom:8px" id="walker-lbl-any">
        <input type="radio" name="bk-walker" value="" ${!_selectedWalker?'checked':''} onchange="pickWalker('')">
        <div><div style="font-weight:600">Any available walker</div><div style="font-size:.78rem;color:var(--muted)">Best match assigned automatically</div></div>
      </label>
      ${d.walkers.map(w=>`
        <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid var(--linen);border-radius:8px;cursor:pointer;margin-bottom:8px" id="walker-lbl-${w._id}">
          <input type="radio" name="bk-walker" value="${w._id}" ${_selectedWalker===w._id?'checked':''} onchange="pickWalker('${w._id}')">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--amber),var(--sage));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.78rem">${avatar(w.firstName,w.lastName)}</div>
          <div>
            <div style="font-weight:600">${w.firstName} ${w.lastName}</div>
            <div style="font-size:.78rem;color:var(--muted)">⭐ ${fmt.rating(w.walkerProfile?.averageRating)} · ${w.walkerProfile?.totalWalks||0} walks</div>
          </div>
        </label>`).join('')}`;
  } catch(e) { console.error(e); }
}

function pickWalker(id) {
  _selectedWalker = id || null;
  if (_selectedDate) loadSlots(_selectedDate);
  updateSummary();
}

/* ── Calendar ────────────────────────────────────── */
function renderCal() {
  const el = document.getElementById('book-cal');
  if (!el) return;

  const firstDay    = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMonth = new Date(_calYear, _calMonth+1, 0).getDate();
  const today       = new Date(); today.setHours(0,0,0,0);
  const monthLabel  = new Date(_calYear, _calMonth).toLocaleDateString('en-US',{month:'long',year:'numeric'});

  const dayHeaders = ['S','M','T','W','T','F','S'].map(d=>`<div class="cal-dh">${d}</div>`).join('');
  const blanks     = Array(firstDay).fill('<div></div>').join('');
  const cells      = Array.from({length:daysInMonth},(_,i)=>{
    const day     = i+1;
    const dateObj = new Date(_calYear, _calMonth, day);
    const dateStr = dateObj.toISOString().split('T')[0];
    const isPast  = dateObj < today;
    const isSel   = dateStr === _selectedDate;
    const isToday = dateObj.getTime() === today.getTime();
    return `<div class="cal-day${isToday?' today':''}${isSel?' selected':''}${isPast?' past':''}"
      onclick="${isPast?'':''}" data-date="${dateStr}">${day}</div>`;
  }).join('');

  el.innerHTML = `
    <div class="cal-hd">
      <button class="btn btn-ghost btn-sm" id="cal-prev">‹</button>
      <strong>${monthLabel}</strong>
      <button class="btn btn-ghost btn-sm" id="cal-next">›</button>
    </div>
    <div class="cal-grid">${dayHeaders}${blanks}${cells}</div>`;

  // Wire buttons
  el.querySelector('#cal-prev').onclick = () => {
    if (_calMonth === 0) { _calMonth=11; _calYear--; } else _calMonth--;
    renderCal();
  };
  el.querySelector('#cal-next').onclick = () => {
    if (_calMonth === 11) { _calMonth=0; _calYear++; } else _calMonth++;
    renderCal();
  };
  // Wire day clicks
  el.querySelectorAll('.cal-day:not(.past)').forEach(day => {
    day.addEventListener('click', () => {
      _selectedDate = day.dataset.date;
      _selectedSlot = null;
      el.querySelectorAll('.cal-day').forEach(d=>d.classList.remove('selected'));
      day.classList.add('selected');
      loadSlots(_selectedDate);
      updateSummary();
    });
  });
}

/* ── Time slots ──────────────────────────────────── */
async function loadSlots(dateStr) {
  const el = document.getElementById('book-slots');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--muted);font-size:.82rem">Loading…</p>';
  try {
    const params = _selectedWalker
      ? `?date=${dateStr}&walkerId=${_selectedWalker}`
      : `?date=${dateStr}`;
    const d = await api(`/bookings/available-slots${params}`);

    if (!d.slots.length) { el.innerHTML='<p class="empty">No slots for this date.</p>'; return; }
    el.innerHTML = d.slots.map(s=>`
      <div class="slot${!s.available?' off':''}" data-start="${s.startTime}" data-end="${s.endTime}"
        onclick="${s.available?`pickSlot('${s.startTime}','${s.endTime}',this)`:''}">${s.startTime}</div>`).join('');
  } catch(e) { el.innerHTML=`<p style="color:var(--danger);font-size:.82rem">${e.message}</p>`; }
}

function pickSlot(start, end, el) {
  _selectedSlot = { startTime: start, endTime: end };
  document.querySelectorAll('.slot').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  updateSummary();
}

/* ── Summary ─────────────────────────────────────── */
function updateSummary() {
  const el = document.getElementById('book-summary');
  if (!el) return;

  const extra = Math.max(0, _selectedDogs.length - 1) * EXTRA_DOG;
  const total = PRICE_HOUR + extra;

  el.innerHTML = `
    <div style="background:var(--cream-2);border-radius:12px;padding:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Date</span><strong>${_selectedDate||'—'}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Time</span><strong>${_selectedSlot?`${_selectedSlot.startTime}–${_selectedSlot.endTime}`:'—'}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Dogs</span><strong>${_selectedDogs.length||'—'}</strong></div>
      <hr style="border:none;border-top:1px solid var(--linen);margin:10px 0">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>60-min walk</span><span>${fmt.money(PRICE_HOUR)}</span></div>
      ${extra?`<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Extra dog ×${_selectedDogs.length-1}</span><span>${fmt.money(extra)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.05rem;margin-top:8px"><span>Total</span><span style="color:var(--amber)">${fmt.money(total)}</span></div>
    </div>`;

  const btn = document.getElementById('confirm-btn');
  if (btn) btn.textContent = `Confirm Booking (${fmt.money(total)})`;
}

/* ── Confirm booking ─────────────────────────────── */
async function confirmBooking() {
  if (!_selectedDogs.length)  { showAlert('book-alert','Select at least one dog.'); return; }
  if (!_selectedDate)          { showAlert('book-alert','Select a date.'); return; }
  if (!_selectedSlot)          { showAlert('book-alert','Select a time slot.'); return; }

  const btn = document.getElementById('confirm-btn');
  btn.disabled = true; btn.textContent = 'Booking…';

  try {
    // Use locally stored user — avoids extra API call that could trigger a redirect
    const currentUser = getUser();
    const body = {
      walkerId:            _selectedWalker || undefined,
      dogIds:              _selectedDogs,
      scheduledDate:       _selectedDate,
      startTime:           _selectedSlot.startTime,
      endTime:             _selectedSlot.endTime,
      durationMinutes:     60,
      pickupAddress:       currentUser?.address || { street: '—', city: 'Naperville', state: 'IL' },
      specialInstructions: document.getElementById('book-notes')?.value || '',
    };

    await api('/bookings', { method: 'POST', body: JSON.stringify(body) });

    showAlert('book-alert', '🎉 Walk booked! Your walker will confirm shortly.', 'success');
    _selectedDogs = []; _selectedDate = null; _selectedSlot = null; _selectedWalker = null;
    updateSummary();
    setTimeout(() => document.querySelector('[data-section="bookings"]')?.click(), 1800);

  } catch(e) {
    showAlert('book-alert', e.message);
    btn.disabled = false;
    btn.textContent = `Confirm Booking (${fmt.money(PRICE_HOUR + Math.max(0, _selectedDogs.length - 1) * EXTRA_DOG)})`;
  }
}
