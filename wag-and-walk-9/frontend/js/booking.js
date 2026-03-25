/* ═══════════════════════════════════════════════
   booking.js — Calendar + booking flow
   ═══════════════════════════════════════════════ */

let currentMonth, currentYear, selectedDate, selectedSlot, selectedWalker;

function initCalendar(containerId, onDateSelect) {
  const now = new Date();
  currentMonth = now.getMonth();
  currentYear  = now.getFullYear();

  renderCalendar(containerId, onDateSelect);
}

function renderCalendar(containerId, onDateSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const first   = new Date(currentYear, currentMonth, 1);
  const last    = new Date(currentYear, currentMonth + 1, 0);
  const startDay = first.getDay();
  const daysInMonth = last.getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  let html = `
    <div class="calendar-header">
      <button class="btn btn-ghost btn-sm" onclick="prevMonth('${containerId}', ${!!onDateSelect})">&lt;</button>
      <h3>${monthNames[currentMonth]} ${currentYear}</h3>
      <button class="btn btn-ghost btn-sm" onclick="nextMonth('${containerId}', ${!!onDateSelect})">&gt;</button>
    </div>
    <div class="calendar-grid">
      <div class="cal-day-name">Sun</div><div class="cal-day-name">Mon</div>
      <div class="cal-day-name">Tue</div><div class="cal-day-name">Wed</div>
      <div class="cal-day-name">Thu</div><div class="cal-day-name">Fri</div>
      <div class="cal-day-name">Sat</div>
  `;

  // Empty slots before first day
  for (let i = 0; i < startDay; i++) {
    html += `<div class="cal-day other-month"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(currentYear, currentMonth, d);
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();
    const isSelected = selectedDate && date.toDateString() === new Date(selectedDate).toDateString();

    const classes = ['cal-day'];
    if (isPast) classes.push('disabled');
    if (isToday) classes.push('today');
    if (isSelected) classes.push('selected');

    const dateStr = date.toISOString().split('T')[0];
    const onclick = isPast ? '' : `onclick="selectDate('${dateStr}', '${containerId}')"`;

    html += `<div class="${classes.join(' ')}" ${onclick}>${d}</div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

function selectDate(dateStr, containerId) {
  selectedDate = dateStr;
  selectedSlot = null;
  renderCalendar(containerId);
  if (typeof onDateSelected === 'function') onDateSelected(dateStr);
  loadTimeSlots(dateStr);
}

function prevMonth(containerId) {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar(containerId);
}

function nextMonth(containerId) {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar(containerId);
}

async function loadTimeSlots(date, walkerId) {
  const container = document.getElementById('time-slots');
  if (!container) return;

  container.innerHTML = '<div class="spinner"></div>';

  try {
    let url = `/bookings/available-slots?date=${date}`;
    if (walkerId) url += `&walkerId=${walkerId}`;

    const data = await api(url);
    if (!data.slots || data.slots.length === 0) {
      container.innerHTML = '<p class="text-muted">No slots available for this date.</p>';
      return;
    }

    container.innerHTML = `
      <div class="slots-grid">
        ${data.slots.map(s => `
          <div class="slot ${s.available ? '' : 'slot-taken'} ${selectedSlot === s.startTime ? 'slot-selected' : ''}"
               ${s.available ? `onclick="selectSlot('${s.startTime}', '${s.endTime}')"` : ''}>
            ${formatTime(s.startTime)}
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-muted">Error loading slots: ${err.message}</p>`;
  }
}

function selectSlot(start, end) {
  selectedSlot = start;
  // Re-render slots
  document.querySelectorAll('.slot').forEach(el => {
    el.classList.toggle('slot-selected', el.textContent.trim() === formatTime(start));
  });
  // Store end time
  window._selectedEnd = end;
}

async function loadWalkers(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const data = await api('/walkers?available=true');
    if (!data.walkers.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">🦮</div><h3>No walkers available</h3><p>Check back later!</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="walker-grid">
        ${data.walkers.map(w => {
          const initials = (w.firstName?.[0] || '') + (w.lastName?.[0] || '');
          const wp = w.walkerProfile || {};
          return `
            <div class="walker-card" onclick="selectWalkerForBooking('${w._id}')" style="cursor:pointer;${selectedWalker === w._id ? 'border:2px solid var(--amber);' : ''}">
              <div class="walker-avatar">${initials}</div>
              <h3>${w.firstName} ${w.lastName}</h3>
              <div class="walker-rating">⭐ ${(wp.averageRating || 0).toFixed(1)} · ${wp.totalWalks || 0} walks</div>
              <p class="walker-bio">${wp.bio || 'No bio yet.'}</p>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-muted">Error: ${err.message}</p>`;
  }
}

function selectWalkerForBooking(id) {
  selectedWalker = id;
  // Re-render with highlight
  document.querySelectorAll('.walker-card').forEach(el => {
    el.style.border = el.getAttribute('onclick')?.includes(id)
      ? '2px solid var(--amber)' : '';
  });
  // If date selected, reload slots for this walker
  if (selectedDate) loadTimeSlots(selectedDate, id);
}

async function submitBooking(dogIds) {
  if (!selectedDate)   { showToast('Please select a date', 'error'); return; }
  if (!selectedSlot)   { showToast('Please select a time slot', 'error'); return; }
  if (!dogIds?.length) { showToast('Please select at least one dog', 'error'); return; }

  const user = getUser();
  const body = {
    dogIds,
    scheduledDate: selectedDate,
    startTime: selectedSlot,
    endTime: window._selectedEnd || (parseInt(selectedSlot) + 1 + ':00'),
    durationMinutes: 60,
    pickupAddress: user.address || { city: 'Naperville', state: 'IL', zip: '60540' },
  };
  if (selectedWalker) body.walkerId = selectedWalker;

  try {
    const data = await api('/bookings', { method: 'POST', body });
    showToast('Walk booked successfully!', 'success');
    return data.booking;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}
