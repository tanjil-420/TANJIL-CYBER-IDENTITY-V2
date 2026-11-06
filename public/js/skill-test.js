(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let currentData = null;
  let toastTimer = null;

  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
  }
  function toast(message) {
    const box = $('examToast'); box.textContent = message; box.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('show'), 3000);
  }
  function niceDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }
  function renderRanks(ranks, approvedCount) {
    const rankGrid = $('rankGrid');
    rankGrid.innerHTML = (ranks || []).map(rank => {
      const active = (rank.title === 'SKILL STARTER' && approvedCount >= 1) || (rank.title === 'SKILL BUILDER' && approvedCount >= 3) || (rank.title === 'SKILL GRADUATE' && approvedCount >= 7);
      return `<article class="rank-item"><strong>${esc(rank.title)}</strong><span>${esc(rank.detail)}</span><small>${active ? 'UNLOCKED' : rank.mode === 'owner' ? 'OWNER ONLY' : rank.mode === 'manual' ? 'MANUAL APPOINTMENT' : 'MILESTONE'}</small></article>`;
    }).join('');
  }
  function renderStart(data) {
    $('startPanel').hidden = false;
    const select = $('skillTrackSelect');
    const skills = data.skills || [];
    if (!skills.length) {
      select.innerHTML = '<option value="">No profile skills found</option>';
      $('startExamButton').disabled = true;
      $('startMessage').innerHTML = 'Add your skills in <a href="/profile.html">Edit Profile</a> before joining.';
      return;
    }
    $('startExamButton').disabled = false;
    select.innerHTML = skills.map(skill => `<option value="${esc(skill)}" ${skill === data.suggestedSkill ? 'selected' : ''}>${esc(skill)}</option>`).join('');
    $('startMessage').textContent = 'You can join only once with one selected skill track. Choose carefully.';
  }
  function taskStatusLabel(status) {
    return ({locked:'LOCKED',available:'AVAILABLE',submitted:'UNDER REVIEW',approved:'APPROVED',revision:'REVISION REQUESTED'})[status] || String(status).toUpperCase();
  }
  function demoPreview(task) {
    if (task.demo !== 'portfolio') return '';
    return `<div class="task-demo"><div class="task-demo-label">VISUAL BRIEF / SAMPLE LAYOUT</div><div class="demo-browser"><div class="demo-browser-bar"><i></i><i></i><i></i><span>creator-portfolio.example</span></div><div class="demo-browser-body"><div class="demo-hero-block"><b></b><small></small><em></em></div><div class="demo-side-block"><span></span><span></span><span></span></div></div></div><p class="task-meta">Suggested sections: <strong>Home · About · Skills · Projects · Contact</strong>. Choose your own colors and content; this is a layout reference, not a template to copy.</p></div>`;
  }
  function renderTask(task) {
    const locked = task.status === 'locked';
    const criteria = Array.isArray(task.criteria) ? task.criteria.map(item => `<span>✓ ${esc(item)}</span>`).join('') : '';
    const submission = task.status === 'submitted' ? `<p class="task-meta">Your work was submitted on ${esc(niceDate(task.submittedAt))}. It is waiting for Owner review.</p>` : '';
    const approved = task.status === 'approved' ? `<p class="task-meta">Approved ✓ Your work passed this task.</p>` : '';
    const revision = task.status === 'revision' ? `<div class="task-review-note"><strong>Owner feedback:</strong> ${esc(task.reviewerNote || 'Please improve this task and submit again.')}</div>` : '';
    const due = locked ? `<p class="task-countdown">Unlocks: ${esc(niceDate(task.availableAt))}</p>` : '';
    const form = ['available','revision'].includes(task.status) ? `<form class="task-submit-form" data-submit-day="${task.day}"><textarea name="submissionText" maxlength="2500" placeholder="Explain what you created, what tools you used, and where the evidence can be found...">${esc(task.submissionText || '')}</textarea><input name="submissionUrl" type="url" placeholder="HTTPS project / Drive / GitHub link (optional)" value="${esc(task.submissionUrl || '')}"><button type="submit">SUBMIT DAY ${task.day} FOR REVIEW →</button></form>` : '';
    return `<article class="exam-task-card ${locked ? 'task-locked' : ''}"><div class="task-head"><div><div class="task-day">DAY ${task.day} / 07</div><h3>${esc(task.title)}</h3></div><span class="task-status ${esc(task.status)}">${taskStatusLabel(task.status)}</span></div><p class="task-brief">${esc(task.brief)}</p><p class="task-meta"><strong>Deliverable:</strong> ${esc(task.deliverable)}</p>${demoPreview(task)}<div class="task-criteria">${criteria}</div>${due}${submission}${approved}${revision}${form}</article>`;
  }
  function renderEvent(data) {
    const enrollment = data.enrollment;
    const tasks = data.tasks || [];
    $('startPanel').hidden = true; $('progressPanel').hidden = false;
    const approved = Number(data.approvedCount || 0);
    $('progressTitle').textContent = `${enrollment.skill} TRACK`;
    $('progressSubtitle').textContent = `Started ${niceDate(enrollment.startedAt)} · One task unlocks every 24 hours.`;
    $('approvedCount').textContent = approved;
    $('progressFill').style.width = `${(approved / 7) * 100}%`;
    $('eventStatus').textContent = enrollment.status === 'completed' ? 'EVENT COMPLETED' : 'IN PROGRESS';
    $('currentRank').textContent = approved >= 7 ? 'SKILL GRADUATE' : approved >= 3 ? 'SKILL BUILDER' : approved >= 1 ? 'SKILL STARTER' : 'MEMBER';
    $('taskList').innerHTML = tasks.map(renderTask).join('');
    renderRanks(data.rankPath, approved);
  }
  async function loadAdminQueue() {
    const queue = $('reviewQueue');
    try {
      const data = await api('/api/skill-test/admin/submissions');
      if (!data.submissions?.length) { queue.innerHTML = '<p class="exam-muted">No pending submissions. Your queue is clear.</p>'; return; }
      queue.innerHTML = data.submissions.map(item => {
        const task = item.task_data || {};
        const link = item.submission_url ? `<a href="${esc(item.submission_url)}" target="_blank" rel="noopener">OPEN SUBMISSION ↗</a>` : '';
        return `<article class="review-card" data-review-id="${esc(item.id)}"><div class="task-day">@${esc(item.username)} · ${esc(item.skill_name)} · DAY ${item.day_number}</div><h3>${esc(task.title || 'Skill task')}</h3><p>${esc(item.submission_text || 'No written explanation supplied.')}</p>${link}<p class="exam-muted">Submitted ${esc(niceDate(item.submitted_at))}</p><textarea class="review-note-input" maxlength="800" placeholder="Optional feedback for the member..."></textarea><div class="review-actions"><button class="approve" type="button" data-review-action="approved">APPROVE</button><button class="revision" type="button" data-review-action="revision">REQUEST REVISION</button></div></article>`;
      }).join('');
    } catch (error) { queue.innerHTML = `<p class="exam-muted">${esc(error.message)}</p>`; }
  }
  async function loadPage() {
    try {
      const me = await api('/api/auth/me');
      const data = await api('/api/skill-test/me');
      currentData = data;
      if (me.user?.role === 'admin') { $('adminReviewPanel').hidden = false; loadAdminQueue(); }
      if (data.enrolled) renderEvent(data);
      else { renderStart(data); renderRanks(data.rankPath, 0); }
    } catch (error) {
      toast(error.message);
      $('startPanel').hidden = false;
      $('startMessage').innerHTML = 'Please <a href="/">log in</a> to join the event.';
      $('startExamButton').disabled = true;
    }
  }

  $('startExamButton').addEventListener('click', async () => {
    const skill = $('skillTrackSelect').value;
    if (!skill) return toast('Add a skill to your profile first.');
    $('startExamButton').disabled = true;
    try {
      const result = await api('/api/skill-test/start', { method: 'POST', body: JSON.stringify({ skill }) });
      toast(result.message || 'Event started.'); await loadPage();
    } catch (error) { toast(error.message); $('startExamButton').disabled = false; }
  });

  $('taskList').addEventListener('submit', async event => {
    const form = event.target.closest('[data-submit-day]'); if (!form) return;
    event.preventDefault();
    const day = form.dataset.submitDay;
    const submissionText = form.elements.submissionText.value.trim();
    const submissionUrl = form.elements.submissionUrl.value.trim();
    const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      const data = await api(`/api/skill-test/tasks/${day}/submit`, { method: 'POST', body: JSON.stringify({ submissionText, submissionUrl }) });
      toast(data.message); await loadPage();
    } catch (error) { toast(error.message); button.disabled = false; }
  });

  $('reviewQueue').addEventListener('click', async event => {
    const button = event.target.closest('[data-review-action]'); if (!button) return;
    const card = button.closest('[data-review-id]');
    const status = button.dataset.reviewAction;
    const reviewerNote = card.querySelector('.review-note-input').value.trim();
    button.disabled = true;
    try {
      const data = await api(`/api/skill-test/admin/submissions/${card.dataset.reviewId}`, { method: 'PATCH', body: JSON.stringify({ status, reviewerNote }) });
      toast(data.completed ? 'All seven tasks approved. Skill Graduate awarded!' : `Submission ${status}.`);
      await loadAdminQueue();
    } catch (error) { toast(error.message); button.disabled = false; }
  });

  loadPage();
})();
