CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(80),
    bio VARCHAR(500),
    age VARCHAR(20),
    education VARCHAR(100),
    location VARCHAR(150),
    status VARCHAR(50),
    phone VARCHAR(30),
    public_email BOOLEAN NOT NULL DEFAULT FALSE,
    public_phone BOOLEAN NOT NULL DEFAULT FALSE,
    links JSONB NOT NULL DEFAULT '{}'::jsonb,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    avatar_url TEXT,
    theme VARCHAR(30) NOT NULL DEFAULT 'cyberpunk',
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('private', 'group')),
    name VARCHAR(80),
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_at TIMESTAMPTZ,
    member_role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (member_role IN ('owner', 'admin', 'member')),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    content VARCHAR(4000) NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_public ON profiles(is_public);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions(expire);

CREATE TABLE IF NOT EXISTS site_visitors (
    visitor_hash CHAR(64) PRIMARY KEY,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_visitors_last_seen ON site_visitors(last_seen DESC);

-- V2.3 Messenger reply support
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);

-- V2.3 Seven-day skill assessment event
CREATE TABLE IF NOT EXISTS skill_test_enrollments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    skill_name VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    rank_title VARCHAR(40),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS skill_test_tasks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    enrollment_id BIGINT NOT NULL REFERENCES skill_test_enrollments(id) ON DELETE CASCADE,
    day_number SMALLINT NOT NULL CHECK (day_number BETWEEN 1 AND 7),
    task_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'submitted', 'approved', 'revision')),
    available_at TIMESTAMPTZ NOT NULL,
    submission_text VARCHAR(2500),
    submission_url TEXT,
    reviewer_note VARCHAR(800),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    UNIQUE (enrollment_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_skill_test_tasks_status ON skill_test_tasks(status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_skill_test_enrollments_user ON skill_test_enrollments(user_id);
