'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let isAdmin = false;

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
    const element = $('challengeFeedback');
    element.textContent = message;
    element.classList.toggle('is-error', error);
  }

  function renderChallenge(item) {
    const submission = item.submission_id
      ? `<div class="submission-status"><strong>${esc(String(item.submission_status || '').toUpperCase())}</strong>${item.reviewer_note ? `<p>${esc(item.reviewer_note)}</p>` : ''}${item.submission_url ? `<a href="${esc(item.submission_url)}" target="_blank" rel="noopener noreferrer">VIEW YOUR SUBMISSION ↗</a>` : ''}</div>`
      : '';
    const form = item.status === 'open' && (!item.submission_status || item.submission_status === 'revision')
      ? `<form class="challenge-submit-form" data-challenge-id="${esc(item.id)}"><label>YOUR WORK<textarea name="submissionText" maxlength="2500" rows="3" placeholder="Describe what you built, what you learned, and how to review it.">${esc(item.submission_text || '')}</textarea></label><label>PROJECT LINK<input name="submissionUrl" type="url" maxlength="2000" placeholder="https://… (optional)" value="${esc(item.submission_url || '')}"></label><button class="challenge-button" type="submit">${item.submission_status === 'revision' ? 'RESUBMIT FOR REVIEW' : 'SUBMIT YOUR WORK'}</button></form>`
      : '';
    const reviewState = item.submission_status === 'submitted' ? '<p class="challenge-muted">Your work is waiting for review.</p>' : '';
    const adminControls = isAdmin ? `<button class="quiet-button challenge-status-button" type="button" data-challenge-id="${esc(item.id)}" data-next-status="${item.status === 'open' ? 'closed' : 'open'}">${item.status === 'open' ? 'CLOSE' : 'REOPEN'}</button>` : '';
    return `<article class="challenge-card"><div class="challenge-card-head"><span class="challenge-skill">${esc(item.skill_name)}</span><span class="challenge-state ${item.status === 'open' ? 'open' : 'closed'}">${esc(item.status)}</span></div><h3>${esc(item.title)}</h3><p class="challenge-description">${esc(item.description)}</p>${item.deliverable ? `<p class="challenge-deliverable"><strong>DELIVERABLE</strong>${esc(item.deliverable)}</p>` : ''}${submission}${reviewState}${form}${adminControls ? `<div class="challenge-admin-actions">${adminControls}</div>` : ''}</article>`;
  }

  async function loadChallenges() {
    try {
      const data = await api('/api/challenges');
      $('challengeList').innerHTML = data.challenges?.length
        ? data.challenges.map(renderChallenge).join('')
        : '<p class="challenge-muted">No open challenges yet. Check back soon.</p>';
    } catch (error) {
      $('challengeList').innerHTML = `<p class="challenge-muted">${esc(error.message)}</p>`;
      if (/login|authentication/i.test(error.message)) feedback('Log in to join a challenge.', true);
    }
  }

  async function loadReviewQueue() {
    if (!isAdmin) return;
    try {
      const data = await api('/api/challenges/admin/submissions');
      $('challengeReviewQueue').innerHTML = data.submissions?.length
        ? data.submissions.map(item => `<article class="challenge-review-card" data-review-id="${esc(item.id)}"><div><span class="challenge-skill">@${esc(item.username)} · ${esc(item.skill_name)}</span><h3>${esc(item.challenge_title)}</h3><p>${esc(item.submission_text || 'No written explanation supplied.')}</p>${item.submission_url ? `<a href="${esc(item.submission_url)}" target="_blank" rel="noopener noreferrer">OPEN SUBMISSION ↗</a>` : ''}<small>Submitted ${esc(new Date(item.submitted_at).toLocaleString())}</small></div><label>REVIEW NOTE<textarea class="reviewer-note" maxlength="800" rows="2" placeholder="Optional feedback or revision request"></textarea></label><div class="review-actions"><button type="button" data-review-status="approved">APPROVE</button><button type="button" data-review-status="revision">REQUEST REVISION</button></div></article>`).join('')
        : '<p class="challenge-muted">No pending submissions. Your queue is clear.</p>';
    } catch (error) {
      $('challengeReviewQueue').innerHTML = `<p class="challenge-muted">${esc(error.message)}</p>`;
    }
  }

  async function initialize() {
    try {
      const data = await api('/api/auth/me');
      isAdmin = data.user?.role === 'admin';
      $('challengeCreatePanel').hidden = !isAdmin;
      $('challengeReviewPanel').hidden = !isAdmin;
      if (isAdmin) await loadReviewQueue();
    } catch (error) {
      feedback('Log in to browse and submit skill challenges.', true);
    }
    await loadChallenges();
  }

  $('challengeCreateForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const values = new FormData(form);
    try {
      await api('/api/challenges', {
        method: 'POST',
        body: JSON.stringify({
          title: values.get('title'),
          skillName: values.get('skillName'),
          description: values.get('description'),
          deliverable: values.get('deliverable')
        })
      });
      form.reset();
      feedback('Challenge published.');
      await loadChallenges();
    } catch (error) {
      feedback(error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  $('challengeList').addEventListener('submit', async event => {
    const form = event.target.closest('.challenge-submit-form');
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const values = new FormData(form);
    button.disabled = true;
    try {
      await api(`/api/challenges/${encodeURIComponent(form.dataset.challengeId)}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ submissionText: values.get('submissionText'), submissionUrl: values.get('submissionUrl') })
      });
      feedback('Submission sent for review.');
      await loadChallenges();
      if (isAdmin) await loadReviewQueue();
    } catch (error) {
      feedback(error.message, true);
      button.disabled = false;
    }
  });

  $('challengeList').addEventListener('click', async event => {
    const button = event.target.closest('[data-next-status]');
    if (!button) return;
    button.disabled = true;
    try {
      await api(`/api/challenges/${encodeURIComponent(button.dataset.challengeId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: button.dataset.nextStatus })
      });
      feedback(`Challenge ${button.dataset.nextStatus}.`);
      await loadChallenges();
    } catch (error) {
      feedback(error.message, true);
      button.disabled = false;
    }
  });

  $('challengeReviewQueue').addEventListener('click', async event => {
    const button = event.target.closest('[data-review-status]');
    if (!button) return;
    const card = button.closest('[data-review-id]');
    button.disabled = true;
    try {
      await api(`/api/challenges/admin/submissions/${encodeURIComponent(card.dataset.reviewId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: button.dataset.reviewStatus,
          reviewerNote: card.querySelector('.reviewer-note').value.trim()
        })
      });
      feedback(button.dataset.reviewStatus === 'approved' ? 'Project approved.' : 'Revision requested.');
      await loadReviewQueue();
    } catch (error) {
      feedback(error.message, true);
      button.disabled = false;
    }
  });
  $('refreshChallenges').addEventListener('click', loadChallenges);
  $('refreshReviews').addEventListener('click', loadReviewQueue);
  initialize();
})();
