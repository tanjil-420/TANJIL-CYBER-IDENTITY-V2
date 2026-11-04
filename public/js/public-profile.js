"use strict";
const root = document.getElementById("publicProfileContent");
const username = new URLSearchParams(location.search).get("username");
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
async function load() {
  if (!username) { root.textContent = "No username was provided."; return; }
  try {
    const response = await fetch(`/api/profile/public/${encodeURIComponent(username)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Profile unavailable.");
    const p = data.profile;
    const avatar = p.avatarUrl ? `<img class="public-avatar-image" src="${esc(p.avatarUrl)}" alt="${esc(p.displayName || p.username)}" referrerpolicy="no-referrer">` : `<div class="member-avatar">${esc((p.displayName || p.username || "U").charAt(0).toUpperCase())}</div>`;
    const links = Object.entries(p.socials || {}).filter(([,url]) => url).map(([name,url]) => `<a class="social-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name.toUpperCase())} ↗</a>`).join("");
    root.innerHTML = `${avatar}<div class="member-details"><p class="member-label">PUBLIC DIGITAL IDENTITY</p><h2>${esc(p.displayName || p.username)}</h2><p class="member-handle">@${esc(p.username)}</p><p class="member-bio">${esc(p.bio || "No introduction added yet.")}</p><div class="member-meta">${p.education ? `<span>${esc(p.education)}</span>` : ""}${p.location ? `<span>${esc(p.location)}</span>` : ""}</div><div class="skill-chips">${(p.skills || []).map(skill => `<span class="skill-chip">${esc(skill)}</span>`).join("")}</div><div class="social-grid public-socials">${links}</div></div>`;
  } catch (error) { root.textContent = error.message; }
}
load();
