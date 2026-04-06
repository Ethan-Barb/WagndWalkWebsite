/* ═══════════════════════════════════════════════
   tips.js — Tip modal + submission
   ═══════════════════════════════════════════════ */

let tipBookingId = null;
let tipAmount = 0;

function openTipModal(bookingId, walkerName) {
  tipBookingId = bookingId;
  tipAmount = 0;

  // Create or show modal
  let overlay = document.getElementById('tip-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tip-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>💰 Leave a Tip</h2>
        <p id="tip-walker-name">Thank your walker for a great job!</p>
        <div class="tip-options">
          <div class="tip-option" onclick="selectTip(200)">$2</div>
          <div class="tip-option" onclick="selectTip(500)">$5</div>
          <div class="tip-option" onclick="selectTip(1000)">$10</div>
          <div class="tip-option" onclick="selectTip(0)">Custom</div>
        </div>
        <div id="custom-tip-wrap" style="display:none" class="form-group">
          <label>Custom amount ($)</label>
          <input type="number" id="custom-tip-input" min="1" max="100" step="1" placeholder="Enter amount">
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary btn-full" id="submit-tip-btn" onclick="submitTip()">Send Tip</button>
          <button class="btn btn-secondary btn-full" onclick="closeTipModal()">Skip</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  document.getElementById('tip-walker-name').textContent =
    walkerName ? `Say thanks to ${walkerName}!` : 'Thank your walker for a great job!';

  overlay.classList.add('active');
}

function closeTipModal() {
  const overlay = document.getElementById('tip-modal-overlay');
  if (overlay) overlay.classList.remove('active');
  tipBookingId = null;
  tipAmount = 0;
}

function selectTip(amount) {
  tipAmount = amount;
  document.querySelectorAll('.tip-option').forEach((el, i) => {
    el.classList.toggle('selected', (i === 3 && amount === 0) ||
      (amount > 0 && parseInt(el.textContent.replace('$', '')) * 100 === amount));
  });

  const customWrap = document.getElementById('custom-tip-wrap');
  if (amount === 0) {
    customWrap.style.display = 'block';
    document.getElementById('custom-tip-input').focus();
  } else {
    customWrap.style.display = 'none';
  }
}

async function submitTip() {
  let amount = tipAmount;
  if (amount === 0) {
    const custom = parseFloat(document.getElementById('custom-tip-input')?.value);
    if (!custom || custom <= 0) {
      showToast('Please enter a valid tip amount', 'error');
      return;
    }
    amount = Math.round(custom * 100); // convert to cents
  }

  const btn = document.getElementById('submit-tip-btn');
  btn.textContent = 'Sending…'; btn.disabled = true;

  try {
    await api(`/bookings/${tipBookingId}/tip`, {
      method: 'POST',
      body: { amount },
    });
    showToast(`Tip of ${formatCents(amount)} sent! 🎉`, 'success');
    closeTipModal();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.textContent = 'Send Tip'; btn.disabled = false;
  }
}
