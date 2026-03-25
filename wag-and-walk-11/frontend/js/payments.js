/* ═══════════════════════════════════════════════
   payments.js — Stripe client-side helpers
   ═══════════════════════════════════════════════ */

// Note: In production, include Stripe.js via <script src="https://js.stripe.com/v3/">
// and initialize with your publishable key.

let stripeInstance = null;

function getStripe() {
  if (stripeInstance) return stripeInstance;
  if (typeof Stripe !== 'undefined') {
    // Use a placeholder key for demo — replace with actual publishable key
    stripeInstance = Stripe(window.STRIPE_PK || 'pk_test_placeholder');
  }
  return stripeInstance;
}

async function createPaymentForBooking(bookingId) {
  try {
    const data = await api('/payments/create-intent', {
      method: 'POST',
      body: { bookingId },
    });
    return data.clientSecret;
  } catch (err) {
    showToast('Payment setup failed: ' + err.message, 'error');
    throw err;
  }
}

async function initStripeConnect() {
  try {
    const data = await api('/payments/stripe-connect', { method: 'POST' });
    if (data.url) {
      window.open(data.url, '_blank');
      showToast('Stripe Connect opened in new tab', 'info');
    }
  } catch (err) {
    showToast('Stripe Connect failed: ' + err.message, 'error');
  }
}
