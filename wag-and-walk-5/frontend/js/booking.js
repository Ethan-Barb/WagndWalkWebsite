/* booking.js — full booking flow with duration selector, pricing, promo codes, checkout modal */
'use strict';

let _selectedDogs     = [];
let _selectedDate     = null;
let _selectedSlot     = null;
let _selectedWalker   = null;
let _selectedDuration = 30;
let _appliedPromo     = null;   // { code, type, value, discountCents }
let _calYear, _calMonth;

/* ── Pricing helpers ──────────────────────────────── */
function getPricing() {
  try { const s = localStorage.getItem('ww_pricing'); if (s) return JSON.parse(s); } catch(e) {}
  return { price20: 1000, price30: 2000, price60: 4000, extraDog: 500 };
}
function getPromoCodes() {
  try { const s = localStorage.getItem('ww_promos'); if (s) return JSON.parse(s); } catch(e) {}
  return [];
}
function getDurationPrice() {
  const p = getPricing();
  if (_selectedDuration === 20) return p.price20;
  if (_selectedDuration === 60) return p.price60;
  return p.price30;
}
function calcTotal() {
  const p     = getPricing();
  const base  = getDurationPrice();
  const extra = Math.max(0, _selectedDogs.length - 1) * p.extraDog;
  const sub   = base + extra;
  const disc  = _appliedPromo ? _appliedPromo.discountCents : 0;
  return { base, extra, sub, disc, total: Math.max(0, sub - disc) };
}

/* ── Entry point ──────────────────────────────────── */
async function initBook() {
  if (window._preselectedWalker) {
    _selectedWalker = window._preselectedWalker;
    window._preselectedWalker = null;
  }
  const now = new Date();
  _calYear  = now.getFullYear();
  _calMonth = now.getMonth();
  _appliedPromo = null;

  await Promise.all([loadBookDogs(), loadBookWalkers()]);
  renderDurationSelector();
  renderCal();
  updateSummary();
}

/* ── Duration selector ────────────────────────────── */
function renderDurationSelector() {
  const el = document.getElementById('book-duration');
  if (!el) return;
  const p = getPricing();
  const opts = [
    { mins: 20, label: '20 Min', price: p.price20, desc: 'Quick potty break' },
    { mins: 30, label: '30 Min', price: p.price30, desc: 'Standard walk', popular: true },
    { mins: 60, label: '60 Min', price: p.price60, desc: 'Full adventure' },
  ];
  el.innerHTML = opts.map(o => `
    <div onclick="pickDuration(${o.mins})" id="dur-${o.mins}"
      style="flex:1;border:2px solid ${_selectedDuration===o.mins?'var(--amber)':'var(--linen)'};
      background:${_selectedDuration===o.mins?'var(--amber-pale)':'#fff'};
      border-radius:12px;padding:14px 10px;text-align:center;cursor:pointer;transition:all .15s;position:relative">
      ${o.popular?'<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--amber);color:#fff;font-size:.65rem;font-weight:700;padding:2px 10px;border-radius:100px;white-space:nowrap">Most Popular</div>':''}
      <div style="font-weight:700;font-size:1rem;margin-bottom:3px">${o.label}</div>
      <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:900;color:var(--amber)">${fmt.money(o.price)}</div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:2px">${o.desc}</div>
    </div>`).join('');
}

function pickDuration(mins) {
  _selectedDuration = mins;
  _appliedPromo = null;
  renderDurationSelector();
  updateSummary();
}

/* ── Dogs selector ────────────────────────────────── */
async function loadBookDogs() {
  const el = document.getElementById('book-dogs');
  if (!el) return;
  try {
    const d = await api('/clients/dogs');
    if (!d.dogs.length) {
      el.innerHTML = '<p class="text-muted" style="font-size:.875rem">No dogs yet. <a href="#" data-section="dogs">Add a dog first.</a></p>';
      return;
    }
    el.innerHTML = d.dogs.map(dog => {
      const photoHtml = dog.profilePhoto
        ? `<img src="${dog.profilePhoto}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0">`
        : `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--amber),var(--sage));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0">${dog.name[0]}</div>`;
      return `
        <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid var(--linen);border-radius:8px;cursor:pointer;margin-bottom:8px;transition:border-color .15s" id="dog-lbl-${dog._id}">
          <input type="checkbox" value="${dog._id}" onchange="toggleDog('${dog._id}',this.checked)">
          ${photoHtml}
          <div>
            <div style="font-weight:600">${dog.name}</div>
            <div style="font-size:.78rem;color:var(--muted)">${dog.breed||'Mixed'} · ${dog.size}</div>
          </div>
        </label>`;
    }).join('');
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

/* ── Walker selector ──────────────────────────────── */
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
      ${d.walkers.map(w => `
        <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid var(--linen);border-radius:8px;cursor:pointer;margin-bottom:8px" id="walker-lbl-${w._id}">
          <input type="radio" name="bk-walker" value="${w._id}" ${_selectedWalker===w._id?'checked':''} onchange="pickWalker('${w._id}')">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--amber),var(--sage));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.78rem;flex-shrink:0">${avatar(w.firstName,w.lastName)}</div>
          <div>
            <div style="font-weight:600">${w.firstName} ${w.lastName}</div>
            <div style="font-size:.78rem;color:var(--muted)">⭐ ${fmt.rating(w.walkerProfile?.averageRating)} · ${w.walkerProfile?.totalWalks||0} walks</div>
          </div>
        </label>`).join('')}`;
  } catch(e) { console.error(e); }
}

function pickWalker(id) {
  _selectedWalker = id || null;
  document.querySelectorAll('[id^="walker-lbl-"]').forEach(l => l.style.borderColor = 'var(--linen)');
  const active = document.getElementById(`walker-lbl-${id||'any'}`);
  if (active) active.style.borderColor = 'var(--amber)';
  if (_selectedDate) loadSlots(_selectedDate);
  updateSummary();
}

/* ── Calendar ─────────────────────────────────────── */
function renderCal() {
  const el = document.getElementById('book-cal');
  if (!el) return;
  const firstDay    = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMonth = new Date(_calYear, _calMonth+1, 0).getDate();
  const today       = new Date(); today.setHours(0,0,0,0);
  const monthLabel  = new Date(_calYear, _calMonth).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const dayHeaders  = ['S','M','T','W','T','F','S'].map(d=>`<div class="cal-dh">${d}</div>`).join('');
  const blanks      = Array(firstDay).fill('<div></div>').join('');
  const cells       = Array.from({length:daysInMonth},(_,i) => {
    const day=i+1, dateObj=new Date(_calYear,_calMonth,day);
    const dateStr=dateObj.toISOString().split('T')[0];
    const isPast=dateObj<today, isSel=dateStr===_selectedDate, isToday=dateObj.getTime()===today.getTime();
    return `<div class="cal-day${isToday?' today':''}${isSel?' selected':''}${isPast?' past':''}" data-date="${dateStr}">${day}</div>`;
  }).join('');

  el.innerHTML = `
    <div class="cal-hd">
      <button class="btn btn-ghost btn-sm" id="cal-prev">‹</button>
      <strong>${monthLabel}</strong>
      <button class="btn btn-ghost btn-sm" id="cal-next">›</button>
    </div>
    <div class="cal-grid">${dayHeaders}${blanks}${cells}</div>`;

  el.querySelector('#cal-prev').onclick = () => { if(_calMonth===0){_calMonth=11;_calYear--;}else _calMonth--; renderCal(); };
  el.querySelector('#cal-next').onclick = () => { if(_calMonth===11){_calMonth=0;_calYear++;}else _calMonth++; renderCal(); };
  el.querySelectorAll('.cal-day:not(.past)').forEach(day => {
    day.addEventListener('click', () => {
      _selectedDate = day.dataset.date; _selectedSlot = null;
      el.querySelectorAll('.cal-day').forEach(d=>d.classList.remove('selected'));
      day.classList.add('selected');
      loadSlots(_selectedDate); updateSummary();
    });
  });
}

/* ── Time slots ───────────────────────────────────── */
async function loadSlots(dateStr) {
  const el = document.getElementById('book-slots');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--muted);font-size:.82rem">Loading…</p>';
  try {
    const params = _selectedWalker ? `?date=${dateStr}&walkerId=${_selectedWalker}` : `?date=${dateStr}`;
    const d = await api(`/bookings/available-slots${params}`);
    if (!d.slots.length) { el.innerHTML='<p class="empty">No slots for this date.</p>'; return; }
    el.innerHTML = d.slots.map(s => `
      <div class="slot${!s.available?' off':''}" data-start="${s.startTime}" data-end="${s.endTime}"
        onclick="${s.available?`pickSlot('${s.startTime}','${s.endTime}',this)`:''}">${s.startTime}</div>`
    ).join('');
  } catch(e) { el.innerHTML=`<p style="color:var(--danger);font-size:.82rem">${e.message}</p>`; }
}

function pickSlot(start, end, el) {
  _selectedSlot = { startTime: start, endTime: end };
  document.querySelectorAll('.slot').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  updateSummary();
}

/* ── Summary ──────────────────────────────────────── */
function updateSummary() {
  const el = document.getElementById('book-summary');
  if (!el) return;
  const { base, extra, sub, disc, total } = calcTotal();

  el.innerHTML = `
    <div style="background:var(--cream-2);border-radius:12px;padding:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Duration</span><strong>${_selectedDuration} min walk</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Date</span><strong>${_selectedDate||'—'}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Time</span><strong>${_selectedSlot?_selectedSlot.startTime:'—'}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted)">Dogs</span><strong>${_selectedDogs.length||'—'}</strong></div>
      <hr style="border:none;border-top:1px solid var(--linen);margin:10px 0">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>${_selectedDuration}-min walk</span><span>${fmt.money(base)}</span></div>
      ${extra?`<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Extra dog ×${_selectedDogs.length-1}</span><span>${fmt.money(extra)}</span></div>`:''}
      ${disc?`<div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--success)"><span>🏷️ Promo (${_appliedPromo.code})</span><span>-${fmt.money(disc)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem;margin-top:8px"><span>Total</span><span style="color:var(--amber)">${fmt.money(total)}</span></div>
    </div>`;

  const btn = document.getElementById('confirm-btn');
  if (btn) btn.textContent = `Review & Pay — ${fmt.money(total)}`;
}

/* ── Confirm → open checkout modal ───────────────── */
function confirmBooking() {
  if (!_selectedDogs.length) { showAlert('book-alert','Please select at least one dog.'); return; }
  if (!_selectedDate)         { showAlert('book-alert','Please select a date.'); return; }
  if (!_selectedSlot)         { showAlert('book-alert','Please select a time slot.'); return; }

  const { base, extra, sub, disc, total } = calcTotal();

  // Populate checkout modal summary
  document.getElementById('co-summary').innerHTML = `
    <div style="background:var(--cream-2);border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="color:var(--muted)">Walk</span><strong>${_selectedDuration} min</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="color:var(--muted)">Date</span><strong>${fmt.date(_selectedDate)}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="color:var(--muted)">Time</span><strong>${_selectedSlot.startTime}</strong></div>
      <hr style="border:none;border-top:1px solid var(--linen);margin:8px 0">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>${_selectedDuration}-min walk</span><span>${fmt.money(base)}</span></div>
      ${extra?`<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Extra dog</span><span>${fmt.money(extra)}</span></div>`:''}
      ${disc?`<div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--success);font-weight:600"><span>🏷️ Promo (${_appliedPromo.code})</span><span>-${fmt.money(disc)}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.15rem;margin-top:6px">
        <span>Total Due</span><span style="color:var(--amber)">${fmt.money(total)}</span>
      </div>
    </div>`;

  // Pre-fill promo field if already applied
  const promoInput = document.getElementById('co-promo-input');
  if (promoInput && _appliedPromo) {
    promoInput.value = _appliedPromo.code;
    promoInput.disabled = true;
    document.getElementById('co-promo-msg').innerHTML =
      `<span style="color:var(--success);font-size:.82rem">✓ ${_appliedPromo.code} applied — -${fmt.money(disc)}</span>`;
  }

  document.getElementById('co-total').textContent = fmt.money(total);
  document.getElementById('co-total-btn').textContent = fmt.money(total);
  document.getElementById('checkout-overlay').classList.remove('hidden');
}

/* ── Promo code apply (from modal) ────────────────── */
function applyPromoCode() {
  const input = document.getElementById('co-promo-input');
  const msg   = document.getElementById('co-promo-msg');
  const code  = (input?.value || '').trim().toUpperCase();
  if (!code) { msg.innerHTML = '<span style="color:var(--danger);font-size:.82rem">Enter a promo code.</span>'; return; }

  const promos = getPromoCodes();
  const promo  = promos.find(p => p.code.toUpperCase() === code && p.active);
  if (!promo) {
    msg.innerHTML = '<span style="color:var(--danger);font-size:.82rem">Invalid or expired promo code.</span>';
    _appliedPromo = null;
    return;
  }

  const { sub } = calcTotal();
  let discountCents = 0;
  if (promo.type === 'percent') discountCents = Math.round(sub * promo.value / 100);
  if (promo.type === 'fixed')   discountCents = Math.min(promo.value * 100, sub);

  _appliedPromo = { ...promo, discountCents };
  const newTotal = Math.max(0, sub - discountCents);

  msg.innerHTML = `<span style="color:var(--success);font-size:.82rem">✓ Applied! You save ${fmt.money(discountCents)}</span>`;
  input.disabled = true;
  document.getElementById('co-total').textContent    = fmt.money(newTotal);
  document.getElementById('co-total-btn').textContent = fmt.money(newTotal);

  // Update summary in modal
  const summaryEl = document.getElementById('co-summary');
  const discRow = summaryEl.querySelector('.promo-row');
  if (!discRow) {
    const totRow = summaryEl.querySelector('.co-total-row');
    if (totRow) totRow.insertAdjacentHTML('beforebegin',
      `<div class="promo-row" style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--success);font-weight:600"><span>🏷️ Promo (${code})</span><span>-${fmt.money(discountCents)}</span></div>`);
    if (totRow) totRow.querySelector('span:last-child').textContent = fmt.money(newTotal);
  }
  updateSummary();
}

function removePromo() {
  _appliedPromo = null;
  const input = document.getElementById('co-promo-input');
  if (input) { input.value = ''; input.disabled = false; }
  const msg = document.getElementById('co-promo-msg');
  if (msg) msg.innerHTML = '';
  const { total } = calcTotal();
  document.getElementById('co-total').textContent    = fmt.money(total);
  document.getElementById('co-total-btn').textContent = fmt.money(total);
  updateSummary();
}

/* ── Place booking (called from modal) ───────────── */
async function placeBooking() {
  const btn = document.getElementById('place-order-btn');
  btn.disabled = true; btn.textContent = 'Booking…';

  const { base, extra, disc, total } = calcTotal();
  const endTime = calcEndTime(_selectedSlot.startTime, _selectedDuration);

  try {
    const currentUser = getUser();
    await api('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        walkerId:            _selectedWalker || undefined,
        dogIds:              _selectedDogs,
        scheduledDate:       _selectedDate,
        startTime:           _selectedSlot.startTime,
        endTime,
        durationMinutes:     _selectedDuration,
        pickupAddress:       currentUser?.address || { street: '—', city: 'Naperville', state: 'IL' },
        specialInstructions: document.getElementById('book-notes')?.value || '',
        basePrice:           base,
        addOnPrice:          extra,
        discountAmount:      disc,
        promoCode:           _appliedPromo?.code || undefined,
        totalPrice:          total,
      }),
    });

    document.getElementById('checkout-form').innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:3rem;margin-bottom:14px">🎉</div>
        <h3 style="font-family:var(--font-display);margin-bottom:8px">Walk Booked!</h3>
        <p style="color:var(--muted)">Your walker will confirm shortly. You'll see it in My Bookings.</p>
        ${disc ? `<p style="color:var(--success);margin-top:8px;font-weight:600">You saved ${fmt.money(disc)} with your promo code!</p>` : ''}
      </div>`;

    _selectedDogs=[]; _selectedDate=null; _selectedSlot=null;
    _selectedWalker=null; _selectedDuration=30; _appliedPromo=null;
    updateSummary(); renderDurationSelector();

    setTimeout(() => {
      closeCheckout();
      document.querySelector('[data-section="bookings"]')?.click();
    }, 2500);

  } catch(e) {
    document.getElementById('co-alert').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    btn.disabled = false; btn.textContent = `Pay ${document.getElementById('co-total').textContent}`;
  }
}

function closeCheckout() {
  document.getElementById('checkout-overlay').classList.add('hidden');
  document.getElementById('co-alert').innerHTML = '';
  const btn = document.getElementById('place-order-btn');
  if (btn) { btn.disabled=false; btn.textContent='Confirm Booking'; }
}

function calcEndTime(startTime, durationMins) {
  const [h,m] = startTime.split(':').map(Number);
  const t = h*60+m+durationMins;
  return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
}


// Pricing — matches admin-configurable values stored in localStorage
function getPricing() {
  try {
    const saved = localStorage.getItem('ww_pricing');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return { price20: 1000, price30: 2000, price60: 4000, extraDog: 500 };
}

function getDurationPrice() {
  const p = getPricing();
  if (_selectedDuration === 20) return p.price20;
  if (_selectedDuration === 60) return p.price60;
  return p.price30;
}

/* ── Entry point ──────────────────────────────────── */
async function initBook() {
  if (window._preselectedWalker) {
    _selectedWalker = window._preselectedWalker;
    window._preselectedWalker = null;
  }
  const now = new Date();
  _calYear  = now.getFullYear();
  _calMonth = now.getMonth();

  await Promise.all([loadBookDogs(), loadBookWalkers()]);
  renderDurationSelector();
  renderCal();
  updateSummary();
}

/* ── Duration selector ────────────────────────────── */
function renderDurationSelector() {
  const el = document.getElementById('book-duration');
  if (!el) return;
  const p = getPricing();
  const opts = [
    { mins: 20, label: '20 Min', price: p.price20, desc: 'Quick potty break' },
    { mins: 30, label: '30 Min', price: p.price30, desc: 'Standard walk', popular: true },
    { mins: 60, label: '60 Min', price: p.price60, desc: 'Full adventure' },
  ];
  el.innerHTML = opts.map(o => `
    <div onclick="pickDuration(${o.mins})" id="dur-${o.mins}"
      style="flex:1;border:2px solid ${_selectedDuration===o.mins?'var(--amber)':'var(--linen)'};
      background:${_selectedDuration===o.mins?'var(--amber-pale)':'#fff'};
      border-radius:12px;padding:14px 10px;text-align:center;cursor:pointer;transition:all .15s;position:relative">
      ${o.popular ? '<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--amber);color:#fff;font-size:.65rem;font-weight:700;padding:2px 10px;border-radius:100px;white-space:nowrap">Most Popular</div>' : ''}
      <div style="font-weight:700;font-size:1rem;margin-bottom:3px">${o.label}</div>
      <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:900;color:var(--amber)">${fmt.money(o.price)}</div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:2px">${o.desc}</div>
    </div>`).join('');
}

function pickDuration(mins) {
  _selectedDuration = mins;
  renderDurationSelector();
  updateSummary();
}

/* ── Dogs selector ────────────────────────────────── */
async function loadBookDogs() {
  const el = document.getElementById('book-dogs');
  if (!el) return;
  try {
    const d = await api('/clients/dogs');
    if (!d.dogs.length) {
      el.innerHTML = '<p class="text-muted" style="font-size:.875rem">No dogs yet. <a href="#" data-section="dogs">Add a dog first.</a></p>';
      return;
    }
    el.innerHTML = d.dogs.map(dog => {
      const photoHtml = dog.profilePhoto
        ? `<img src="${dog.profilePhoto}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0">`
        : `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--amber),var(--sage));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0">${dog.name[0]}</div>`;
      return `
        <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid var(--linen);border-radius:8px;cursor:pointer;margin-bottom:8px;transition:border-color .15s" id="dog-lbl-${dog._id}">
          <input type="checkbox" value="${dog._id}" onchange="toggleDog('${dog._id}',this.checked)">
          ${photoHtml}
          <div>
            <div style="font-weight:600">${dog.name}</div>
            <div style="font-size:.78rem;color:var(--muted)">${dog.breed||'Mixed'} · ${dog.size}</div>
          </div>
        </label>`;
    }).join('');
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

/* ── Walker selector ──────────────────────────────── */
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
      ${d.walkers.map(w => `
        <label style="display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid var(--linen);border-radius:8px;cursor:pointer;margin-bottom:8px" id="walker-lbl-${w._id}">
          <input type="radio" name="bk-walker" value="${w._id}" ${_selectedWalker===w._id?'checked':''} onchange="pickWalker('${w._id}')">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--amber),var(--sage));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.78rem;flex-shrink:0">${avatar(w.firstName,w.lastName)}</div>
          <div>
            <div style="font-weight:600">${w.firstName} ${w.lastName}</div>
            <div style="font-size:.78rem;color:var(--muted)">⭐ ${fmt.rating(w.walkerProfile?.averageRating)} · ${w.walkerProfile?.totalWalks||0} walks</div>
          </div>
        </label>`).join('')}`;
  } catch(e) { console.error(e); }
}

function pickWalker(id) {
  _selectedWalker = id || null;
  // Highlight selected walker label
  document.querySelectorAll('[id^="walker-lbl-"]').forEach(l => l.style.borderColor = 'var(--linen)');
  const active = document.getElementById(`walker-lbl-${id||'any'}`);
  if (active) active.style.borderColor = 'var(--amber)';
  if (_selectedDate) loadSlots(_selectedDate);
  updateSummary();
}

/* ── Calendar ─────────────────────────────────────── */
function renderCal() {
  const el = document.getElementById('book-cal');
  if (!el) return;

  const firstDay    = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMonth = new Date(_calYear, _calMonth+1, 0).getDate();
  const today       = new Date(); today.setHours(0,0,0,0);
  const monthLabel  = new Date(_calYear, _calMonth).toLocaleDateString('en-US',{month:'long',year:'numeric'});

  const dayHeaders = ['S','M','T','W','T','F','S'].map(d=>`<div class="cal-dh">${d}</div>`).join('');
  const blanks     = Array(firstDay).fill('<div></div>').join('');
  const cells      = Array.from({length:daysInMonth},(_,i) => {
    const day     = i+1;
    const dateObj = new Date(_calYear, _calMonth, day);
    const dateStr = dateObj.toISOString().split('T')[0];
    const isPast  = dateObj < today;
    const isSel   = dateStr === _selectedDate;
    const isToday = dateObj.getTime() === today.getTime();
    return `<div class="cal-day${isToday?' today':''}${isSel?' selected':''}${isPast?' past':''}" data-date="${dateStr}">${day}</div>`;
  }).join('');

  el.innerHTML = `
    <div class="cal-hd">
      <button class="btn btn-ghost btn-sm" id="cal-prev">‹</button>
      <strong>${monthLabel}</strong>
      <button class="btn btn-ghost btn-sm" id="cal-next">›</button>
    </div>
    <div class="cal-grid">${dayHeaders}${blanks}${cells}</div>`;

  el.querySelector('#cal-prev').onclick = () => {
    if (_calMonth === 0) { _calMonth=11; _calYear--; } else _calMonth--;
    renderCal();
  };
  el.querySelector('#cal-next').onclick = () => {
    if (_calMonth === 11) { _calMonth=0; _calYear++; } else _calMonth++;
    renderCal();
  };
  el.querySelectorAll('.cal-day:not(.past)').forEach(day => {
    day.addEventListener('click', () => {
      _selectedDate = day.dataset.date;
      _selectedSlot = null;
      el.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
      day.classList.add('selected');
      loadSlots(_selectedDate);
      updateSummary();
    });
  });
}

/* ── Time slots ───────────────────────────────────── */
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
    el.innerHTML = d.slots.map(s => `
      <div class="slot${!s.available?' off':''}" data-start="${s.startTime}" data-end="${s.endTime}"
        onclick="${s.available?`pickSlot('${s.startTime}','${s.endTime}',this)`:''}">${s.startTime}</div>`
    ).join('');
  } catch(e) { el.innerHTML=`<p style="color:var(--danger);font-size:.82rem">${e.message}</p>`; }
}

function pickSlot(start, end, el) {
  _selectedSlot = { startTime: start, endTime: end };
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  updateSummary();
}

/* ── Summary ──────────────────────────────────────── */
function updateSummary() {
  const el = document.getElementById('book-summary');
  if (!el) return;
  const p     = getPricing();
  const base  = getDurationPrice();
  const extra = Math.max(0, _selectedDogs.length - 1) * p.extraDog;
  const total = base + extra;

  el.innerHTML = `
    <div style="background:var(--cream-2);border-radius:12px;padding:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:var(--muted)">Duration</span>
        <strong>${_selectedDuration} min walk</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:var(--muted)">Date</span>
        <strong>${_selectedDate||'—'}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:var(--muted)">Time</span>
        <strong>${_selectedSlot?`${_selectedSlot.startTime}`:'—'}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:var(--muted)">Dogs</span>
        <strong>${_selectedDogs.length||'—'}</strong>
      </div>
      <hr style="border:none;border-top:1px solid var(--linen);margin:10px 0">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span>${_selectedDuration}-min walk</span><span>${fmt.money(base)}</span>
      </div>
      ${extra ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Extra dog ×${_selectedDogs.length-1}</span><span>${fmt.money(extra)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem;margin-top:8px">
        <span>Total</span><span style="color:var(--amber)">${fmt.money(total)}</span>
      </div>
    </div>`;

  const btn = document.getElementById('confirm-btn');
  if (btn) btn.textContent = `Review & Pay — ${fmt.money(total)}`;
}

/* ── Confirm → open checkout modal ───────────────── */
function confirmBooking() {
  if (!_selectedDogs.length) { showAlert('book-alert','Please select at least one dog.'); return; }
  if (!_selectedDate)         { showAlert('book-alert','Please select a date.'); return; }
  if (!_selectedSlot)         { showAlert('book-alert','Please select a time slot.'); return; }

  const p     = getPricing();
  const base  = getDurationPrice();
  const extra = Math.max(0, _selectedDogs.length - 1) * p.extraDog;
  const total = base + extra;

  // Reset any previous promo
  if (typeof _appliedPromo !== 'undefined') window._appliedPromo = null;
  const promoResult = document.getElementById('promo-result');
  if (promoResult) promoResult.innerHTML = '';
  const promoInput = document.getElementById('co-promo');
  if (promoInput) promoInput.value = '';

  // Populate checkout modal summary
  document.getElementById('co-summary').innerHTML = `
    <div style="background:var(--cream-2);border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="color:var(--muted)">Walk</span><strong>${_selectedDuration} min</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="color:var(--muted)">Date</span><strong>${fmt.date(_selectedDate)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="color:var(--muted)">Time</span><strong>${_selectedSlot.startTime}</strong>
      </div>
      ${extra ? `<div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="color:var(--muted)">Extra dog</span><strong>+${fmt.money(extra)}</strong></div>` : ''}
      <hr style="border:none;border-top:1px solid var(--linen);margin:8px 0">
      <div id="co-total-row" style="display:flex;justify-content:space-between;font-weight:700;font-size:1.15rem">
        <span>Total Due</span><span style="color:var(--amber)">${fmt.money(total)}</span>
      </div>
    </div>`;

  document.getElementById('co-total').textContent = fmt.money(total);
  const btn = document.getElementById('place-order-btn');
  if (btn) btn.textContent = `Confirm Booking — ${fmt.money(total)}`;
  document.getElementById('checkout-overlay').classList.remove('hidden');
}

/* ── Place booking (called from modal) ───────────── */
async function placeBooking() {
  const btn = document.getElementById('place-order-btn');
  btn.disabled = true; btn.textContent = 'Booking…';

  const p        = getPricing();
  const base     = getDurationPrice();
  const extra    = Math.max(0, _selectedDogs.length - 1) * p.extraDog;
  const subtotal = base + extra;
  const discount = (typeof _appliedPromo !== 'undefined' && _appliedPromo) ? _appliedPromo.discount : 0;
  const total    = subtotal - discount;
  const endTime  = calcEndTime(_selectedSlot.startTime, _selectedDuration);

  try {
    const currentUser = getUser();
    await api('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        walkerId:            _selectedWalker || undefined,
        dogIds:              _selectedDogs,
        scheduledDate:       _selectedDate,
        startTime:           _selectedSlot.startTime,
        endTime,
        durationMinutes:     _selectedDuration,
        pickupAddress:       currentUser?.address || { street: '—', city: 'Naperville', state: 'IL' },
        specialInstructions: document.getElementById('book-notes')?.value || '',
        basePrice:           base,
        addOnPrice:          extra,
        totalPrice:          total,
        promoCode:           (typeof _appliedPromo !== 'undefined' && _appliedPromo) ? _appliedPromo.code : undefined,
        promoDiscount:       discount,
      }),
    });

    // Show success in modal
    document.getElementById('checkout-form').innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:3rem;margin-bottom:14px">🎉</div>
        <h3 style="font-family:var(--font-display);margin-bottom:8px">Walk Booked!</h3>
        <p style="color:var(--muted)">Your walker will confirm shortly. You'll see it in My Bookings.</p>
        ${discount ? `<p style="color:var(--success);font-weight:600;margin-top:6px">You saved ${fmt.money(discount)} with your promo code!</p>` : ''}
      </div>`;

    _selectedDogs = []; _selectedDate = null; _selectedSlot = null;
    _selectedWalker = null; _selectedDuration = 30;
    if (typeof _appliedPromo !== 'undefined') window._appliedPromo = null;
    updateSummary(); renderDurationSelector();

    setTimeout(() => {
      closeCheckout();
      document.querySelector('[data-section="bookings"]')?.click();
    }, 2500);

  } catch(e) {
    document.getElementById('co-alert').innerHTML = `<div class="alert alert-error">${e.message}</div>`;
    btn.disabled = false; btn.textContent = `Pay ${document.getElementById('co-total').textContent}`;
  }
}

function closeCheckout() {
  document.getElementById('checkout-overlay').classList.add('hidden');
  const alertEl = document.getElementById('co-alert');
  if (alertEl) alertEl.innerHTML = '';
  const promoEl = document.getElementById('promo-result');
  if (promoEl) promoEl.innerHTML = '';
  const promoInput = document.getElementById('co-promo');
  if (promoInput) promoInput.value = '';
  if (typeof _appliedPromo !== 'undefined') window._appliedPromo = null;
  const btn = document.getElementById('place-order-btn');
  if (btn) { btn.disabled = false; }
}

/* ── Helper: calculate end time ───────────────────── */
function calcEndTime(startTime, durationMins) {
  const [h, m] = startTime.split(':').map(Number);
  const total  = h * 60 + m + durationMins;
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
