"use strict";
const root = document.getElementById("publicProfileContent");
function usernameFromPath() {
  try { return decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || ""); }
  catch { return ""; }
}
const username = new URLSearchParams(location.search).get("username") || usernameFromPath();
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
async function load() {
  if (!username) { root.textContent = "No username was provided."; return; }
  try {
    const response = await fetch(`/api/profile/public/${encodeURIComponent(username)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Profile unavailable.");
    const p = data.profile;
    const avatar = p.avatarUrl ? `<img class="public-avatar-image" src="${esc(p.avatarUrl)}" alt="${esc(p.displayName || p.username)}" referrerpolicy="no-referrer">` : `<div class="member-avatar">${esc((p.displayName || p.username || "U").charAt(0).toUpperCase())}</div>`;
    const socialLinks = Object.entries(p.socials || {}).filter(([,url]) => url);
    if (p.website) socialLinks.unshift(['website', p.website]);
    const links = socialLinks.map(([name,url]) => `<a class="social-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name.toUpperCase())} ↗</a>`).join("");
    const founder = p.isFounder ? '<span class="founder-badge">✦ PLATFORM FOUNDER</span>' : '';
    const achievements = (p.achievements || []).map(item => `<article class="achievement-card"><strong>🏆 ${esc(item.title)}</strong><span>${esc(item.description)}</span></article>`).join('');
    const projects = (p.projects || []).map(project => `<article class="achievement-card"><strong>${esc(project.title)}</strong><span>${esc(project.skill_name)}${project.submission_text ? ` · ${esc(project.submission_text)}` : ''}</span>${project.submission_url ? `<a href="${esc(project.submission_url)}" target="_blank" rel="noopener noreferrer">VIEW PROJECT ↗</a>` : ''}</article>`).join('');
    root.innerHTML = `${avatar}<div class="member-details"><p class="member-label">PUBLIC DIGITAL IDENTITY</p><h2>${esc(p.displayName || p.username)}</h2><p class="member-handle">@${esc(p.username)}</p><div class="identity-badges"><span class="rank-badge">${esc(p.rankTitle || 'BEGINNER')}</span>${founder}</div><p class="member-bio">${esc(p.bio || "No introduction added yet.")}</p><div class="member-meta">${p.education ? `<span>${esc(p.education)}</span>` : ""}${p.location ? `<span>${esc(p.location)}</span>` : ""}</div><div class="skill-chips">${(p.skills || []).map(skill => `<span class="skill-chip">${esc(skill)}</span>`).join("")}</div>${achievements ? `<section class="achievement-section"><h3>ACHIEVEMENTS</h3><div class="achievement-grid">${achievements}</div></section>` : ''}${projects ? `<section class="achievement-section"><h3>APPROVED PROJECTS</h3><div class="achievement-grid">${projects}</div></section>` : ''}<div class="social-grid public-socials">${links}</div></div>`;
  } catch (error) { root.textContent = error.message; }
}
load();
