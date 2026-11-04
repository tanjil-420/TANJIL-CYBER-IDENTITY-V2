/* TANJIL.EXE — MESSENGER CLIENT
   Compatible with existing /api/chat routes and chat:* Socket.IO events.
*/
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = { user: null, socket: null, conversations: [], activeId: null, messages: [], tab: 'all', searchTimer: null, toastTimer: null };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sameId = (a,b) => String(a) === String(b);

  function notify(message) {
    const el = $('messengerToast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.message || data.error || `Request failed (${response.status})`);
    return data;
  }

  function openModal(id) { const el = $(id); if (el) { el.hidden = false; const input = el.querySelector('input'); if (input) input.focus(); } }
  function closeModal(el) { const modal = el.closest('.chat-modal-overlay'); if (modal) modal.hidden = true; }
  function normalizeConversation(c) {
    return { ...c, id: c.id, type: c.type, name: c.name || c.other_username || (c.type === 'group' ? 'Group chat' : 'Private chat'), lastMessage: c.last_message || '', unreadCount: Number(c.unread_count || 0) };
  }
  function normalizeMessage(m) {
    return { ...m, conversationId: m.conversation_id, senderId: m.sender_id, senderUsername: m.sender_username || 'User', createdAt: m.created_at, content: m.content || '' };
  }
  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function loadCurrentUser() {
    const data = await api('/api/auth/me');
    state.user = data.user || data;
    $('currentUsername').textContent = state.user.username || 'User';
    $('currentUserAvatar').textContent = (state.user.username || 'U').charAt(0).toUpperCase();
  }

  function renderConversations() {
    const query = ($('conversationSearch')?.value || '').trim().toLowerCase();
    const list = $('conversationList');
    const items = state.conversations.filter(c => (state.tab === 'all' || c.type === state.tab) && c.name.toLowerCase().includes(query));
    if (!items.length) { list.innerHTML = '<div class="conversation-loading">No conversations found.</div>'; return; }
    list.innerHTML = items.map(c => `<div class="conversation-item ${sameId(c.id,state.activeId) ? 'active' : ''}" data-conversation-id="${esc(c.id)}" role="button" tabindex="0"><div class="chat-avatar">${esc(c.name.charAt(0).toUpperCase())}</div><div class="conversation-details"><strong>${esc(c.name)}</strong><p>${esc(c.lastMessage || (c.type === 'group' ? 'Group conversation' : 'Start chatting'))}</p></div><div class="conversation-meta"><small>${esc(formatTime(c.created_at))}</small>${c.unreadCount ? `<span class="unread-count">${c.unreadCount}</span>` : ''}</div></div>`).join('');
  }

  async function loadConversations() {
    const data = await api('/api/chat/conversations');
    state.conversations = (data.conversations || []).map(normalizeConversation);
    renderConversations();
  }

  function renderMessages() {
    const box = $('messageContainer');
    if (!state.messages.length) { box.innerHTML = '<div class="message-loading">No messages yet. Say hello!</div>'; return; }
    box.innerHTML = state.messages.map(m => {
      const own = state.user && sameId(m.senderId, state.user.id);
      return `<div class="message-row ${own ? 'own-message' : ''}"><div class="message-bubble">${!own ? `<strong>${esc(m.senderUsername)}</strong><br>` : ''}${esc(m.content)}<span class="message-meta">${esc(formatTime(m.createdAt))}</span></div></div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  async function openConversation(id) {
    const conversation = state.conversations.find(c => sameId(c.id,id));
    if (!conversation) return;
    state.activeId = conversation.id;
    $('chatEmptyState').hidden = true; $('activeChat').hidden = false;
    $('activeChatName').textContent = conversation.name;
    $('activeChatSubtitle').textContent = conversation.type === 'group' ? 'GROUP CHAT' : 'PRIVATE CHAT';
    $('chatMain').classList.add('mobile-active'); $('chatSidebar').classList.add('mobile-hidden');
    renderConversations();
    const data = await api(`/api/chat/${encodeURIComponent(id)}/messages`);
    if (!sameId(state.activeId,id)) return;
    state.messages = (data.messages || []).map(normalizeMessage); renderMessages();
    if (state.socket?.connected) {
      state.socket.emit('chat:join', { conversationId: id });
      state.socket.emit('chat:read', { conversationId: id });
    }
    conversation.unreadCount = 0; renderConversations();
  }

  function connectSocket() {
    if (typeof io !== 'function') { notify('Socket.IO client failed to load.'); return; }
    state.socket = io({ withCredentials: true, reconnection: true });
    state.socket.on('connect', () => {
      $('connectionStatus').classList.remove('disconnected'); $('connectionStatus').classList.add('connected'); $('connectionText').textContent = 'CONNECTED';
      state.socket.emit('chat:sync'); if (state.activeId) state.socket.emit('chat:join', { conversationId: state.activeId });
    });
    state.socket.on('disconnect', () => {
      $('connectionStatus').classList.remove('connected'); $('connectionStatus').classList.add('disconnected'); $('connectionText').textContent = 'DISCONNECTED';
    });
    state.socket.on('connect_error', () => { $('connectionText').textContent = 'RECONNECTING'; });
    state.socket.on('chat:new', payload => {
      const raw = payload?.message || payload;
      if (!raw || raw.id == null) return;
      const message = normalizeMessage(raw);
      if (sameId(message.conversationId,state.activeId)) {
        if (!state.messages.some(m => sameId(m.id,message.id))) { state.messages.push(message); renderMessages(); }
        if (!sameId(message.senderId,state.user?.id)) state.socket.emit('chat:read', { conversationId: state.activeId });
      } else {
        const c = state.conversations.find(x => sameId(x.id,message.conversationId)); if (c && !sameId(message.senderId,state.user?.id)) c.unreadCount++;
      }
      const c = state.conversations.find(x => sameId(x.id,message.conversationId)); if (c) c.lastMessage = message.content;
      renderConversations();
      loadConversations().catch(() => {});
    });
    state.socket.on('chat:read:update', () => {});
  }

  async function searchUsers(query) {
    const results = $('userSearchResults');
    if (query.length < 3) { results.innerHTML = ''; return; }
    try {
      const data = await api(`/api/chat/users?q=${encodeURIComponent(query)}`);
      results.innerHTML = (data.users || []).map(u => `<div class="search-result-item"><span>${esc(u.username)} <small>#${esc(u.id)}</small></span><button type="button" data-start-user="${esc(u.id)}">MESSAGE</button></div>`).join('') || '<div class="conversation-loading">No users found.</div>';
    } catch (error) { results.innerHTML = `<div class="conversation-loading">${esc(error.message)}</div>`; }
  }

  async function startPrivateChat(userId) {
    try {
      const data = await api('/api/chat/private', { method: 'POST', body: JSON.stringify({ userId: Number(userId) }) });
      $('newChatModal').hidden = true;
      await loadConversations(); await openConversation(data.conversationId);
    } catch (error) { notify(error.message); }
  }

  async function createGroup(event) {
    event.preventDefault();
    const name = $('groupName').value.trim();
    const memberIds = [...new Set(($('groupMembers').value.match(/\d+/g) || []).map(Number).filter(Number.isSafeInteger))];
    if (!name) return notify('Enter a group name.');
    try {
      const data = await api('/api/chat/groups', { method: 'POST', body: JSON.stringify({ name, memberIds }) });
      $('groupModal').hidden = true; $('groupForm').reset();
      await loadConversations(); await openConversation(data.conversationId); notify('Group created.');
    } catch (error) { notify(error.message); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const input = $('messageInput'); const content = input.value.trim();
    if (!content || !state.activeId) return;
    if (!state.socket?.connected) return notify('Not connected. Please wait and try again.');
    $('sendMessageButton').disabled = true;
    state.socket.emit('chat:send', { conversationId: state.activeId, content }, response => {
      $('sendMessageButton').disabled = false;
      if (!response?.success) return notify(response?.message || 'Message could not be sent.');
      input.value = ''; input.style.height = 'auto';
      const message = normalizeMessage(response.message);
      if (!state.messages.some(m => sameId(m.id,message.id))) { state.messages.push(message); renderMessages(); }
      loadConversations().catch(() => {});
    });
  }

  function setupEvents() {
    $('newChatButton').addEventListener('click', () => openModal('newChatModal'));
    $('emptyNewChatButton').addEventListener('click', () => openModal('newChatModal'));
    $('groupChatButton').addEventListener('click', () => openModal('groupModal'));
    document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', () => closeModal(b)));
    document.querySelectorAll('.chat-modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.hidden = true; }));
    $('newChatSearch').addEventListener('input', e => { clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => searchUsers(e.target.value.trim()), 300); });
    $('userSearchResults').addEventListener('click', e => { const b = e.target.closest('[data-start-user]'); if (b) startPrivateChat(b.dataset.startUser); });
    $('groupForm').addEventListener('submit', createGroup);
    $('messageForm').addEventListener('submit', sendMessage);
    $('messageInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('messageForm').requestSubmit(); } });
    $('messageInput').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight,120)}px`; });
    $('conversationList').addEventListener('click', e => { const item = e.target.closest('[data-conversation-id]'); if (item) openConversation(item.dataset.conversationId).catch(err => notify(err.message)); });
    $('conversationList').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const item = e.target.closest('[data-conversation-id]'); if (item) { e.preventDefault(); openConversation(item.dataset.conversationId).catch(err => notify(err.message)); } } });
    $('conversationSearch').addEventListener('input', renderConversations);
    document.querySelectorAll('.chat-tab').forEach(tab => tab.addEventListener('click', () => { state.tab = tab.dataset.tab; document.querySelectorAll('.chat-tab').forEach(t => t.classList.toggle('active',t===tab)); renderConversations(); }));
    $('mobileBackButton').addEventListener('click', () => { $('chatMain').classList.remove('mobile-active'); $('chatSidebar').classList.remove('mobile-hidden'); });
    $('chatInfoButton').addEventListener('click', () => $('chatInfoPanel').classList.toggle('mobile-open'));
    $('closeInfoPanel').addEventListener('click', () => $('chatInfoPanel').classList.remove('mobile-open'));
  }

  async function init() {
    setupEvents();
    try { await loadCurrentUser(); await loadConversations(); connectSocket(); }
    catch (error) { notify(error.message || 'Could not load messenger. Please log in again.'); $('conversationList').innerHTML = '<div class="conversation-loading">Please log in to use Messenger.</div>'; }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
