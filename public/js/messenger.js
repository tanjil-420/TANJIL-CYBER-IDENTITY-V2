
"use strict";

const socket = io({
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
});

const get = id => document.getElementById(id);

let currentUser = null;
let conversations = [];
let activeConversation = null;
let currentFilter = "all";
let typingTimer = null;
let searchTimer = null;

const messageCache = new Map();

async function api(url, options = {}) {
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

function notify(message) {
    const element = get("messengerToast");

    element.textContent = message;
    element.classList.add("show");

    setTimeout(() => element.classList.remove("show"), 2600);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function avatarLetter(name) {
    return (name || "U").charAt(0).toUpperCase();
}

function setConnectionStatus(status) {
    const element = get("connectionStatus");

    element.classList.remove(
        "connected",
        "disconnected"
    );

    if (status === "connected") {
        element.classList.add("connected");
        element.innerHTML =
            '<span class="status-dot"></span> ONLINE';
    } else if (status === "disconnected") {
        element.classList.add("disconnected");
        element.innerHTML =
            '<span class="status-dot"></span> OFFLINE';
    } else {
        element.innerHTML =
            '<span class="status-dot"></span> CONNECTING';
    }
}

// LOAD CURRENT USER
async function loadCurrentUser() {
    const data = await api("/api/auth/me");

    currentUser = data.user;

    if (!currentUser) {
        location.replace("/");
        return false;
    }

    get("myChatUsername").textContent =
        "@" + currentUser.username;

    get("myChatAvatar").textContent =
        avatarLetter(currentUser.username);

    return true;
}

// LOAD CONVERSATIONS
async function loadConversations() {
    const data = await api("/api/conversations");

    conversations = data.conversations || [];

    renderConversations();
}

function renderConversations() {
    const container = get("conversationList");

    container.replaceChildren();

    const filtered = conversations.filter(conversation => {
        return currentFilter === "all" ||
            conversation.type === currentFilter;
    });

    if (!filtered.length) {
        const empty = document.createElement("p");
        empty.className = "conversation-loading";
        empty.textContent = "NO CONVERSATIONS YET";

        container.append(empty);
        return;
    }

    filtered.forEach(conversation => {
        const item = document.createElement("div");

        item.className = "conversation-item";

        if (activeConversation?.id === conversation.id) {
            item.classList.add("active");
        }

        const name = conversation.name || "Unknown";
        const avatar = document.createElement("div");

        avatar.className = "chat-avatar";
        avatar.textContent = avatarLetter(name);

        const details = document.createElement("div");
        details.className = "conversation-details";

        const title = document.createElement("strong");
        title.textContent = name;

        const preview = document.createElement("p");
        preview.textContent =
            conversation.lastMessage?.content || "Start a conversation";

        details.append(title, preview);

        const meta = document.createElement("div");
        meta.className = "conversation-meta";

        const type = document.createElement("small");
        type.textContent =
            conversation.type === "group" ? "GROUP" : "PRIVATE";

        meta.append(type);

        if (conversation.unreadCount > 0) {
            const badge = document.createElement("span");

            badge.className = "unread-count";
            badge.textContent = conversation.unreadCount;

            meta.append(badge);
        }

        item.append(avatar, details, meta);

        item.addEventListener("click", () => {
            openConversation(conversation);
        });

        container.append(item);
    });
}

// OPEN CONVERSATION
async function openConversation(conversation) {
    activeConversation = conversation;

    get("emptyChat").hidden = true;
    get("activeChat").hidden = false;

    get("activeChatName").textContent = conversation.name;
    get("activeChatAvatar").textContent =
        avatarLetter(conversation.name);

    get("activeChatStatus").textContent =
        conversation.type === "group" ? "GROUP CONVERSATION" : "PRIVATE CHAT";

    if (window.innerWidth <= 650) {
        get("chatSidebar").classList.add("mobile-hidden");
    }

    renderConversations();

    get("messageContainer").replaceChildren();

    const loading = document.createElement("p");
    loading.className = "message-loading";
    loading.textContent = "LOADING MESSAGES...";

    get("messageContainer").append(loading);

    try {
        const data = await api(
            `/api/conversations/${encodeURIComponent(conversation.id)}/messages`
        );

        if (activeConversation?.id !== conversation.id) return;

        messageCache.set(conversation.id, data.messages || []);

        renderMessages(data.messages || []);

        if (socket.connected) {
            socket.emit("conversation:join", {
                conversationId: conversation.id
            });
        }

    } catch (error) {
        notify(error.message);
    }
}

// RENDER MESSAGES
function renderMessages(messages) {
    const container = get("messageContainer");

    container.replaceChildren();

    messages.forEach(message => {
        const own =
            String(message.senderId) === String(currentUser.id);

        const row = document.createElement("div");

        row.className = "message-row" +
            (own ? " own-message" : "");

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        const content = document.createElement("div");
        content.textContent = message.content || "";

        const meta = document.createElement("small");
        meta.className = "message-meta";

        const sender = own
            ? "YOU"
            : message.senderUsername || "MEMBER";

        const time = message.createdAt
            ? new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            })
            : "";

        meta.textContent = `${sender} · ${time}`;

        bubble.append(content, meta);
        row.append(bubble);

        container.append(row);
    });

    container.scrollTop = container.scrollHeight;
}

// SEND MESSAGE
get("messageForm").addEventListener("submit", event => {
    event.preventDefault();

    if (!activeConversation) {
        notify("Select a conversation first.");
        return;
    }

    const input = get("messageInput");
    const content = input.value.trim();

    if (!content) return;

    if (!socket.connected) {
        notify("Messenger is disconnected.");
        return;
    }

    socket.emit("message:send", {
        conversationId: activeConversation.id,
        content
    }, response => {
        if (response?.error) {
            notify(response.error);
            return;
        }

        input.value = "";
        input.style.height = "auto";
    });
});

// NEW MESSAGE
socket.on("message:new", message => {
    const conversation = conversations.find(
        item => item.id === message.conversationId
    );

    if (conversation) {
        conversation.lastMessage = message;

        if (
            activeConversation?.id === conversation.id
        ) {
            const messages =
                messageCache.get(conversation.id) || [];

            messages.push(message);

            messageCache.set(conversation.id, messages);
            renderMessages(messages);
        } else if (
            String(message.senderId) !== String(currentUser.id)
        ) {
            conversation.unreadCount =
                (conversation.unreadCount || 0) + 1;
        }

        renderConversations();
    }
});

// TYPING
get("messageInput").addEventListener("input", () => {
    if (!activeConversation || !socket.connected) return;

    socket.emit("typing:start", {
        conversationId: activeConversation.id
    });

    clearTimeout(typingTimer);

    typingTimer = setTimeout(() => {
        socket.emit("typing:stop", {
            conversationId: activeConversation.id
        });
    }, 1200);
});

socket.on("typing:update", data => {
    if (
        activeConversation?.id !== data.conversationId ||
        String(data.userId) === String(currentUser.id)
    ) return;

    get("typingIndicator").hidden = !data.isTyping;

    get("typingIndicator").textContent =
        data.isTyping
            ? `${data.username || "Someone"} is typing...`
            : "";
});

// FILTERS
document.querySelectorAll("[data-chat-filter]").forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.chatFilter;

        document.querySelectorAll("[data-chat-filter]")
            .forEach(item => item.classList.remove("active"));

        button.classList.add("active");

        renderConversations();
    });
});

// SEARCH USERS
async function searchUsers(query, target) {
    target.replaceChildren();

    if (query.length < 2) return;

    try {
        const data = await api(
            `/api/users/search?q=${encodeURIComponent(query)}`
        );

        (data.users || []).forEach(user => {
            if (String(user.id) === String(currentUser.id)) return;

            const row = document.createElement("div");
            row.className = "search-result-item";

            const name = document.createElement("strong");
            name.textContent = "@" + user.username;

            const button = document.createElement("button");
            button.textContent = "MESSAGE";

            button.addEventListener("click", () => {
                startPrivateChat(user.id);
            });

            row.append(name, button);
            target.append(row);
        });

    } catch (error) {
        notify(error.message);
    }
}

get("userSearch").addEventListener("input", event => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        searchUsers(
            event.target.value.trim(),
            get("searchResults")
        );
    }, 350);
});

get("newChatSearch").addEventListener("input", event => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        searchUsers(
            event.target.value.trim(),
            get("newChatResults")
        );
    }, 350);
});

// START PRIVATE CHAT
async function startPrivateChat(userId) {
    try {
        const data = await api("/api/conversations/private", {
            method: "POST",
            body: JSON.stringify({ userId })
        });

        closeModal("privateModal");

        await loadConversations();

        const conversation = conversations.find(
            item => item.id === data.conversation.id
        );

        if (conversation) {
            await openConversation(conversation);
        }

    } catch (error) {
        notify(error.message);
    }
}

// MODALS
function openModal(id) {
    get(id).hidden = false;
}

function closeModal(id) {
    get(id).hidden = true;
}

get("newChatButton").addEventListener("click", () => {
    openModal("privateModal");
});

get("emptyNewChat").addEventListener("click", () => {
    openModal("privateModal");
});

document.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", () => {
        closeModal(button.dataset.closeModal);
    });
});

// GROUP CREATION
get("createGroupForm").addEventListener("submit", async event => {
    event.preventDefault();

    const name = get("groupName").value.trim();

    const members = get("groupMembers").value
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);

    try {
        const data = await api("/api/conversations/group", {
            method: "POST",
            body: JSON.stringify({ name, members })
        });

        get("groupFeedback").textContent =
            "Group created successfully!";

        await loadConversations();

        closeModal("groupModal");

        const group = conversations.find(
            item => item.id === data.conversation.id
        );

        if (group) await openConversation(group);

    } catch (error) {
        get("groupFeedback").textContent = error.message;
    }
});

// GROUP BUTTON
get("chatInfoButton").addEventListener("click", () => {
    if (!activeConversation) return;

    const panel = get("chatInfoPanel");

    panel.classList.toggle("mobile-open");

    const content = get("chatInfoContent");

    content.replaceChildren();

    const title = document.createElement("h3");
    title.textContent = activeConversation.name;

    const type = document.createElement("p");
    type.textContent =
        activeConversation.type === "group"
            ? "GROUP CONVERSATION"
            : "PRIVATE CONVERSATION";

    content.append(title, type);
});

get("closeInfoPanel").addEventListener("click", () => {
    get("chatInfoPanel").classList.remove("mobile-open");
});

// SOCKET EVENTS
socket.on("connect", () => {
    setConnectionStatus("connected");

    if (activeConversation) {
        socket.emit("conversation:join", {
            conversationId: activeConversation.id
        });
    }
});

socket.on("disconnect", () => {
    setConnectionStatus("disconnected");
});

socket.on("connect_error", () => {
    setConnectionStatus("disconnected");
});

socket.on("conversation:updated", loadConversations);

socket.on("presence:update", () => {
    // Online presence updates will be displayed
    // when the backend sends user presence information.
});

// INITIALIZE
async function initializeMessenger() {
    try {
        const authenticated = await loadCurrentUser();

        if (!authenticated) return;

        await loadConversations();

        socket.connect();

    } catch (error) {
        if (/unauthorized|authentication/i.test(error.message)) {
            location.replace("/");
            return;
        }

        notify(error.message);
        setConnectionStatus("disconnected");
    }
}

initializeMessenger();
