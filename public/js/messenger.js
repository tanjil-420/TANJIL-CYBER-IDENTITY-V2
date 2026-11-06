/* TANJIL.EXE — MESSENGER V2.3 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { user: null, socket: null, conversations: [], activeId: null, activeConversation: null, messages: [], tab: 'all', searchTimer: null, toastTimer: null, replyTo: null };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sameId = (a,b) => String(a) === String(b);
  const safeAvatar = value => {
    const url = String(value || '');
    return /^https:\/\//i.test(url) || /^data:image\/(jpeg|png|webp);base64,/i.test(url) ? url : '';
  };
  const avatarMarkup = (url, name, className = 'chat-avatar') => {
    const image = safeAvatar(url);
    return image ? `<div class="${className}"><img src="${esc(image)}" alt="${esc(name || 'Profile')}" loading="lazy"></div>` : `<div class="${className}">${esc((name || 'U').charAt(0).toUpperCase())}</div>`;
  };

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
  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function normalizeConversation(c) {
    return { ...c, id: c.id, type: c.type, name: c.name || c.other_username || (c.type === 'group' ? 'Group chat' : 'Private chat'), lastMessage: c.last_message || '', unreadCount: Number(c.unread_count || 0) };
  }
  function normalizeMessage(m) {
    return { ...m, conversationId: m.conversation_id, senderId: m.sender_id, senderUsername: m.sender_username || 'User', senderRole: m.sender_role || 'user', senderAvatarUrl: m.sender_avatar_url || '', createdAt: m.created_at, content: m.content || '', replyToId: m.reply_to_id, replyContent: m.reply_content || '', replySenderUsername: m.reply_sender_username || '' };
  }

  async function loadCurrentUser() {
    const data = await api('/api/auth/me');
    state.user = data.user || data;
    const profile = data.profile || {};
    state.user.avatarUrl = profile.avatarUrl || '';
    $('currentUsername').textContent = state.user.username || 'User';
    const avatar = $('currentUserAvatar');
    if (avatar && safeAvatar(profile.avatarUrl)) avatar.innerHTML = `<img src="${esc(safeAvatar(profile.avatarUrl))}" alt="Profile">`;
    else if (avatar) avatar.textContent = (state.user.username || 'U').charAt(0).toUpperCase();
  }

  function renderConversations() {
    const query = ($('conversationSearch')?.value || '').trim().toLowerCase();
    const list = $('conversationList');
    const items = state.conversations.filter(c => (state.tab === 'all' || c.type === state.tab) && c.name.toLowerCase().includes(query));
    if (!items.length) { list.innerHTML = '<div class="conversation-loading">No conversations found.</div>'; return; }
    list.innerHTML = items.map(c => `<div class="conversation-item ${sameId(c.id,state.activeId) ? 'active' : ''}" data-conversation-id="${esc(c.id)}" role="button" tabindex="0">${avatarMarkup(c.other_avatar_url,c.name)}<div class="conversation-details"><strong>${esc(c.name)}</strong><p>${esc(c.lastMessage || (c.type === 'group' ? 'Group conversation' : 'Start chatting'))}</p></div><div class="conversation-meta"><small>${esc(formatTime(c.created_at))}</small>${c.unreadCount ? `<span class="unread-count">${c.unreadCount}</span>` : ''}</div></div>`).join('');
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
      const ownerMark = m.senderRole === 'admin' ? '<span class="owner-message-badge">✦ PLATFORM OWNER</span>' : '';
      const quote = m.replyToId && m.replyContent ? `<div class="reply-quote"><strong>${esc(m.replySenderUsername || 'Message')}</strong><span>${esc(m.replyContent)}</span></div>` : '';
      const avatar = avatarMarkup(own ? state.user?.avatarUrl : m.senderAvatarUrl, own ? state.user?.username : m.senderUsername, 'message-avatar');
      return `<div class="message-row ${own ? 'own-message' : ''}" data-message-row="${esc(m.id)}">${avatar}<div class="message-bubble-wrap"><button class="message-reply-button" type="button" data-reply-id="${esc(m.id)}" title="Reply to this message" aria-label="Reply to this message">↶</button><div class="message-bubble">${ownerMark}${!own ? `<strong class="message-sender-name">${esc(m.senderUsername)}</strong>` : ''}${quote}<div class="message-content">${esc(m.content)}</div><span class="message-meta">${esc(formatTime(m.createdAt))}</span></div></div></div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  function renderReplyPreview() {
    const box = $('replyComposerPreview');
    if (!box) return;
    if (!state.replyTo) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<div><strong>Replying to ${esc(state.replyTo.senderUsername)}</strong><span>${esc(state.replyTo.content)}</span></div><button type="button" id="cancelReply" aria-label="Cancel reply">×</button>`;
    $('cancelReply').addEventListener('click', clearReply);
  }
  function clearReply() { state.replyTo = null; renderReplyPreview(); }

  async function loadConversationInfo(id) {
    const panel = $('chatInfoPanel');
    panel.innerHTML = '<div class="info-panel-heading"><h3>CHAT INFO</h3><button id="closeInfoPanel" type="button" aria-label="Close info">×</button></div><div class="info-placeholder">Loading profile information...</div>';
    $('closeInfoPanel').addEventListener('click', () => panel.classList.remove('mobile-open'));
    try {
      const data = await api(`/api/chat/${encodeURIComponent(id)}/info`);
      const members = data.members || [];
      const conversation = data.conversation || {};
      let body = '';
      if (conversation.type === 'group') {
        body = `<div class="info-group-name">${esc(conversation.name || 'Group chat')}</div>` + members.map(member => memberInfoCard(member)).join('');
      } else if (members.length) body = memberInfoCard(members[0]);
      else body = '<div class="info-placeholder">No other member information found.</div>';
      panel.innerHTML = `<div class="info-panel-heading"><h3>CHAT INFO</h3><button id="closeInfoPanel" type="button" aria-label="Close info">×</button></div>${body}`;
      $('closeInfoPanel').addEventListener('click', () => panel.classList.remove('mobile-open'));
    } catch (error) { panel.innerHTML = `<div class="info-panel-heading"><h3>CHAT INFO</h3><button id="closeInfoPanel" type="button">×</button></div><div class="info-placeholder">${esc(error.message)}</div>`; $('closeInfoPanel').addEventListener('click', () => panel.classList.remove('mobile-open')); }
  }
  function memberInfoCard(member) {
    const avatar = avatarMarkup(member.avatarUrl, member.displayName, 'info-avatar');
    const idLine = member.isPublic ? `<div class="info-public-id"><small>PUBLIC ID</small><strong>${esc(member.publicId)}</strong></div>` : '<div class="info-private-note">🔒 This member keeps their public profile private. No public ID is shown.</div>';
    const usernameLine = member.isPublic ? `@${esc(member.username)}` : 'PUBLIC PROFILE HIDDEN';
    const skills = member.isPublic && member.skills?.length ? `<div class="info-skill-list">${member.skills.map(skill => `<span>${esc(skill)}</span>`).join('')}</div>` : '';
    const profile = member.profileUrl ? `<a class="info-profile-link" href="${esc(member.profileUrl)}" target="_blank" rel="noopener">OPEN PUBLIC PROFILE ↗</a>` : '';
    return `<article class="info-member-card">${avatar}<h4>${esc(member.displayName)}</h4><p class="info-username">${usernameLine}</p>${idLine}${member.isPublic && member.bio ? `<p class="info-bio">${esc(member.bio)}</p>` : ''}${skills}${profile}</article>`;
  }

  async function openConversation(id) {
    const conversation = state.conversations.find(c => sameId(c.id,id));
    if (!conversation) return;
    state.activeId = conversation.id; state.activeConversation = conversation; clearReply();
    $('chatEmptyState').hidden = true; $('activeChat').hidden = false;
    $('activeChatName').textContent = conversation.name;
    $('activeChatSubtitle').textContent = conversation.type === 'group' ? 'GROUP CHAT' : (conversation.other_role === 'admin' ? 'PLATFORM OWNER · PRIVATE CHAT' : (conversation.other_profile_public === false ? 'PRIVATE PROFILE' : 'PRIVATE CHAT'));
    const headerAvatar = $('activeChatAvatar');
    if (headerAvatar) headerAvatar.outerHTML = avatarMarkup(conversation.other_avatar_url, conversation.name, 'chat-avatar active-chat-avatar').replace('chat-avatar active-chat-avatar','chat-avatar active-chat-avatar" id="activeChatAvatar');
    $('chatMain').classList.add('mobile-active'); $('chatSidebar').classList.add('mobile-hidden');
    renderConversations();
    const data = await api(`/api/chat/${encodeURIComponent(id)}/messages`);
    if (!sameId(state.activeId,id)) return;
    state.messages = (data.messages || []).map(normalizeMessage); renderMessages();
    if (state.socket?.connected) { state.socket.emit('chat:join', { conversationId: id }); state.socket.emit('chat:read', { conversationId: id }); }
    conversation.unreadCount = 0; renderConversations();
  }

  function connectSocket() {
    if (typeof io !== 'function') { notify('Socket.IO client failed to load.'); return; }
    state.socket = io({ withCredentials: true, reconnection: true });
    state.socket.on('connect', () => {
      $('connectionStatus').classList.remove('disconnected'); $('connectionStatus').classList.add('connected'); $('connectionText').textContent = 'CONNECTED';
      state.socket.emit('chat:sync'); if (state.activeId) state.socket.emit('chat:join', { conversationId: state.activeId });
    });
    state.socket.on('disconnect', () => { $('connectionStatus').classList.remove('connected'); $('connectionStatus').classList.add('disconnected'); $('connectionText').textContent = 'DISCONNECTED'; });
    state.socket.on('connect_error', () => { $('connectionText').textContent = 'RECONNECTING'; });
    state.socket.on('chat:new', payload => {
      const raw = payload?.message || payload; if (!raw || raw.id == null) return;
      const message = normalizeMessage(raw);
      if (sameId(message.conversationId,state.activeId)) {
        if (!state.messages.some(m => sameId(m.id,message.id))) { state.messages.push(message); renderMessages(); }
        if (!sameId(message.senderId,state.user?.id)) state.socket.emit('chat:read', { conversationId: state.activeId });
      } else {
        const c = state.conversations.find(x => sameId(x.id,message.conversationId)); if (c && !sameId(message.senderId,state.user?.id)) c.unreadCount++;
      }
      const c = state.conversations.find(x => sameId(x.id,message.conversationId)); if (c) c.lastMessage = message.content;
      renderConversations(); loadConversations().catch(() => {});
    });
    state.socket.on('chat:read:update', () => {});
  }

  async function searchUsers(query) {
    const results = $('userSearchResults'); if (query.length < 3) { results.innerHTML = ''; return; }
    try {
      const data = await api(`/api/chat/users?q=${encodeURIComponent(query)}`);
      results.innerHTML = (data.users || []).map(user => `<div class="search-result-item">${avatarMarkup(user.avatar_url,user.username,'search-avatar')}<span>${esc(user.username)}</span><button type="button" data-start-user="${esc(user.id)}">MESSAGE</button></div>`).join('') || '<div class="conversation-loading">No users found.</div>';
    } catch (error) { results.innerHTML = `<div class="conversation-loading">${esc(error.message)}</div>`; }
  }
  async function startPrivateChat(userId) {
    try { const data = await api('/api/chat/private', { method: 'POST', body: JSON.stringify({ userId: Number(userId) }) }); $('newChatModal').hidden = true; await loadConversations(); await openConversation(data.conversationId); }
    catch (error) { notify(error.message); }
  }
  async function createGroup(event) {
    event.preventDefault();
    const name = $('groupName').value.trim();
    const memberIds = [...new Set(($('groupMembers').value.match(/\d+/g) || []).map(Number).filter(Number.isSafeInteger))];
    if (!name) return notify('Enter a group name.');
    try { const data = await api('/api/chat/groups', { method: 'POST', body: JSON.stringify({ name, memberIds }) }); $('groupModal').hidden = true; $('groupForm').reset(); await loadConversations(); await openConversation(data.conversationId); notify('Group created.'); }
    catch (error) { notify(error.message); }
  }
  function beginReply(messageId) {
    const message = state.messages.find(item => sameId(item.id,messageId)); if (!message) return;
    state.replyTo = message; renderReplyPreview(); $('messageInput').focus();
  }
  async function sendMessage(event) {
    event.preventDefault();
    const input = $('messageInput'); const content = input.value.trim();
    if (!content || !state.activeId) return;
    if (!state.socket?.connected) return notify('Not connected. Please wait and try again.');
    $('sendMessageButton').disabled = true;
    state.socket.emit('chat:send', { conversationId: state.activeId, content, replyToId: state.replyTo?.id || null }, response => {
      $('sendMessageButton').disabled = false;
      if (!response?.success) return notify(response?.message || response?.error || 'Message could not be sent.');
      input.value = ''; input.style.height = 'auto'; clearReply();
      const message = normalizeMessage(response.message);
      if (!state.messages.some(m => sameId(m.id,message.id))) { state.messages.push(message); renderMessages(); }
      loadConversations().catch(() => {});
    });
  }

  function setupEvents() {
    $('newChatButton').addEventListener('click', () => openModal('newChatModal'));
    $('emptyNewChatButton').addEventListener('click', () => openModal('newChatModal'));
    $('groupChatButton').addEventListener('click', () => openModal('groupModal'));
    document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => { const modal = button.closest('.chat-modal-overlay'); if (modal) modal.hidden = true; }));
    document.querySelectorAll('.chat-modal-overlay').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; }));
    $('newChatSearch').addEventListener('input', event => { clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => searchUsers(event.target.value.trim()), 300); });
    $('userSearchResults').addEventListener('click', event => { const button = event.target.closest('[data-start-user]'); if (button) startPrivateChat(button.dataset.startUser); });
    $('groupForm').addEventListener('submit', createGroup); $('messageForm').addEventListener('submit', sendMessage);
    $('messageInput').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('messageForm').requestSubmit(); } });
    $('messageInput').addEventListener('input', event => { event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight,120)}px`; });
    $('conversationList').addEventListener('click', event => { const item = event.target.closest('[data-conversation-id]'); if (item) openConversation(item.dataset.conversationId).catch(error => notify(error.message)); });
    $('conversationList').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { const item = event.target.closest('[data-conversation-id]'); if (item) { event.preventDefault(); openConversation(item.dataset.conversationId).catch(error => notify(error.message)); } } });
    $('conversationSearch').addEventListener('input', renderConversations);
    document.querySelectorAll('.chat-tab').forEach(tab => tab.addEventListener('click', () => { state.tab = tab.dataset.tab; document.querySelectorAll('.chat-tab').forEach(item => item.classList.toggle('active',item===tab)); renderConversations(); }));
    $('mobileBackButton').addEventListener('click', () => { $('chatMain').classList.remove('mobile-active'); $('chatSidebar').classList.remove('mobile-hidden'); });
    $('chatInfoButton').addEventListener('click', () => { if (!state.activeId) return; $('chatInfoPanel').classList.toggle('mobile-open'); loadConversationInfo(state.activeId); });
    $('closeInfoPanel').addEventListener('click', () => $('chatInfoPanel').classList.remove('mobile-open'));
    $('messageContainer').addEventListener('click', event => { const button = event.target.closest('[data-reply-id]'); if (button) beginReply(button.dataset.replyId); });
  }

  async function init() {
    setupEvents();
    try { await loadCurrentUser(); await loadConversations(); connectSocket(); }
    catch (error) { notify(error.message || 'Could not load messenger. Please log in again.'); $('conversationList').innerHTML = '<div class="conversation-loading">Please log in to use Messenger.</div>'; }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
