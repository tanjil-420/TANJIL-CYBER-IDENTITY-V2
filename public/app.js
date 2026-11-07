"use strict";

const $ = id => document.getElementById(id);
const authModal = $("authModal");
const loginForm = $("loginForm");
const registerForm = $("registerForm");
const authMessage = $("authMessage");
const menu = $("siteMenu");
const menuButton = $("mobileMenu");
const menuBackdrop = $("menuBackdrop");

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
}

function showAuthMessage(message, isError = false) {
    authMessage.textContent = message;
    authMessage.classList.toggle("error", isError);
}

function switchAuthTab(tab) {
    const isLogin = tab === "login";
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    document.querySelectorAll("[data-auth-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.authTab === tab);
    });
    showAuthMessage("");
}

function openAuth(tab = "login") {
    closeMenu();
    authModal.hidden = false;
    document.body.style.overflow = "hidden";
    switchAuthTab(tab);
    const field = authModal.querySelector(isLoginTab(tab) ? '[name="identity"]' : '[name="username"]');
    field?.focus();
}

function isLoginTab(tab) { return tab === "login"; }

function closeAuth() {
    authModal.hidden = true;
    document.body.style.overflow = "";
    showAuthMessage("");
}

function openMenu() {
    menu.classList.add("open");
    menuBackdrop.hidden = false;
    menu.setAttribute("aria-hidden", "false");
    menuButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");
}

function closeMenu() {
    menu.classList.remove("open");
    menuBackdrop.hidden = true;
    menu.setAttribute("aria-hidden", "true");
    menuButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
}

menuButton.addEventListener("click", () => menu.classList.contains("open") ? closeMenu() : openMenu());
$("closeMenu").addEventListener("click", closeMenu);
menuBackdrop.addEventListener("click", closeMenu);
menu.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
document.querySelectorAll("[data-open-auth]").forEach(button => button.addEventListener("click", () => openAuth(button.dataset.openAuth)));
document.querySelectorAll("[data-auth-tab]").forEach(button => button.addEventListener("click", () => switchAuthTab(button.dataset.authTab)));
$("closeAuth").addEventListener("click", closeAuth);
authModal.addEventListener("click", event => { if (event.target === authModal) closeAuth(); });
document.addEventListener("keydown", event => {
    if (event.key === "Escape") { closeAuth(); closeMenu(); }
});

function addNavButton(container, label, className, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", handler);
    container.append(button);
}

function renderLoggedIn(user, profile) {
    const navActions = $("navActions");
    navActions.replaceChildren();
    const dashboard = document.createElement("a");
    dashboard.className = "nav-register";
    dashboard.href = "/dashboard.html";
    dashboard.textContent = "MY DASHBOARD";
    navActions.append(dashboard);

    const menuAccount = $("menuAccount");
    menuAccount.replaceChildren();
    const accountLabel = document.createElement("p");
    accountLabel.className = "menu-signed-in";
    accountLabel.textContent = `SIGNED IN · @${user.username}`;
    menuAccount.append(accountLabel);
    const logout = document.createElement("button");
    logout.className = "nav-login";
    logout.textContent = "LOG OUT";
    logout.addEventListener("click", logoutUser);
    menuAccount.append(logout);

    document.querySelectorAll("[data-auth-only]").forEach(link => { link.hidden = false; });
    document.querySelectorAll("[data-admin-only]").forEach(link => { link.hidden = user.role !== "admin"; });
    if (user.role === "admin") {
        const ownerCenter = document.createElement("a");
        ownerCenter.className = "nav-register";
        ownerCenter.href = "/admin.html";
        ownerCenter.textContent = "OWNER CONTROL CENTER";
        navActions.append(ownerCenter);
    }
    $("memberArea").hidden = false;
    const displayName = profile.displayName || user.username;
    $("memberDisplayName").textContent = displayName;
    $("memberUsername").textContent = `@${user.username}`;
    $("memberBio").textContent = profile.bio || "Add a short introduction from Edit Profile.";
    $("memberEducation").textContent = profile.education || "Education not added";
    $("memberLocation").textContent = profile.location || "Location not added";
    $("memberRole").textContent = String(user.role || "user").toUpperCase();
    const rank = document.createElement("span");
    rank.className = "member-rank";
    rank.textContent = profile.rankTitle || "BEGINNER";
    $("memberMeta")?.append(rank);
    if (profile.avatarUrl) {
        const avatarImage = document.createElement("img");
        avatarImage.src = profile.avatarUrl;
        avatarImage.alt = `${displayName} profile photo`;
        $("memberAvatar").replaceChildren(avatarImage);
    } else {
        $("memberAvatar").textContent = displayName.charAt(0).toUpperCase();
    }
    if (user.isFounder) {
        const premium = document.createElement("span");
        premium.className = "premium-tag";
        premium.textContent = "✦ PLATFORM OWNER · FOUNDER";
        $("memberMeta")?.append(premium);
    }
    $("heroTitle").innerHTML = `WELCOME BACK,<br><span>${escapeHtml(displayName.toUpperCase())}.</span>`;
    $("heroUsername").textContent = `@${user.username} · YOUR PERSONAL SPACE`;
    $("heroEyebrow").textContent = "YOUR DIGITAL IDENTITY IS ACTIVE";
    $("systemStatus").textContent = "SIGNED IN";
    $("heroJoinButton").hidden = true;

    const skills = Array.isArray(profile.skills) ? profile.skills : [];
    const skillsBox = $("memberSkills");
    skillsBox.replaceChildren();
    if (!skills.length) {
        const empty = document.createElement("span");
        empty.className = "empty-chip";
        empty.textContent = "Add your skills from Edit Profile";
        skillsBox.append(empty);
    } else {
        skills.forEach(skill => {
            const chip = document.createElement("span");
            chip.className = "skill-chip";
            chip.textContent = skill;
            skillsBox.append(chip);
        });
    }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

async function logoutUser() {
    try {
        await apiRequest("/api/auth/logout", { method: "POST" });
        window.location.replace("/");
    } catch (error) {
        const menuAccount = $("menuAccount");
        const message = document.createElement("p");
        message.className = "menu-error";
        message.textContent = error.message;
        menuAccount.append(message);
    }
}

async function loadStats() {
    try {
        const data = await apiRequest("/api/site/stats");
        $("visitorCount").textContent = Number(data.visitorCount).toLocaleString();
        $("memberCount").textContent = Number(data.memberCount).toLocaleString();
        if (data.memberNumber) {
            $("memberNumber").textContent = `#${String(data.memberNumber).padStart(6, "0")}`;
            $("memberNumberLabel").textContent = "YOUR MEMBER NUMBER";
        }
        $("heroEyebrow").textContent = `PERSONAL DIGITAL IDENTITY · ${Number(data.visitorCount).toLocaleString()} VISITORS`;
    } catch (error) {
        console.error("Unable to load site statistics:", error.message);
    }
}

async function checkAuthentication() {
    try {
        const data = await apiRequest("/api/auth/me");
        if (data.user) renderLoggedIn(data.user, data.profile || {});
        if (data.user?.memberNumber) {
            $("memberNumber").textContent = `#${String(data.user.memberNumber).padStart(6, "0")}`;
            $("memberNumberLabel").textContent = "YOUR MEMBER NUMBER";
        }
    } catch (error) {
        if (!/login|auth|unauthorized/i.test(error.message)) console.error("Authentication status check:", error.message);
    }
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = loginForm.querySelector('[type="submit"]');
    const formData = new FormData(loginForm);
    button.disabled = true;
    button.textContent = "AUTHENTICATING...";
    showAuthMessage("Connecting to identity server...");
    try {
        await apiRequest("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ identity: formData.get("identity"), password: formData.get("password") })
        });
        showAuthMessage("Login successful. Loading your profile...");
        window.location.replace("/");
    } catch (error) {
        showAuthMessage(error.message, true);
    } finally {
        button.disabled = false;
        button.textContent = "LOGIN TO ACCOUNT";
    }
});

registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = registerForm.querySelector('[type="submit"]');
    const formData = new FormData(registerForm);
    button.disabled = true;
    button.textContent = "CREATING ACCOUNT...";
    showAuthMessage("Creating your digital identity...");
    try {
        await apiRequest("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ username: formData.get("username"), email: formData.get("email"), password: formData.get("password") })
        });
        showAuthMessage("Account created. Opening your profile...");
        window.location.replace("/");
    } catch (error) {
        showAuthMessage(error.message, true);
    } finally {
        button.disabled = false;
        button.textContent = "CREATE MY ACCOUNT";
    }
});

loadStats();
checkAuthentication();
