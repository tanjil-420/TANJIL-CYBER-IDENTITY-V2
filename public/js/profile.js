
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

        if (url.protocol !== "https:" && !/^data:image\/(jpeg|png|webp);base64,/.test(value)) {
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
document.getElementById("skillPicker").addEventListener("change", () => {
    const count = collectSkills().length;
    if (count > 30) feedback("You can select up to 30 skills.", true);
    else feedback(`${count} skills selected.`);
});

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
        const selectedSkills = new Set(Array.isArray(profile.skills) ? profile.skills : []);
        document.querySelectorAll("#skillPicker input[type=checkbox]").forEach(input => {
            input.checked = selectedSkills.has(input.value);
        });
        const knownSkills = new Set([...document.querySelectorAll("#skillPicker input")].map(input => input.value));
        $("customSkills").value = (Array.isArray(profile.skills) ? profile.skills : []).filter(skill => !knownSkills.has(skill)).join(", ");

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

    if (id === "avatarUrl" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) && value.length <= 550000) {
        return value;
    }
    if (url.protocol !== "https:") {
        throw new Error("Only HTTPS links are allowed.");
    }

    return url.href;
}

function collectSkills() {
    const selected = [...document.querySelectorAll("#skillPicker input:checked")].map(input => input.value);
    const custom = $("customSkills").value.split(",").map(value => value.trim()).filter(Boolean);
    const skills = [...new Set([...selected, ...custom])].slice(0, 30);
    $("skills").value = skills.join("\n");
    return skills;
}

let cropBitmap = null;
let cropObjectUrl = null;

function cropSettings() {
    const zoom = Number($("avatarZoom").value || 1);
    const horizontal = Number($("avatarHorizontal").value || 50) / 100;
    const vertical = Number($("avatarVertical").value || 50) / 100;
    const baseSize = Math.min(cropBitmap.width, cropBitmap.height);
    const cropSize = baseSize / zoom;
    const sx = (cropBitmap.width - cropSize) * horizontal;
    const sy = (cropBitmap.height - cropSize) * vertical;
    return { sx, sy, cropSize };
}

function drawAvatarCrop(targetSize = 320, quality = 0.86) {
    if (!cropBitmap) return "";
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const context = canvas.getContext("2d", { alpha: false });
    const { sx, sy, cropSize } = cropSettings();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(cropBitmap, sx, sy, cropSize, cropSize, 0, 0, targetSize, targetSize);
    return canvas.toDataURL("image/jpeg", quality);
}

function updateAvatarCropPreview() {
    if (!cropBitmap) return;
    const preview = $("avatarCropCanvas");
    const context = preview.getContext("2d", { alpha: false });
    const { sx, sy, cropSize } = cropSettings();
    context.clearRect(0, 0, preview.width, preview.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(cropBitmap, sx, sy, cropSize, cropSize, 0, 0, preview.width, preview.height);
    $("avatarZoomValue").textContent = `${Number($("avatarZoom").value).toFixed(2)}×`;
}

function closeAvatarCropper() {
    $("avatarCropEditor").hidden = true;
    if (cropBitmap?.close) cropBitmap.close();
    cropBitmap = null;
    if (cropObjectUrl) URL.revokeObjectURL(cropObjectUrl);
    cropObjectUrl = null;
    $("avatarFile").value = "";
}

["avatarZoom", "avatarHorizontal", "avatarVertical"].forEach(id => {
    $(id).addEventListener("input", updateAvatarCropPreview);
});

$("avatarFile").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            throw new Error("Choose a JPG, PNG or WebP image.");
        }
        if (file.size > 8 * 1024 * 1024) throw new Error("Please choose a photo smaller than 8 MB.");
        if (typeof createImageBitmap !== "function") throw new Error("Your browser does not support image cropping. Please update Microsoft Edge.");
        if (cropBitmap?.close) cropBitmap.close();
        cropBitmap = await createImageBitmap(file);
        $("avatarZoom").value = "1";
        $("avatarHorizontal").value = "50";
        $("avatarVertical").value = "50";
        $("avatarCropEditor").hidden = false;
        updateAvatarCropPreview();
        feedback("Adjust your photo, then click USE THIS CROP.");
    } catch (error) {
        feedback(error.message, true);
        event.target.value = "";
    }
});

$("applyAvatarCrop").addEventListener("click", () => {
    try {
        let dataUrl = drawAvatarCrop(512, 0.86);
        let quality = 0.86;
        while (dataUrl.length > 520000 && quality > 0.42) {
            quality -= 0.08;
            dataUrl = drawAvatarCrop(512, quality);
        }
        if (!dataUrl || dataUrl.length > 550000) throw new Error("This image is still too large. Try a smaller photo.");
        $("avatarUrl").value = dataUrl;
        updatePreview();
        closeAvatarCropper();
        feedback("Square crop applied. Click SAVE CHANGES to upload your profile photo.");
    } catch (error) {
        feedback(error.message, true);
    }
});

$("cancelAvatarCrop").addEventListener("click", () => {
    closeAvatarCropper();
    feedback("Photo selection cancelled.");
});

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
            skills: collectSkills(),
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
