
"use strict";

const authModal = document.getElementById("authModal");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");

const authTabs = document.querySelectorAll("[data-auth-tab]");
const openButtons = document.querySelectorAll("[data-open-auth]");

const closeAuth = document.getElementById("closeAuth");
const mobileMenu = document.getElementById("mobileMenu");
const navLinks = document.querySelector(".nav-links");
const navActions = document.getElementById("navActions");

// API HELPER
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",

        ...options,

        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

// AUTH MESSAGE
function showAuthMessage(message, isError = false) {
    authMessage.textContent = message;

    authMessage.classList.toggle("error", isError);
}

// SWITCH AUTH TAB
function switchAuthTab(tab) {
    const isLogin = tab === "login";

    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;

    authTabs.forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.authTab === tab
        );
    });

    showAuthMessage("");
}

// OPEN AUTH MODAL
function openAuth(tab = "login") {
    authModal.hidden = false;

    document.body.style.overflow = "hidden";

    switchAuthTab(tab);
}

// CLOSE AUTH MODAL
function closeModal() {
    authModal.hidden = true;
    document.body.style.overflow = "";

    showAuthMessage("");
}

// OPEN BUTTONS
openButtons.forEach(button => {
    button.addEventListener("click", () => {
        openAuth(button.dataset.openAuth);
    });
});

// TAB BUTTONS
authTabs.forEach(button => {
    button.addEventListener("click", () => {
        switchAuthTab(button.dataset.authTab);
    });
});

// CLOSE BUTTON
closeAuth.addEventListener("click", closeModal);

// CLICK OUTSIDE
authModal.addEventListener("click", event => {
    if (event.target === authModal) {
        closeModal();
    }
});

// ESCAPE KEY
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !authModal.hidden) {
        closeModal();
    }
});

// LOGIN
loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const submitButton = loginForm.querySelector(
        'button[type="submit"]'
    );

    const formData = new FormData(loginForm);

    const payload = {
        identity: formData.get("identity"),
        password: formData.get("password")
    };

    submitButton.disabled = true;
    submitButton.textContent = "AUTHENTICATING...";

    showAuthMessage("Connecting to identity server...");

    try {
        await apiRequest("/api/auth/login", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showAuthMessage("Login successful. Loading dashboard...");

        window.location.assign("/dashboard.html");

    } catch (error) {
        showAuthMessage(error.message, true);

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "LOGIN TO ACCOUNT";
    }
});

// REGISTER
registerForm.addEventListener("submit", async event => {
    event.preventDefault();

    const submitButton = registerForm.querySelector(
        'button[type="submit"]'
    );

    const formData = new FormData(registerForm);

    const payload = {
        username: formData.get("username"),
        email: formData.get("email"),
        password: formData.get("password")
    };

    submitButton.disabled = true;
    submitButton.textContent = "CREATING ACCOUNT...";

    showAuthMessage("Creating your digital identity...");

    try {
        await apiRequest("/api/auth/register", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showAuthMessage("Account created successfully!");

        window.location.assign("/dashboard.html");

    } catch (error) {
        showAuthMessage(error.message, true);

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "CREATE MY ACCOUNT";
    }
});

// MOBILE NAVIGATION
mobileMenu.addEventListener("click", () => {
    const opened = navLinks.classList.toggle("open");

    mobileMenu.setAttribute(
        "aria-expanded",
        String(opened)
    );
});

navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        mobileMenu.setAttribute("aria-expanded", "false");
    });
});

// CHECK CURRENT LOGIN STATUS
async function checkAuthentication() {
    try {
        const data = await apiRequest("/api/auth/me");

        const user = data.user;

        navActions.replaceChildren();

        const dashboardLink = document.createElement("a");
        dashboardLink.href = "/dashboard.html";
        dashboardLink.className = "nav-register";
        dashboardLink.textContent = "DASHBOARD";

        const messengerLink = document.createElement("a");
        messengerLink.href = "/messenger.html";
        messengerLink.className = "nav-login";
        messengerLink.textContent = "MESSENGER";

        navActions.append(
            dashboardLink,
            messengerLink
        );

        const profileGreeting = document.createElement("span");

        profileGreeting.textContent = `@${user.username}`;
        profileGreeting.style.display = "none";

    } catch {
        // User is not logged in.
    }
}

// INITIALIZE
checkAuthentication();
