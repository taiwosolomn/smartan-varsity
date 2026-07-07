-- ═══════════════════════════════════════════════════════════════════════════
-- Smartan Varsity — PostgreSQL Schema for Supabase
-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO USE:
--   1. Open your Supabase project dashboard
--   2. Click "SQL Editor" in the left sidebar
--   3. Paste this entire file and click "Run"
--   4. Verify all 9 tables appear in the Table Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id               VARCHAR PRIMARY KEY,
    email            VARCHAR NOT NULL UNIQUE,
    hashed_password  VARCHAR NOT NULL,
    "fullName"       VARCHAR NOT NULL,
    username         VARCHAR UNIQUE,
    "avatarUrl"      VARCHAR,
    mission          TEXT    DEFAULT '',
    "projectSummary" TEXT    DEFAULT '',
    location         VARCHAR DEFAULT '',
    goals            JSONB   DEFAULT '[]',
    "createdAt"      TIMESTAMPTZ DEFAULT NOW(),
    is_admin         BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 2. tracks
CREATE TABLE IF NOT EXISTS tracks (
    id              VARCHAR PRIMARY KEY,
    "userId"        VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR NOT NULL,
    icon            VARCHAR DEFAULT '📚',
    color           VARCHAR DEFAULT '#cc3333',
    phase           VARCHAR DEFAULT 'Phase I',
    "order"         INTEGER DEFAULT 0,
    "createdAt"     TIMESTAMPTZ DEFAULT NOW(),
    "hslHue"        INTEGER,
    "hslSaturation" INTEGER,
    "hslLightness"  INTEGER,
    icon_type       VARCHAR(10) DEFAULT 'emoji',
    icon_value      TEXT,
    icon_image_url  TEXT,
    icon_thumb_url  TEXT
);
CREATE INDEX IF NOT EXISTS idx_tracks_user ON tracks("userId");

-- 3. courses
CREATE TABLE IF NOT EXISTS courses (
    id          VARCHAR PRIMARY KEY,
    "trackId"   VARCHAR NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    name        VARCHAR NOT NULL,
    "order"     INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_courses_track ON courses("trackId");

-- 4. modules
CREATE TABLE IF NOT EXISTS modules (
    id            VARCHAR PRIMARY KEY,
    "courseId"    VARCHAR NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title         VARCHAR NOT NULL,
    type          VARCHAR DEFAULT 'reading',
    status        VARCHAR DEFAULT 'todo',
    "order"       INTEGER DEFAULT 0,
    notes         TEXT,
    "completedAt" TIMESTAMPTZ,
    "createdAt"   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules("courseId");

-- 5. session_logs
CREATE TABLE IF NOT EXISTS session_logs (
    id                 VARCHAR PRIMARY KEY,
    "userId"           VARCHAR NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    "trackId"          VARCHAR NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    topic              VARCHAR NOT NULL,
    duration           INTEGER NOT NULL,
    date               VARCHAR NOT NULL,
    rating             INTEGER DEFAULT 7,
    notes              TEXT,
    "milestoneReached" BOOLEAN DEFAULT FALSE,
    "milestoneName"    VARCHAR,
    "startTime"        VARCHAR,
    "endTime"          VARCHAR,
    "createdAt"        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_logs_user ON session_logs("userId");
CREATE INDEX IF NOT EXISTS idx_session_logs_date ON session_logs(date);

-- 6. milestones
CREATE TABLE IF NOT EXISTS milestones (
    id             VARCHAR PRIMARY KEY,
    "userId"       VARCHAR NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
    "trackId"      VARCHAR NOT NULL REFERENCES tracks(id)       ON DELETE CASCADE,
    "sessionLogId" VARCHAR          REFERENCES session_logs(id) ON DELETE CASCADE,
    name           VARCHAR NOT NULL,
    date           VARCHAR NOT NULL,
    "createdAt"    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_milestones_user  ON milestones("userId");
CREATE INDEX IF NOT EXISTS idx_milestones_track ON milestones("trackId");

-- 7. calendar_events
CREATE TABLE IF NOT EXISTS calendar_events (
    id          VARCHAR PRIMARY KEY,
    "userId"    VARCHAR NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    "trackId"   VARCHAR NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    topic       VARCHAR NOT NULL,
    date        VARCHAR NOT NULL,
    time        VARCHAR DEFAULT '09:00',
    duration    INTEGER DEFAULT 90,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events("userId");
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);

-- 8. resources
CREATE TABLE IF NOT EXISTS resources (
    id            VARCHAR PRIMARY KEY,
    "userId"      VARCHAR NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    "trackId"     VARCHAR NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    title         VARCHAR NOT NULL,
    type          VARCHAR NOT NULL,
    url           VARCHAR,
    notes         TEXT,
    "addedAt"     VARCHAR NOT NULL,
    "linkStatus"  VARCHAR,
    "lastChecked" VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_resources_user ON resources("userId");

-- 9. settings
CREATE TABLE IF NOT EXISTS settings (
    "userId"        VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    "accentColor"   VARCHAR DEFAULT '#cc3333',
    "dailyReminder" BOOLEAN DEFAULT FALSE,
    "reminderTime"  VARCHAR DEFAULT '07:00',
    "weeklyReview"  BOOLEAN DEFAULT FALSE,
    "streakNotif"   BOOLEAN DEFAULT TRUE
);
