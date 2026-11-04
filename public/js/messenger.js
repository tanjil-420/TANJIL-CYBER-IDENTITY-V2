
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

    if (!element) {
        console.log(message);
        return;
    }

    element.textContent = message;
    element.classList.add("show");

    setTimeout(() => {
        element.classList.remove("show");
    }, 2600);
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
    return String(name || "U").charAt(0).toUpperCase();
}

function sameId(a, b) {
    return String(a) === String(b);
}

function normalizeConversation(item) {
    return {
        id: item.id,
        type: item.type,
        name: item.type === "private"
            ? (item.other_username || item.name || "Unknown")
            : (item.name || "Unnamed Group"),

        lastMessage: item.last_message
            ? {
                content: item.last_message
            }
            : null,

        unreadCount: Number(item.unread_count || 0)
    };
}

function normalizeMessage(item) {
    return {
        id: item.id,
        conversationId: item.conversation_id ?? item.conversationId,
        senderId: item.sender_id ?? item.senderId,
        senderUsername: item.sender_username ?? item.senderUsername,
        content: item.content,
        messageType: item.message_type ?? item.messageType,
        createdAt: item.created_at ?? item.createdAt
    };
}

function setConnectionStatus(status) {
    const element = get("connectionStatus");

    if (!element) return;

    element.classList.remove("connected", "disconnected");

    if (status === "connected") {
        element.classList.add("connected");
        element.textContent = "ONLINE";
    } else if (status === "disconnected") {
        element.classList.add("disconnected");
        element.textContent = "OFFLINE";
    } else {
        element.textContent = "CONNECTING";
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

    const username = get("myChatUsername");
    const avatar = get("myChatAvatar");

    if (username) {
        username.textContent = "@" + currentUser.username;
    }

    if (avatar) {
        avatar.textContent = avatarLetter(currentUser.username);
    }

    return true;
}

// LOAD CONVERSATIONS
async function loadConversations() {
    const data = await api("/api/chat/conversations");

    conversations = (data.conversations || [])
        .map(normalizeConversation);

    renderConversations();
}

function renderConversations() {
    const container = get("conversationList");

    if (!container) return;

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

        if (
            activeConversation &&
            sameId(activeConversation.id, conversation.id)
        ) {
            item.classList.add("active");
        }

        const avatar = document.createElement("div");

        avatar.className = "chat-avatar";
        avatar.textContent = avatarLetter(conversation.name);

        const details = document.createElement("div");

        details.className = "conversation-details";

        const title = document.createElement("strong");

        title.textContent = conversation.name;

        const preview = document.createElement("p");

        preview.textContent =
            conversation.lastMessage?.content ||
            "Start a conversation";

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

    if (get("emptyChat")) {
        get("emptyChat").hidden = true;
    }

    if (get("activeChat")) {
        get("activeChat").hidden = false;
    }

    if (get("activeChatName")) {
        get("activeChatName").textContent = conversation.name;
    }

    if (get("activeChatAvatar")) {
        get("activeChatAvatar").textContent =
            avatarLetter(conversation.name);
    }

    if (get("activeChatStatus")) {
        get("activeChatStatus").textContent =
            conversation.type === "group"
                ? "GROUP CONVERSATION"
                : "PRIVATE CHAT";
    }

    if (
        window.innerWidth <= 650 &&
        get("chatSidebar")
    ) {
        get("chatSidebar").classList.add("mobile-hidden");
    }

    renderConversations();

    const container = get("messageContainer");

    if (container) {
        container.replaceChildren();

        const loading = document.createElement("p");

        loading.className = "message-loading";
        loading.textContent = "LOADING MESSAGES...";

        container.append(loading);
    }

    try {
        const data = await api(
            `/api/chat/${encodeURIComponent(conversation.id)}/messages`
        );

        if (
            !activeConversation ||
            !sameId(activeConversation.id, conversation.id)
        ) {
            return;
        }

        const messages = (data.messages || [])
            .map(normalizeMessage);

        messageCache.set(String(conversation.id), messages);

        renderMessages(messages);

        if (socket.connected) {
            socket.emit("chat:join", {
                conversationId: conversation.id
            }, response => {
                if (response && !response.success) {
                    notify(response.error || "Unable to join chat.");
                }
            });

            socket.emit("chat:read", {
                conversationId: conversation.id
            });

            conversation.unreadCount = 0;
            renderConversations();
        }

    } catch (error) {
        notify(error.message);
    }
}

// RENDER MESSAGES
function renderMessages(messages) {
    const container = get("messageContainer");

    if (!container) return;

    container.replaceChildren();

    messages.forEach(message => {
        const own = sameId(
            message.senderId,
            currentUser.id
        );

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
const messageForm = get("messageForm");

if (messageForm) {
    messageForm.addEventListener("submit", event => {
        event.preventDefault();

        if (!activeConversation) {
            notify("Select a conversation first.");
            return;
        }

        const input = get("messageInput");

        if (!input) return;

        const content = input.value.trim();

        if (!content) return;

        if (!socket.connected) {
            notify("Messenger is disconnected.");
            return;
        }

        socket.emit("chat:send", {
            conversationId: activeConversation.id,
            content
        }, response => {
            if (!response?.success) {
                notify(response?.error || "Message sending failed.");
                return;
            }

            input.value = "";
            input.style.height = "auto";
        });
    });
}

// RECEIVE NEW MESSAGE
socket.on("chat:new", rawMessage => {
    const message = normalizeMessage(rawMessage);

    const conversation = conversations.find(item =>
        sameId(item.id, message.conversationId)
    );

    if (!conversation) {
        loadConversations().catch(error => {
            notify(error.message);
        });

        return;
    }

    conversation.lastMessage = {
        content: message.content
    };

    if (
        activeConversation &&
        sameId(activeConversation.id, conversation.id)
    ) {
        const messages =
            messageCache.get(String(conversation.id)) || [];

        const alreadyExists = messages.some(item =>
            sameId(item.id, message.id)
        );

        if (!alreadyExists) {
            messages.push(message);

            messageCache.set(
                String(conversation.id),
                messages
            );

            renderMessages(messages);
        }

        if (!sameId(message.senderId, currentUser.id)) {
            socket.emit("chat:read", {
                conversationId: conversation.id
            });
        }

    } else if (
        !sameId(message.senderId, currentUser.id)
    ) {
        conversation.unreadCount =
            (conversation.unreadCount || 0) + 1;
    }

    renderConversations();
});

// FILTERS
document.querySelectorAll("[data-chat-filter]")
    .forEach(button => {
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
    if (!target) return;

    target.replaceChildren();

    if (query.length < 3) return;

    try {
        const data = await api(
            `/api/chat/users?q=${encodeURIComponent(query)}`
        );

        (data.users || []).forEach(user => {
            if (sameId(user.id, currentUser.id)) return;

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

// SEARCH INPUTS
const userSearch = get("userSearch");

if (userSearch) {
    userSearch.addEventListener("input", event => {
        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            searchUsers(
                event.target.value.trim(),
                get("searchResults")
            );
        }, 350);
    });
}

const newChatSearch = get("newChatSearch");

if (newChatSearch) {
    newChatSearch.addEventListener("input", event => {
        clearTimeout(searchTimer);

        searchTimer = setTimeout(() => {
            searchUsers(
                event.target.value.trim(),
                get("newChatResults")
            );
        }, 350);
    });
}

// START PRIVATE CHAT
async function startPrivateChat(userId) {
    try {
        const data = await api("/api/chat/private", {
            method: "POST",
            body: JSON.stringify({ userId })
        });

        closeModal("privateModal");

        await loadConversations();

        const conversation = conversations.find(item =>
            sameId(item.id, data.conversationId)
        );

        if (conversation) {
            await openConversation(conversation);
        } else {
            notify("Chat created, but conversation could not be loaded.");
        }

    } catch (error) {
        notify(error.message);
    }
}

// MODALS
function openModal(id) {
    const element = get(id);

    if (element) {
        element.hidden = false;
    }
}

function closeModal(id) {
    const element = get(id);

    if (element) {
        element.hidden = true;
    }
}

const newChatButton = get("newChatButton");

if (newChatButton) {
    newChatButton.addEventListener("click", () => {
        openModal("privateModal");
    });
}

const emptyNewChat = get("emptyNewChat");

if (emptyNewChat) {
    emptyNewChat.addEventListener("click", () => {
        openModal("privateModal");
    });
}

document.querySelectorAll("[data-close-modal]")
    .forEach(button => {
        button.addEventListener("click", () => {
            closeModal(button.dataset.closeModal);
        });
    });

// GROUP CREATION
const createGroupForm = get("createGroupForm");

if (createGroupForm) {
    createGroupForm.addEventListener("submit", async event => {
        event.preventDefault();

        const name = get("groupName")?.value.trim() || "";

        const memberIds = (get("groupMembers")?.value || "")
            .split(",")
            .map(value => value.trim())
            .filter(Boolean)
            .map(Number);

        const feedback = get("groupFeedback");

        if (
            memberIds.some(id =>
                !Number.isSafeInteger(id) || id <= 0
            )
        ) {
            if (feedback) {
                feedback.textContent =
                    "Enter valid numeric user IDs separated by commas.";
            }

            return;
        }

        try {
            const data = await api("/api/chat/groups", {
                method: "POST",
                body: JSON.stringify({
                    name,
                    memberIds
                })
            });

            if (feedback) {
                feedback.textContent =
                    "Group created successfully!";
            }

            await loadConversations();

            closeModal("groupModal");

            const group = conversations.find(item =>
                sameId(item.id, data.conversationId)
            );

            if (group) {
                await openConversation(group);
            }

        } catch (error) {
            if (feedback) {
                feedback.textContent = error.message;
            } else {
                notify(error.message);
            }
        }
    });
}

// CHAT INFO PANEL
const chatInfoButton = get("chatInfoButton");

if (chatInfoButton) {
    chatInfoButton.addEventListener("click", () => {
        if (!activeConversation) return;

        const panel = get("chatInfoPanel");
        const content = get("chatInfoContent");

        if (!panel || !content) return;

        panel.classList.toggle("mobile-open");

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
}

const closeInfoPanel = get("closeInfoPanel");

if (closeInfoPanel) {
    closeInfoPanel.addEventListener("click", () => {
        get("chatInfoPanel")?.classList.remove("mobile-open");
    });
}

// SOCKET CONNECTION
socket.on("connect", () => {
    setConnectionStatus("connected");

    socket.emit("chat:sync", response => {
        if (!response?.success) {
            notify(response?.error || "Chat synchronization failed.");
            return;
        }

        if (activeConversation) {
            socket.emit("chat:join", {
                conversationId: activeConversation.id
            });
        }
    });
});

socket.on("disconnect", () => {
    setConnectionStatus("disconnected");
});

socket.on("connect_error", () => {
    setConnectionStatus("disconnected");
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
