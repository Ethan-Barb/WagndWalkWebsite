/* ═══════════════════════════════════════════════
   dashboard.js — Shared dashboard utilities
   ═══════════════════════════════════════════════ */

/* ── Mobile sidebar ───────────────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('open');
}

/* ── Section router (hash-based) ──────────────── */
function initSectionRouter(sections) {
  function showSection() {
    const hash = location.hash.replace('#', '') || sections[0];
    sections.forEach(s => {
      const el = document.getElementById(`section-${s}`);
      if (el) el.style.display = s === hash ? 'block' : 'none';
    });
    // Update sidebar active
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href')?.endsWith('#' + hash) ||
        (!location.hash && a.getAttribute('href')?.endsWith(location.pathname)));
    });
  }
  window.addEventListener('hashchange', showSection);
  showSection();
}

/* ── Review modal ─────────────────────────────── */
let reviewBookingId = null;
let reviewRating = 0;

function openReviewModal(bookingId, walkerName) {
  reviewBookingId = bookingId;
  reviewRating = 0;

  let overlay = document.getElementById('review-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'review-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>⭐ Rate Your Walk</h2>
        <p id="review-walker-name"></p>
        <div class="star-input" id="star-input">
          ${[1,2,3,4,5].map(n => `<span class="star" onclick="setRating(${n})" data-n="${n}">☆</span>`).join('')}
        </div>
        <div class="form-group mt-2">
          <label>Comment (optional)</label>
          <textarea id="review-comment" placeholder="How was the walk?"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary btn-full" id="submit-review-btn" onclick="submitReview()">Submit Review</button>
          <button class="btn btn-secondary btn-full" onclick="closeReviewModal()">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  document.getElementById('review-walker-name').textContent =
    walkerName ? `How was your walk with ${walkerName}?` : 'How was your walk?';

  overlay.classList.add('active');
}

function closeReviewModal() {
  document.getElementById('review-modal-overlay')?.classList.remove('active');
  reviewBookingId = null;
  reviewRating = 0;
}

function setRating(n) {
  reviewRating = n;
  document.querySelectorAll('#star-input .star').forEach(el => {
    const val = parseInt(el.dataset.n);
    el.textContent = val <= n ? '★' : '☆';
    el.classList.toggle('active', val <= n);
  });
}

async function submitReview() {
  if (reviewRating === 0) { showToast('Please select a rating', 'error'); return; }

  const btn = document.getElementById('submit-review-btn');
  btn.textContent = 'Submitting…'; btn.disabled = true;

  try {
    await api(`/bookings/${reviewBookingId}/review`, {
      method: 'POST',
      body: {
        rating: reviewRating,
        comment: document.getElementById('review-comment')?.value || '',
      },
    });
    showToast('Review submitted! Thank you! 🎉', 'success');
    closeReviewModal();
    // Refresh page to update UI
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.textContent = 'Submit Review'; btn.disabled = false;
  }
}

/* ── Generic confirmation dialog ──────────────── */
function confirmAction(message) {
  return window.confirm(message);
}
