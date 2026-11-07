'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const statLabels = {
    total_users: 'Total members',
    active_users: 'Active members',
    new_users_week: 'New this week',
    unique_visitors: 'Unique visitors',
    total_chats: 'Conversations',
    total_messages: 'Messages sent',
    active_events: 'Active events',
    pending_reviews: 'Event reviews',
    open_challenges: 'Open challenges',
    pending_challenge_submissions: 'Project reviews'
  };
  const ranks = ['BEGINNER', 'SKILL EXPLORER', 'SKILL BUILDER', 'VERIFIED CREATOR', 'COMMUNITY MENTOR', 'MODERATOR', 'OPERATOR', 'PLATFORM OWNER'];
  let allUsers = [];

  function safeHref(value) {
    const href = String(value ?? '');
    return (href.startsWith('/') && !href.startsWith('//')) || href.startsWith('#') ? href : '#';
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }

  function feedback(message, error = false) {
    const element = $('adminFeedback');
    element.textContent = message;
    element.classList.toggle('is-error', error);
  }

  function renderStats(stats) {
    $('adminStats').innerHTML = Object.entries(statLabels).map(([key, label]) =>
      `<article class="admin-stat"><small>${label}</small><strong>${Number(stats[key] || 0).toLocaleString()}</strong></article>`
    ).join('');
  }

  function renderConfiguration(configuration) {
    const modules = Array.isArray(configuration.modules) ? configuration.modules : [];
    const updates = Array.isArray(configuration.updates) ? configuration.updates : [];
    const accessRules = Array.isArray(configuration.accessRules) ? configuration.accessRules : [];
    $('adminModules').innerHTML = modules.map((module, index) => `
      <a class="admin-module" href="${esc(safeHref(module.href))}">
        <span class="admin-module-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="admin-module-label">${esc(module.label)}</span>
        <strong>${esc(module.title)}</strong>
        <span class="admin-module-description">${esc(module.description)}</span>
        <span class="admin-module-link">Open workspace <span aria-hidden="true">↗</span></span>
      </a>`).join('') || '<p class="admin-loading">No admin functions are configured.</p>';
    $('adminUpdates').innerHTML = updates.map(update => `<li>${esc(update)}</li>`).join('') ||
      '<li>No new operations notes.</li>';
    $('adminAccessRules').innerHTML = accessRules.map(rule => `<li>${esc(rule)}</li>`).join('') ||
      '<li>No access rules are configured.</li>';
  }

  function renderUsers(users) {
    allUsers = users;
    const body = $('adminUsers');
    if (!users.length) {
      body.innerHTML = '<tr><td colspan="7" class="admin-loading">No members found.</td></tr>';
      $('adminUserCount').textContent = 'No members to display.';
      return;
    }
    body.innerHTML = users.map(user => `<tr data-user-id="${esc(user.id)}">
      <td><strong>@${esc(user.username)}${user.is_platform_owner ? ' ✦ FOUNDER' : ''}</strong><small>MEMBER #${esc(user.id)}</small></td>
      <td>${esc(user.email)}</td>
      <td><select class="role-select" aria-label="Role for ${esc(user.username)}"${user.is_platform_owner ? ' disabled' : ''}><option value="user"${user.role === 'user' ? ' selected' : ''}>Member</option><option value="admin"${user.role === 'admin' ? ' selected' : ''}>Admin</option></select></td>
      <td><select class="rank-select" aria-label="Rank for ${esc(user.username)}">${ranks.map(rank => `<option value="${rank}"${(user.rank_title || 'BEGINNER') === rank ? ' selected' : ''}>${rank}</option>`).join('')}</select></td>
      <td><span class="member-status ${user.is_active ? 'active' : 'inactive'}">${user.is_active ? 'ACTIVE' : 'DISABLED'}</span></td>
      <td>${esc(new Date(user.created_at).toLocaleDateString())}</td>
      <td><button class="user-action" type="button" data-action="role"${user.is_platform_owner ? ' disabled' : ''}>SAVE ROLE</button><button class="user-action" type="button" data-action="rank">SAVE RANK</button><button class="user-action ${user.is_active ? 'danger' : ''}" type="button" data-action="status"${user.is_platform_owner ? ' disabled' : ''}>${user.is_active ? 'DISABLE' : 'ENABLE'}</button></td>
    </tr>`).join('') + '<tr id="adminNoMatches" hidden><td colspan="7" class="admin-loading">No members match this search.</td></tr>';
    filterUsers($('memberSearch').value);
  }

  function filterUsers(query) {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const rows = [...$('adminUsers').querySelectorAll('[data-user-id]')];
    let visibleCount = 0;
    rows.forEach(row => {
      const visible = row.textContent.toLocaleLowerCase().includes(normalizedQuery);
      row.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    $('adminUserCount').textContent = normalizedQuery
      ? `${visibleCount} of ${allUsers.length} members`
      : `${allUsers.length} members`;
    const empty = $('adminNoMatches');
    if (empty) empty.hidden = visibleCount > 0;
  }

  async function loadControlCenter() {
    const refreshButton = $('refreshAdmin');
    refreshButton.disabled = true;
    refreshButton.setAttribute('aria-busy', 'true');
    try {
      const current = await api('/api/auth/me');
      if (current.user?.role !== 'admin') {
        feedback('Admin permission required.', true);
        window.location.replace('/dashboard.html');
        return;
      }
      $('adminEyebrow').textContent = current.user.isFounder ? 'PLATFORM OWNER' : 'PLATFORM ADMIN';
      $('adminAccessStatus').textContent = current.user.isFounder ? 'Owner access verified' : 'Admin access verified';
      const [configuration, stats, users] = await Promise.all([
        api('/api/admin/configuration'),
        api('/api/admin/stats'),
        api('/api/admin/users')
      ]);
      renderConfiguration(configuration.configuration || {});
      renderStats(stats.stats || {});
      renderUsers(users.users || []);
    } catch (error) {
      feedback(error.message, true);
      if (/login|authentication/i.test(error.message)) window.location.replace('/');
    } finally {
      refreshButton.disabled = false;
      refreshButton.removeAttribute('aria-busy');
    }
  }

  $('refreshAdmin').addEventListener('click', loadControlCenter);
  $('memberSearch').addEventListener('input', event => filterUsers(event.target.value));
  $('adminUsers').addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const row = button.closest('[data-user-id]');
    button.disabled = true;
    try {
      if (button.dataset.action === 'role') {
        const role = row.querySelector('.role-select').value;
        await api(`/api/admin/users/${encodeURIComponent(row.dataset.userId)}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role })
        });
        feedback('Member role updated.');
      } else if (button.dataset.action === 'rank') {
        const rank = row.querySelector('.rank-select').value;
        await api(`/api/admin/users/${encodeURIComponent(row.dataset.userId)}/rank`, {
          method: 'PATCH',
          body: JSON.stringify({ rank })
        });
        feedback('Member rank updated.');
      } else {
        const isActive = row.querySelector('.member-status').classList.contains('inactive');
        await api(`/api/admin/users/${encodeURIComponent(row.dataset.userId)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive })
        });
        feedback(`Member ${isActive ? 'enabled' : 'disabled'}.`);
      }
      await loadControlCenter();
    } catch (error) {
      feedback(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
  loadControlCenter();
})();
