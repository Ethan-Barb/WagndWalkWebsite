/* tips.js — tip modal logic */
'use strict';

let _tipBookingId = null;
let _tipAmount    = null;

function openTip(bookingId) {
  _tipBookingId = bookingId;
  _tipAmount    = null;
  document.querySelectorAll('.tip-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('custom-tip-wrap').classList.add('hidden');
  document.getElementById('custom-tip').value = '';
  document.getElementById('tip-alert').innerHTML = '';
  document.getElementById('tip-overlay').classList.remove('hidden');
}

function closeTip() {
  document.getElementById('tip-overlay').classList.add('hidden');
  _tipBookingId = null;
  _tipAmount    = null;
}

function selectTip(cents, btn) {
  document.querySelectorAll('.tip-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if (cents === 'custom') {
    _tipAmount = null;
    document.getElementById('custom-tip-wrap').classList.remove('hidden');
  } else {
    _tipAmount = cents;
    document.getElementById('custom-tip-wrap').classList.add('hidden');
  }
}

async function sendTip() {
  // Resolve custom amount
  if (_tipAmount === null) {
    const val = parseFloat(document.getElementById('custom-tip').value);
    if (!val || val < 1) { showAlert('tip-alert','Enter a valid tip amount.'); return; }
    _tipAmount = Math.round(val * 100);
  }
  if (!_tipBookingId) return;

  const btn = document.getElementById('send-tip-btn');
  btn.disabled = true; btn.textContent = 'Sending…';

  try {
    await api(`/bookings/${_tipBookingId}/tip`, {
      method: 'POST',
      body: JSON.stringify({ amount: _tipAmount }),
    });
    closeTip();
    alert(`🎉 Tip of ${fmt.money(_tipAmount)} sent! Thank you for supporting your walker.`);
    if (typeof loadBookings === 'function') loadBookings('completed');
  } catch(e) {
    showAlert('tip-alert', e.message);
    btn.disabled = false; btn.textContent = 'Send Tip';
  }
}
