/* ═══════════════════════════════════════════════
   messages.js — In-app messaging for all roles
   Admins see all conversations and can respond.
   ═══════════════════════════════════════════════ */

let currentConvoId = null;
let currentConvoUser = null;
let isAdminView = false;
let msgPollInterval = null;
let cachedConvos = [];

async function loadMessagesSection(containerId, isAdmin) {
  isAdminView = isAdmin;
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="msg-layout">
      <div class="msg-sidebar">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;font-size:.85rem;">${isAdmin ? 'All Conversations' : 'Messages'}</span>
          ${isAdmin ? '<span class="badge badge-admin" style="font-size:.6rem;">Admin View</span>' : ''}
        </div>
        <div id="msg-convo-list"><div class="spinner"></div></div>
      </div>
      <div class="msg-main">
        <div class="msg-header" id="msg-header" style="display:none;">
          <div class="msg-convo-avatar" id="msg-active-avatar"></div>
          <div style="flex:1;">
            <div id="msg-active-name" style="font-weight:600;font-size:.88rem;">Select a conversation</div>
            <div id="msg-active-role" style="font-size:.68rem;color:var(--ink-muted);"></div>
          </div>
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

  await refreshConvoList();
}

async function refreshConvoList() {
  try {
    const endpoint = isAdminView ? '/admin/messages' : '/messages';
    const data = await api(endpoint);
    cachedConvos = data.conversations || [];
    renderConvoList();
  } catch (err) {
    document.getElementById('msg-convo-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-muted);font-size:.82rem;">No messages yet</div>';
  }
}

function renderConvoList() {
  const el = document.getElementById('msg-convo-list');
  const me = getUser();

  if (!cachedConvos.length) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--ink-muted);font-size:.82rem;">No conversations yet</div>';
    return;
  }

  el.innerHTML = cachedConvos.map(c => {
    const participants = c.participants || [];

    let name, initials, subtitle;
    if (isAdminView) {
      // Admin sees both participant names and their roles
      const names = participants.map(p => p.firstName + ' ' + (p.lastName || '')).join(' & ');
      const roles = participants.map(p => p.role).join(' / ');
      name = names;
      initials = participants.map(p => (p.firstName?.[0] || '')).join('');
      subtitle = roles;
    } else {
      const other = participants.find(p => p._id !== me._id) || participants[0];
      name = (other?.firstName || '?') + ' ' + (other?.lastName || '');
      initials = (other?.firstName?.[0] || '') + (other?.lastName?.[0] || '');
      subtitle = other?.role || '';
    }

    const time = c.lastMessageAt ? getTimeAgo(new Date(c.lastMessageAt)) : '';
    const isActive = currentConvoId === c._id;

    return '<div class="msg-convo-item ' + (isActive ? 'active' : '') + '" onclick="openConvo(\'' + c._id + '\')">' +
      '<div class="msg-convo-avatar">' + initials + '</div>' +
      '<div class="msg-convo-info">' +
        '<div class="msg-convo-name">' + name + '</div>' +
        '<div class="msg-convo-preview">' + (c.lastMessage || 'No messages yet') + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0;">' +
        '<div class="msg-convo-time">' + time + '</div>' +
        (subtitle ? '<div style="font-size:.58rem;color:var(--accent);text-transform:capitalize;">' + subtitle + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

async function openConvo(convoId) {
  currentConvoId = convoId;

  // Find conversation data
  const convo = cachedConvos.find(c => c._id === convoId);
  const me = getUser();
  const participants = convo?.participants || [];

  // Update header
  let headerName, headerRole, headerInitials;
  if (isAdminView) {
    headerName = participants.map(p => p.firstName + ' ' + (p.lastName || '')).join(' & ');
    headerRole = participants.map(p => p.role).join(' / ');
    headerInitials = participants.map(p => (p.firstName?.[0] || '')).join('');
  } else {
    const other = participants.find(p => p._id !== me._id) || participants[0];
    headerName = (other?.firstName || '?') + ' ' + (other?.lastName || '');
    headerRole = other?.role || '';
    headerInitials = (other?.firstName?.[0] || '') + (other?.lastName?.[0] || '');
  }

  document.getElementById('msg-header').style.display = 'flex';
  document.getElementById('msg-active-avatar').textContent = headerInitials;
  document.getElementById('msg-active-name').textContent = headerName;
  document.getElementById('msg-active-role').textContent = headerRole;

  // Show input bar for ALL roles including admin
  document.getElementById('msg-input-bar').style.display = 'flex';

  // Update active state in sidebar
  document.querySelectorAll('.msg-convo-item').forEach((el, i) => {
    el.classList.toggle('active', cachedConvos[i]?._id === convoId);
  });

  await loadMessages();

  // Start polling
  if (msgPollInterval) clearInterval(msgPollInterval);
  msgPollInterval = setInterval(loadMessages, 4000);
}

async function loadMessages() {
  if (!currentConvoId) return;
  const body = document.getElementById('msg-body');
  const me = getUser();
  if (!me) return;

  try {
    // Re-fetch conversations to get latest messages
    const endpoint = isAdminView ? '/admin/messages' : '/messages';
    const data = await api(endpoint);
    cachedConvos = data.conversations || [];
    const convo = cachedConvos.find(c => c._id === currentConvoId);

    if (!convo) {
      body.innerHTML = '<div class="msg-empty">Conversation not found</div>';
      return;
    }

    const messages = convo.messages || [];
    if (!messages.length) {
      body.innerHTML = '<div class="msg-empty">No messages yet. Say hello!</div>';
      return;
    }

    // Build sender lookup from participants AND include current user
    const senderMap = {};
    (convo.participants || []).forEach(p => {
      const id = p._id || p;
      senderMap[id] = { name: p.firstName + ' ' + (p.lastName || ''), role: p.role || '' };
    });
    // Always include current user (admins might not be in participants)
    senderMap[me._id] = { name: me.firstName + ' ' + (me.lastName || ''), role: me.role || '' };

    const wasAtBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;

    body.innerHTML = messages.map(m => {
      // Sender ID can be a string or populated object
      const senderId = (m.sender && m.sender._id) ? m.sender._id : m.sender;
      const isSent = String(senderId) === String(me._id);
      const sender = senderMap[senderId] || { name: 'User', role: '' };

      const time = new Date(m.createdAt);
      const h = time.getHours(), min = time.getMinutes();
      const timeStr = (h % 12 || 12) + ':' + String(min).padStart(2, '0') + (h >= 12 ? 'pm' : 'am');

      // Show sender label on received messages for admin view, or in any group conversation
      const showSender = !isSent && (isAdminView || (convo.participants || []).length > 2);
      const roleColor = sender.role === 'admin' ? '#D45B5B' : sender.role === 'walker' ? '#6B8F71' : '#5B8FD4';

      return '<div class="msg-bubble ' + (isSent ? 'sent' : 'received') + '">' +
        (showSender ? '<div style="font-size:.65rem;font-weight:700;margin-bottom:4px;color:' + roleColor + ';">' + sender.name + ' <span style="opacity:.6;text-transform:capitalize;font-weight:400;">(' + sender.role + ')</span></div>' : '') +
        (m.imageUrl ? '<img src="' + m.imageUrl + '" style="max-width:200px;border-radius:8px;margin-bottom:6px;" loading="lazy">' : '') +
        '<div>' + escapeHtml(m.content) + '</div>' +
        '<div class="msg-time">' + timeStr + '</div>' +
      '</div>';
    }).join('');

    if (wasAtBottom) body.scrollTop = body.scrollHeight;
  } catch (err) {
    console.error('loadMessages error:', err);
    body.innerHTML = '<div class="msg-empty" style="color:var(--danger);">Failed to load messages: ' + (err.message || err) + '</div>';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    await loadMessages();
  } catch (err) {
    showToast('Failed to send: ' + err.message, 'error');
  }
}

async function startConversation(userId, userName) {
  if (!userId) return;
  try {
    const data = await api('/messages/conversation', {
      method: 'POST',
      body: { userId }
    });
    const convo = data.conversation;
    if (convo) {
      location.hash = 'messages';
      // Wait for section to render, then open the conversation
      setTimeout(async () => {
        await refreshConvoList();
        openConvo(convo._id);
      }, 400);
    }
  } catch (err) {
    showToast('Failed to start conversation: ' + err.message, 'error');
  }
}

// Cleanup polling when leaving the page
window.addEventListener('hashchange', () => {
  if (!location.hash.includes('messages') && msgPollInterval) {
    clearInterval(msgPollInterval);
    msgPollInterval = null;
  }
});
