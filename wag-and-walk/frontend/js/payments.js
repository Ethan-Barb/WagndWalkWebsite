/* payments.js — Stripe.js setup intent / card element helper
   Load AFTER auth.js. Include Stripe.js before this file:
   <script src="https://js.stripe.com/v3/"></script>
*/
'use strict';

let _stripe      = null;
let _cardElement = null;
let _setupIntentClientSecret = null;

function initStripe(publishableKey) {
  if (!window.Stripe) {
    console.error('Stripe.js not loaded. Add <script src="https://js.stripe.com/v3/"></script>');
    return;
  }
  _stripe = Stripe(publishableKey || 'pk_test_placeholder');
}

/** Mount a Stripe card element into #card-element */
function mountCardElement(containerId = 'card-element') {
  if (!_stripe) { console.error('Stripe not initialised — call initStripe() first'); return; }
  const elements  = _stripe.elements();
  _cardElement = elements.create('card', {
    style: {
      base: {
        fontFamily: 'DM Sans, system-ui, sans-serif',
        fontSize:   '16px',
        color:      '#2D1B0E',
        '::placeholder': { color: '#8B7355' },
      },
      invalid: { color: '#D94F3D' },
    },
  });
  _cardElement.mount(`#${containerId}`);
  _cardElement.on('change', ({ error }) => {
    const display = document.getElementById('card-errors');
    if (display) display.textContent = error ? error.message : '';
  });
}

/** Create a Stripe SetupIntent and return the client secret */
async function createSetupIntent() {
  const d = await api('/clients/setup-payment', { method: 'POST' });
  _setupIntentClientSecret = d.clientSecret;
  return d.clientSecret;
}

/** Confirm a card setup — returns { paymentMethod } or throws */
async function confirmCardSetup(billingName) {
  if (!_stripe || !_cardElement) throw new Error('Stripe not ready');
  if (!_setupIntentClientSecret) await createSetupIntent();

  const { setupIntent, error } = await _stripe.confirmCardSetup(_setupIntentClientSecret, {
    payment_method: {
      card: _cardElement,
      billing_details: { name: billingName },
    },
  });
  if (error) throw new Error(error.message);
  return setupIntent.payment_method;
}

/** Confirm a PaymentIntent client secret (used after booking) */
async function confirmPayment(clientSecret, billingName) {
  if (!_stripe) throw new Error('Stripe not initialised');
  const { paymentIntent, error } = await _stripe.confirmCardPayment(clientSecret, {
    payment_method: _cardElement
      ? { card: _cardElement, billing_details: { name: billingName } }
      : undefined,
  });
  if (error) throw new Error(error.message);
  return paymentIntent;
}

/** Full payment method setup flow — mounts card, creates setup intent, confirms */
async function setupPaymentMethod({ containerId = 'card-element', billingName, onSuccess, onError } = {}) {
  mountCardElement(containerId);
  const btn = document.getElementById('save-card-btn');
  if (btn) {
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const pmId = await confirmCardSetup(billingName);
        onSuccess?.(pmId);
      } catch(e) {
        onError?.(e.message);
        btn.disabled = false; btn.textContent = 'Save Card';
      }
    };
  }
}
