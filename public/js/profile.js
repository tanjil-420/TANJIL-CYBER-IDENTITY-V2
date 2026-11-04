
"use strict";

const $ = id => document.getElementById(id);

const profileForm = $("profileForm");
const profileFeedback = $("profileFeedback");

let originalProfile = {};

async function profileRequest(url, options = {}) {
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
        throw new Error(data.error || "Unable to process request.");
    }

    return data;
}

function feedback(message, error = false) {
    profileFeedback.textContent = message;
    profileFeedback.style.color = error ? "#fb7185" : "#67e8f9";
}

function setValue(id, value) {
    const element = $(id);

    if (element) {
        element.value = value || "";
    }
}

function safeImageUrl(value) {
    if (!value) return "";

    try {
        const url = new URL(value);

        if (!["http:", "https:"].includes(url.protocol)) {
            return "";
        }

        return url.href;

    } catch {
        return "";
    }
}

// LIVE PREVIEW
function updatePreview() {
    const name =
        $("displayName").value.trim() || "YOUR NAME";

    const bio =
        $("bio").value.trim() ||
        "Your personal introduction goes here.";

    $("previewName").textContent = name;
    $("previewBio").textContent = bio;

    const avatar = $("previewAvatar");
    const avatarUrl = safeImageUrl($("avatarUrl").value.trim());

    if (avatarUrl) {
        const image = document.createElement("img");

        image.src = avatarUrl;
        image.alt = "Profile avatar";

        image.onerror = () => {
            avatar.replaceChildren();
            avatar.textContent = name.charAt(0).toUpperCase();
        };

        avatar.replaceChildren(image);

    } else {
        avatar.replaceChildren();
        avatar.textContent = name.charAt(0).toUpperCase();
    }
}

profileForm.addEventListener("input", updatePreview);

// LOAD PROFILE
async function loadProfile() {
    try {
        const data = await profileRequest("/api/profile/me");

        const user = data.user;
        const profile = data.profile || {};

        originalProfile = profile;

        if (!user) {
            location.replace("/");
            return;
        }

        $("previewUsername").textContent =
            "@" + user.username;

        const fields = {
            displayName: profile.displayName,
            location: profile.location,
            bio: profile.bio,
            skills: Array.isArray(profile.skills) ? profile.skills.join("\n") : "",
            website: profile.website,
            avatarUrl: profile.avatarUrl,
            facebook: profile.socials?.facebook,
            instagram: profile.socials?.instagram,
            threads: profile.socials?.threads,
            tiktok: profile.socials?.tiktok,
            github: profile.socials?.github,
            whatsapp: profile.socials?.whatsapp
        };

        Object.entries(fields).forEach(([id, value]) => {
            setValue(id, value);
        });

        $("isPublic").checked = profile.isPublic !== false;

        updatePreview();

        const publicUrl = data.publicProfileUrl ||
            `/u/${encodeURIComponent(user.username)}`;

        $("profilePublicUrl").textContent =
            new URL(publicUrl, location.origin).href;

    } catch (error) {
        if (/unauthorized|authentication/i.test(error.message)) {
            location.replace("/");
            return;
        }

        feedback(error.message, true);
    }
}

// VALIDATE SOCIAL URLS
function validateOptionalUrl(id) {
    const value = $(id).value.trim();

    if (!value) return null;

    let url;

    try {
        url = new URL(value);
    } catch {
        throw new Error(`${id.toUpperCase()}: Invalid URL.`);
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Only HTTP and HTTPS links are allowed.");
    }

    return url.href;
}

// SAVE PROFILE
profileForm.addEventListener("submit", async event => {
    event.preventDefault();

    const button = profileForm.querySelector(
        'button[type="submit"]'
    );

    button.disabled = true;
    button.textContent = "SAVING...";

    feedback("Updating your digital identity...");

    try {
        const payload = {
            displayName: $("displayName").value.trim(),
            location: $("location").value.trim(),
            bio: $("bio").value.trim(),
            skills: $("skills").value.split(/[\n,]/).map(value => value.trim()).filter(Boolean),
            website: validateOptionalUrl("website"),
            avatarUrl: validateOptionalUrl("avatarUrl"),

            socials: {
                facebook: validateOptionalUrl("facebook"),
                instagram: validateOptionalUrl("instagram"),
                threads: validateOptionalUrl("threads"),
                tiktok: validateOptionalUrl("tiktok"),
                github: validateOptionalUrl("github"),
                whatsapp: validateOptionalUrl("whatsapp")
            },

            isPublic: $("isPublic").checked
        };

        const data = await profileRequest("/api/profile/me", {
            method: "PATCH",
            body: JSON.stringify(payload)
        });

        originalProfile = data.profile || payload;

        feedback("Profile updated successfully!");

        if (data.publicProfileUrl) {
            $("profilePublicUrl").textContent =
                new URL(
                    data.publicProfileUrl,
                    location.origin
                ).href;
        }

    } catch (error) {
        feedback(error.message, true);

    } finally {
        button.disabled = false;
        button.textContent = "SAVE CHANGES";
    }
});

// COPY PUBLIC PROFILE
$("copyPublicUrl").addEventListener("click", async () => {
    const link = $("profilePublicUrl").textContent.trim();

    if (!link.startsWith("http")) {
        feedback("Public profile link is unavailable.", true);
        return;
    }

    try {
        await navigator.clipboard.writeText(link);
        feedback("Public profile link copied!");

    } catch {
        feedback("Unable to copy the link.", true);
    }
});

// INITIALIZE
loadProfile();
