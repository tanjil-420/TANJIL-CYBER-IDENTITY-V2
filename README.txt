TANJIL.EXE MESSENGER FINAL FRONTEND

Files:
public/messenger.html
public/css/messenger.css
public/js/messenger.js

Copy these into your existing project's public folder, preserving the css and js subfolders.
Open /messenger.html after logging in.

Backend API assumptions based on the existing routes shared in the conversation:
GET  /api/auth/me
GET  /api/chat/conversations
GET  /api/chat/:id/messages
GET  /api/chat/users?q=
POST /api/chat/private        { userId }
POST /api/chat/groups         { name, memberIds }
Socket events: chat:sync, chat:join, chat:send, chat:new, chat:read, chat:read:update

Important: the supplied backend auth route must expose GET /api/auth/me with a user object containing id and username. If its actual endpoint/response differs, adjust loadCurrentUser() in messenger.js.
