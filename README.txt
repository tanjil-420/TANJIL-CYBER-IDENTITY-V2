TANJIL CYBER IDENTITY — COMMUNITY PLATFORM v2.5

A Node.js + Express + PostgreSQL community platform for public profiles, skill learning, events, project challenges and private/group messaging.

REQUIREMENTS
- Node.js >=20 and <27
- PostgreSQL

ENVIRONMENT
Create .env locally from .env.example. Configure DATABASE_URL, SESSION_SECRET, NODE_ENV and APP_URL. Never commit .env or expose database credentials/session secrets.

DATABASE
At startup, index.js applies database/schema.sql. The configured database user needs DDL permission. The schema uses CREATE TABLE IF NOT EXISTS and adds missing profile columns without deleting existing rows.

LOCAL START
npm install
npm run dev
Open http://localhost:3000

RENDER
Set environment variables in the Web Service Environment settings. Use the Internal Database URL when the app and PostgreSQL are in the same Render region. APP_URL must be the deployed website URL. After deployment, check /api/health.

FEATURES
- Register/login with PostgreSQL-backed sessions
- User profile and skills on the homepage after login
- Public beginner skill guides
- Unique visitor and registered member counters
- Public profile and QR code
- Private/group Messenger with Socket.IO
- Owner control center for analytics, members, ranks and challenge reviews
- Messenger reactions, seen receipts, typing and online presence
- Five shared themes and mobile navigation
- Skill challenges with project submissions, reviews and achievements
- Public member ranks, approved projects and achievements

See V2.5_IMPLEMENTATION_PLAN.md for implementation scope and remaining production rollout.
