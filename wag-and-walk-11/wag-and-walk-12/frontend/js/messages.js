/* ═══════════════════════════════════════════════
   messages.js — In-app messaging UI
   ═══════════════════════════════════════════════ */

let currentConvoId = null;
let currentConvoUser = null;
let msgPollInterval = null;

async function loadMessagesSection(containerId, isAdmin) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="msg-layout">
      <div class="msg-sidebar">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:.85rem;">Messages</div>
        <div id="msg-convo-list"><div class="spinner"></div></div>
      </div>
      <div class="msg-main">
        <div class="msg-header" id="msg-header" style="display:none;">
          <div class="msg-convo-avatar" id="msg-active-avatar"></div>
          <span id="msg-active-name">Select a conversation</span>
        </div>
        <div class="msg-body" id="msg-body">
          <div class="msg-empty">Select a conversation to start messaging</div>
        </div>
        <div class="msg-input-bar" id="msg-input-bar" style="display:none;">
          <input type="text" id="msg-input" placeholder="Type a message..." onkeydown="if(event.key==='Enter')sendMsg()">
          <button class="btn btn-primary btn-sm" onclick="sendMsg()">Send</button>
        </div>
      </div>
    </div>
  `;

  try {
    const endpoint = isAdmin ? '/admin/messages' : '/messages';
    const data = await api(endpoint);
    const convos = data.conversations || [];
    renderConvoList(convos, isAdmin);
  } catch (err) {
    document.getElementById('msg-convo-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-muted);font-size:.82rem;">No messages yet</div>';
  }
}

function renderConvoList(convos, isAdmin) {
  const el = document.getElementById('msg-convo-list');
  const me = getUser();

  if (!convos.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-muted);font-size:.82rem;">No conversations yet</div>';
    return;
  }

  el.innerHTML = convos.map(c => {
    const other = isAdmin
      ? c.participants.map(p => p.firstName).join(' & ')
      : (c.participants.find(p => p._id !== me._id) || c.participants[0]);
    const name = isAdmin ? other : (other.firstName + ' ' + other.lastName);
    const initials = isAdmin ? other.substring(0, 2).toUpperCase() : ((other.firstName?.[0] || '') + (other.lastName?.[0] || ''));
    const otherId = isAdmin ? null : other._id;
    const time = c.lastMessageAt ? getTimeAgo(new Date(c.lastMessageAt)) : '';

    return `<div class="msg-convo-item ${currentConvoId === c._id ? 'active' : ''}"
      onclick="openConvo('${c._id}', '${name}', '${initials}', ${isAdmin})">
      <div class="msg-convo-avatar">${initials}</div>
      <div class="msg-convo-info">
        <div class="msg-convo-name">${name}</div>
        <div class="msg-convo-preview">${c.lastMessage || 'No messages yet'}</div>
      </div>
      <div class="msg-convo-time">${time}</div>
    </div>`;
  }).join('');
}

async function openConvo(convoId, name, initials, isAdmin) {
  currentConvoId = convoId;
  currentConvoUser = name;

  // Update sidebar active state
  document.querySelectorAll('.msg-convo-item').forEach(el => el.classList.remove('active'));
  event?.target?.closest?.('.msg-convo-item')?.classList?.add('active');

  // Show header and input
  document.getElementById('msg-header').style.display = 'flex';
  document.getElementById('msg-active-avatar').textContent = initials;
  document.getElementById('msg-active-name').textContent = name;
  document.getElementById('msg-input-bar').style.display = isAdmin ? 'none' : 'flex';

  await loadMessages(convoId);

  // Poll for new messages
  if (msgPollInterval) clearInterval(msgPollInterval);
  if (!isAdmin) {
    msgPollInterval = setInterval(() => loadMessages(convoId), 5000);
  }
}

async function loadMessages(convoId) {
  const body = document.getElementById('msg-body');
  const me = getUser();

  try {
    const endpoint = '/messages';
    const data = await api(endpoint);
    const convo = (data.conversations || []).find(c => c._id === convoId);
    if (!convo) { body.innerHTML = '<div class="msg-empty">Conversation not found</div>'; return; }

    const messages = convo.messages || [];
    if (!messages.length) {
      body.innerHTML = '<div class="msg-empty">No messages yet. Say hello!</div>';
      return;
    }

    body.innerHTML = messages.map(m => {
      const isSent = m.sender === me._id || m.sender?._id === me._id;
      const time = new Date(m.createdAt);
      const h = time.getHours(), min = time.getMinutes();
      const timeStr = (h % 12 || 12) + ':' + String(min).padStart(2, '0') + (h >= 12 ? 'p' : 'a');
      return `<div class="msg-bubble ${isSent ? 'sent' : 'received'}">
        ${m.imageUrl ? '<img src="' + m.imageUrl + '" style="max-width:200px;border-radius:8px;margin-bottom:6px;" loading="lazy">' : ''}
        ${m.content}
        <div class="msg-time">${timeStr}</div>
      </div>`;
    }).join('');

    // Scroll to bottom
    body.scrollTop = body.scrollHeight;
  } catch (err) {
    // Silent fail on poll
  }
}

async function sendMsg() {
  const input = document.getElementById('msg-input');
  const content = input.value.trim();
  if (!content || !currentConvoId) return;

  input.value = '';
  input.focus();

  try {
    await api('/messages/' + currentConvoId + '/send', {
      method: 'POST',
      body: { content }
    });
    await loadMessages(currentConvoId);
  } catch (err) {
    showToast('Failed to send: ' + err.message, 'error');
  }
}

async function startConversation(userId, userName) {
  try {
    const data = await api('/messages/conversation', {
      method: 'POST',
      body: { userId }
    });
    const convo = data.conversation;
    if (convo) {
      // Switch to messages tab
      location.hash = 'messages';
      setTimeout(() => {
        const initials = userName.split(' ').map(w => w[0]).join('');
        openConvo(convo._id, userName, initials, false);
      }, 300);
    }
  } catch (err) {
    showToast('Failed to start conversation: ' + err.message, 'error');
  }
}
