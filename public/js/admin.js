'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const statLabels = {
    total_users: 'TOTAL MEMBERS',
    active_users: 'ACTIVE MEMBERS',
    new_users_week: 'NEW THIS WEEK',
    unique_visitors: 'UNIQUE VISITORS',
    total_chats: 'CONVERSATIONS',
    total_messages: 'MESSAGES SENT',
    active_events: 'ACTIVE EVENTS',
    pending_reviews: 'EVENT REVIEWS',
    open_challenges: 'OPEN CHALLENGES',
    pending_challenge_submissions: 'PROJECT REVIEWS'
  };
  const ranks = ['BEGINNER', 'SKILL EXPLORER', 'SKILL BUILDER', 'VERIFIED CREATOR', 'COMMUNITY MENTOR', 'MODERATOR', 'OPERATOR', 'PLATFORM OWNER'];

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

  function renderUsers(users) {
    const body = $('adminUsers');
    if (!users.length) {
      body.innerHTML = '<tr><td colspan="7" class="admin-loading">No members found.</td></tr>';
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
    </tr>`).join('');
  }

  async function loadControlCenter() {
    try {
      const current = await api('/api/auth/me');
      if (current.user?.role !== 'admin') {
        feedback('Admin permission required.', true);
        window.location.replace('/dashboard.html');
        return;
      }
      $('adminEyebrow').textContent = current.user.isFounder ? 'PLATFORM OWNER · PRIVATE' : 'PLATFORM ADMIN · PRIVATE';
      $('adminAccessStatus').textContent = current.user.isFounder ? 'FOUNDER ACCESS VERIFIED' : 'ADMIN ACCESS VERIFIED';
      const [stats, users] = await Promise.all([api('/api/admin/stats'), api('/api/admin/users')]);
      renderStats(stats.stats || {});
      renderUsers(users.users || []);
    } catch (error) {
      feedback(error.message, true);
      if (/login|authentication/i.test(error.message)) window.location.replace('/');
    }
  }

  $('refreshAdmin').addEventListener('click', loadControlCenter);
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
