
"use strict";

const $ = id => document.getElementById(id);

let dashboardData = null;

async function request(url, options = {}) {
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
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

function toast(message) {
    const element = $("dashboardToast");

    element.textContent = message;
    element.classList.add("show");

    setTimeout(() => {
        element.classList.remove("show");
    }, 2800);
}

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent = value ?? "";
    }
}

function formatDate(value) {
    if (!value) return "N/A";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function renderDashboard(data) {
    const user = data.user;
    const profile = data.profile || {};
    document.querySelectorAll("[data-admin-only]").forEach(link => { link.hidden = user.role !== "admin"; });

    dashboardData = data;

    const displayName =
        profile.displayName || user.displayName || user.username;

    const avatarLetter =
        (displayName || "U").charAt(0).toUpperCase();

    setText("sidebarUsername", "@" + user.username);
    setText("welcomeUsername", displayName);
    setText("profileDisplayName", displayName);
    setText("profileUsername", "@" + user.username);
    setText("profileRank", profile.rankTitle || "BEGINNER");

    setText(
        "profileBio",
        profile.bio || "Your personal digital identity."
    );

    setText("accountUsername", user.username);
    setText("accountEmail", user.email);
    setText("accountRole", user.role || "USER");
    setText("accountRoleDetail", user.role || "USER");
    setText("accountCreated", formatDate(user.createdAt));

    setText(
        "accountStatus",
        user.isActive === false ? "INACTIVE" : "ACTIVE"
    );

    setText(
        "portfolioStatus",
        profile.isPublic === false ? "PRIVATE" : "PUBLIC"
    );

    setText(
        "unreadMessages",
        data.unreadMessages ?? 0
    );

    setText(
        "messageBadge",
        data.unreadMessages ?? 0
    );

    $("userAvatar").textContent = avatarLetter;
    $("profileAvatar").textContent = avatarLetter;

    const profileUrl =
        data.publicProfileUrl ||
        (user.username ? `/user/${encodeURIComponent(user.username)}` : "");

    const publicLink = $("publicProfileLink");

    if (publicLink && profileUrl) {
        publicLink.href = new URL(profileUrl, location.origin).href;
    }

    const qrImage = $("myQrImage");

    if (data.qrCodeUrl) {
        qrImage.src = data.qrCodeUrl;
        qrImage.hidden = false;
        $("qrLoading").hidden = true;
    } else {
        $("qrLoading").textContent = "QR NOT AVAILABLE";
    }
}

async function loadDashboard() {
    try {
        const data = await request("/api/dashboard");

        if (!data.user) {
            location.replace("/");
            return;
        }

        renderDashboard(data);

    } catch (error) {
        if (/unauthorized|authentication/i.test(error.message)) {
            location.replace("/");
            return;
        }

        toast(error.message);
    }
}

// LOGOUT
$("logoutButton")?.addEventListener("click", async () => {
    const button = $("logoutButton");

    button.disabled = true;

    try {
        await request("/api/auth/logout", {
            method: "POST"
        });

        location.replace("/");

    } catch (error) {
        toast(error.message);
        button.disabled = false;
    }
});

// REFRESH
$("refreshDashboard")?.addEventListener("click", loadDashboard);

// SIDEBAR
$("sidebarToggle")?.addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
});

// CLOSE SIDEBAR ON OUTSIDE CLICK
document.addEventListener("click", event => {
    const sidebar = $("sidebar");
    const toggle = $("sidebarToggle");

    if (
        window.innerWidth <= 800 &&
        sidebar &&
        !sidebar.contains(event.target) &&
        !toggle?.contains(event.target)
    ) {
        sidebar.classList.remove("open");
    }
});

// DOWNLOAD QR
$("downloadQr")?.addEventListener("click", async () => {
    const image = $("myQrImage");

    if (!image || image.hidden || !image.src) {
        toast("QR code is not available yet.");
        return;
    }

    try {
        const response = await fetch(image.src, {
            credentials: "same-origin"
        });

        if (!response.ok) throw new Error("QR download failed.");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = "TANJIL-PERSONAL-QR.png";
        anchor.click();

        URL.revokeObjectURL(url);

    } catch (error) {
        toast(error.message);
    }
});

// COPY PROFILE LINK
$("copyProfileLink")?.addEventListener("click", async () => {
    const link = $("publicProfileLink")?.href;

    if (!link || link.endsWith("#")) {
        toast("Public profile link unavailable.");
        return;
    }

    try {
        await navigator.clipboard.writeText(link);
        toast("Profile link copied!");

    } catch {
        toast("Unable to copy profile link.");
    }
});

// DATE
setText(
    "currentDate",
    new Date().toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    })
);

// INITIALIZE
loadDashboard();
