import os
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
load_dotenv(env_path)
import uuid
import datetime
import shutil
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, APIRouter, File, UploadFile, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from sqlalchemy.orm import joinedload, selectinload

from database import engine, get_db, Base
from models import User, Track, Course, Module, SessionLog, Milestone, CalendarEvent, Resource, Settings
from schemas import (
    UserCreate, UserResponse, UserProfileUpdate, SettingsResponse, SettingsUpdate,
    TrackCreate, TrackUpdate, TrackResponse, TrackDetailResponse, TrackReorderList,
    CourseCreate, CourseUpdate, CourseResponse, CourseReorderList,
    ModuleCreate, ModuleUpdate, ModuleResponse, ModuleReorderList,
    SessionLogCreate, SessionLogResponse, MilestoneResponse,
    CalendarEventCreate, CalendarEventResponse, ResourceCreate, ResourceResponse,
    ChangeEmailRequest, ChangeUsernameRequest, ChangePasswordRequest, ProfileCreate
)
from auth import get_current_user, get_token_payload, get_current_admin

# Create all tables on startup (idempotent — safe to run every time)
# PostgreSQL: all columns are defined in models.py — no ALTER TABLE migrations needed
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smartan Varsity API", version="1.0")

# Ensure static directories exist
os.makedirs("backend/static/avatars", exist_ok=True)
os.makedirs("backend/static/tracks", exist_ok=True)
app.mount("/static", StaticFiles(directory="backend/static"), name="static")

# Compress all responses >= 1KB with gzip (reduces payload size by 70-90%)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Setup CORS so React frontend can communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def hex_to_hsl(hex_str: str):
    try:
        hex_str = hex_str.lstrip('#')
        if len(hex_str) == 3:
            hex_str = "".join([c*2 for c in hex_str])
        r = int(hex_str[0:2], 16) / 255.0
        g = int(hex_str[2:4], 16) / 255.0
        b = int(hex_str[4:6], 16) / 255.0
        mx = max(r, g, b)
        mn = min(r, g, b)
        diff = mx - mn
        l = (mx + mn) / 2
        if diff == 0:
            s = 0
            h = 0
        else:
            if l < 0.5:
                s = diff / (mx + mn)
            else:
                s = diff / (2 - mx - mn)
            if mx == r:
                h = (g - b) / diff + (6 if g < b else 0)
            elif mx == g:
                h = (b - r) / diff + 2
            else:
                h = (r - g) / diff + 4
            h /= 6
        return int(h * 360), int(s * 100), int(l * 100)
    except Exception:
        return 0, 0, 0

# Seed database on startup if empty
@app.on_event("startup")
def startup_event():
    from sqlalchemy import text
    from database import SessionLocal
    db_mig = SessionLocal()
    # resources migrations
    try:
        db_mig.execute(text("ALTER TABLE resources ADD COLUMN linkStatus VARCHAR;"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()
    try:
        db_mig.execute(text("ALTER TABLE resources ADD COLUMN lastChecked VARCHAR;"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()

    # tracks table HSL columns
    try:
        db_mig.execute(text("ALTER TABLE tracks ADD COLUMN hslHue INTEGER;"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()
    try:
        db_mig.execute(text("ALTER TABLE tracks ADD COLUMN hslSaturation INTEGER;"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()
    try:
        db_mig.execute(text("ALTER TABLE tracks ADD COLUMN hslLightness INTEGER;"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()

    try:
        db_mig.execute(text("ALTER TABLE milestones ADD COLUMN sessionLogId VARCHAR;"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()

    try:
        db_mig.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR;"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()
    try:
        db_mig.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (LOWER(username));"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()

    # ── Supabase Auth migration ──────────────────────────────────────────────
    try:
        db_mig.execute(text("ALTER TABLE users ADD COLUMN auth_id VARCHAR UNIQUE;"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()
    try:
        db_mig.execute(text("ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()
    # ────────────────────────────────────────────────────────────────────────

    # tracks table unique indexes
    try:
        db_mig.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS tracks_user_name_unique ON tracks (userId, LOWER(TRIM(name)));"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()
    try:
        db_mig.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS tracks_user_colour_unique ON tracks (userId, LOWER(color));"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()
    try:
        db_mig.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS tracks_user_icon_unique ON tracks (userId, icon);"))
        db_mig.commit()
    except Exception:
        db_mig.rollback()

    # Backfill HSL and username values for any existing records
    try:
        from models import Track, User
        tracks_to_backfill = db_mig.query(Track).filter(Track.hslHue == None).all()
        if tracks_to_backfill:
            for t in tracks_to_backfill:
                if t.color:
                    h, s, l = hex_to_hsl(t.color)
                    t.hslHue = h
                    t.hslSaturation = s
                    t.hslLightness = l
            db_mig.commit()

        users_to_backfill = db_mig.query(User).filter(User.username == None).all()
        if users_to_backfill:
            for u in users_to_backfill:
                base_username = u.fullName.lower().replace(" ", "").replace("@", "")
                username = base_username
                counter = 1
                while db_mig.query(User).filter(User.username == username).first() is not None:
                    username = f"{base_username}{counter}"
                    counter += 1
                u.username = username
            db_mig.commit()

        # --- ADMIN ROLE & DEACTIVATION MIGRATIONS ---
        try:
            db_mig.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'smartan' CHECK (role IN ('smartan', 'admin'));"))
            db_mig.commit()
            print("Migration: Added role column to users table.")
        except Exception:
            db_mig.rollback()

        try:
            db_mig.execute(text("UPDATE users SET role = 'admin' WHERE is_admin = TRUE;"))
            db_mig.execute(text("ALTER TABLE users DROP COLUMN is_admin;"))
            db_mig.commit()
            print("Migration: Migrated is_admin data to role and dropped is_admin column.")
        except Exception:
            db_mig.rollback()

        try:
            db_mig.execute(text("ALTER TABLE users ADD COLUMN deactivated_at TIMESTAMPTZ NULL;"))
            db_mig.commit()
            print("Migration: Added deactivated_at column to users table.")
        except Exception:
            db_mig.rollback()

        try:
            db_mig.execute(text("""
    CREATE OR REPLACE FUNCTION public.handle_auth_user_change()
    RETURNS TRIGGER AS $$
    DECLARE
      v_role TEXT;
      v_full_name TEXT;
      v_username TEXT;
      v_user_id VARCHAR;
      v_exists BOOLEAN;
      v_old_role TEXT;
    BEGIN
      v_role := COALESCE(new.raw_user_meta_data->>'role', 'smartan');
      IF v_role NOT IN ('smartan', 'admin') THEN
        v_role := 'smartan';
      END IF;

      v_full_name := COALESCE(new.raw_user_meta_data->>'fullName', new.raw_user_meta_data->>'full_name', new.email);
      SELECT EXISTS(SELECT 1 FROM public.users WHERE auth_id = new.id) INTO v_exists;

      IF NOT v_exists THEN
        v_user_id := 'u' || substr(md5(random()::text), 1, 8);
        v_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
        
        WHILE EXISTS(SELECT 1 FROM public.users WHERE username = v_username) LOOP
          v_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)) || '_' || floor(random() * 1000)::text;
        END LOOP;

        INSERT INTO public.users (id, email, auth_id, "fullName", username, role, "createdAt")
        VALUES (v_user_id, new.email, new.id, v_full_name, v_username, v_role, new.created_at);

        INSERT INTO public.settings ("userId") VALUES (v_user_id);

        IF v_role = 'admin' THEN
          INSERT INTO public.activity_log (actor_id, actor_role, event_type, event_detail, created_at)
          VALUES (v_user_id, 'admin', 'admin_role_granted', jsonb_build_object('email', new.email), now());
        END IF;
      ELSE
        SELECT role, id INTO v_old_role, v_user_id FROM public.users WHERE auth_id = new.id;

        -- Intentionally NOT touching "fullName" here. This branch re-runs on every
        -- auth.users UPDATE (login, session refresh, etc.), not just signup, and
        -- fullName is owned by the app (set once via /auth/create-profile right
        -- after signup, edited via PUT /auth/profile) — re-deriving it from
        -- raw_user_meta_data on every login would silently clobber a real name
        -- back to the email-fallback or stale signup-time metadata.
        UPDATE public.users
        SET email = new.email,
            role = v_role
        WHERE auth_id = new.id;

        IF v_old_role = 'smartan' AND v_role = 'admin' THEN
          INSERT INTO public.activity_log (actor_id, actor_role, event_type, event_detail, created_at)
          VALUES (v_user_id, 'admin', 'admin_role_granted', jsonb_build_object('email', new.email), now());
        ELSIF v_old_role = 'admin' AND v_role = 'smartan' THEN
          INSERT INTO public.activity_log (actor_id, actor_role, event_type, event_detail, created_at)
          VALUES (v_user_id, 'smartan', 'admin_role_revoked', jsonb_build_object('email', new.email), now());
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
            """))
            db_mig.execute(text("""
    DROP TRIGGER IF EXISTS on_auth_user_change ON auth.users;
    CREATE TRIGGER on_auth_user_change
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_change();
            """))
            db_mig.commit()
            print("Migration: Created handle_auth_user_change trigger function and trigger.")
        except Exception as trigger_err:
            db_mig.rollback()
            print("Migration trigger error:", trigger_err)

        try:
            db_mig.execute(text("""
    CREATE OR REPLACE FUNCTION public.auto_confirm_user()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
      NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
            """))
            db_mig.execute(text("""
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      BEFORE INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();
            """))
            db_mig.commit()
            print("Migration: Created auto_confirm_user trigger function and trigger.")
        except Exception as auto_confirm_err:
            db_mig.rollback()
            print("Migration auto_confirm trigger error:", auto_confirm_err)
    except Exception as e:
        print("Backfill error", e)
        db_mig.rollback()

    # ── Curriculum Import schema additions ─────────────────────────────────
    # modules table extensions
    for col_sql in [
        "ALTER TABLE modules ADD COLUMN IF NOT EXISTS deadline DATE",
        "ALTER TABLE modules ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'",
        "ALTER TABLE modules ADD COLUMN IF NOT EXISTS day TEXT",
        "ALTER TABLE modules ADD COLUMN IF NOT EXISTS task TEXT",
        "ALTER TABLE modules ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE modules ADD COLUMN IF NOT EXISTS due_by_week INTEGER",
    ]:
        try:
            db_mig.execute(text(col_sql))
            db_mig.commit()
        except Exception:
            db_mig.rollback()

    # courses table extensions
    for col_sql in [
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS deadline DATE",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS deliverable TEXT",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS spans_weeks TEXT",
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS reference TEXT",
    ]:
        try:
            db_mig.execute(text(col_sql))
            db_mig.commit()
        except Exception:
            db_mig.rollback()

    # tracks table extensions
    for col_sql in [
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS deadline DATE",
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS code TEXT",
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS weekly_hours NUMERIC",
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS total_hours NUMERIC",
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS track_resources JSONB",
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS smartan_builder_alignment JSONB",
        "ALTER TABLE tracks ADD COLUMN IF NOT EXISTS live_industry_experiences JSONB",
    ]:
        try:
            db_mig.execute(text(col_sql))
            db_mig.commit()
        except Exception:
            db_mig.rollback()

    # curriculum_imports table
    try:
        db_mig.execute(text("""
            CREATE TABLE IF NOT EXISTS curriculum_imports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR REFERENCES users(id) NOT NULL,
                original_filename TEXT,
                raw_json JSONB NOT NULL,
                edited_json JSONB,
                status TEXT NOT NULL DEFAULT 'draft',
                validation_errors JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                confirmed_at TIMESTAMPTZ
            )
        """))
        db_mig.commit()
    except Exception:
        db_mig.rollback()

    # module_overdue_flags table
    try:
        db_mig.execute(text("""
            CREATE TABLE IF NOT EXISTS module_overdue_flags (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                module_id VARCHAR REFERENCES modules(id) NOT NULL,
                user_id VARCHAR REFERENCES users(id) NOT NULL,
                flagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                resolved_at TIMESTAMPTZ
            )
        """))
        db_mig.commit()
    except Exception:
        db_mig.rollback()

    finally:
        db_mig.close()


# Helper function to generate safe unique IDs
def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"

# --- AUTH ROUTER ---
router_auth = APIRouter(prefix="/auth", tags=["Authentication"])


@router_auth.post("/create-profile", response_model=UserResponse)
def create_profile(
    profile_in: ProfileCreate,
    token_payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db)
):
    """
    Called by the frontend immediately after Supabase Auth signup.
    Creates (or links) a profile row in our users table.
    - If a row already exists for this auth_id → return it (idempotent).
    - If a row exists with the same email but no auth_id → link it (handles seeded user).
    - Otherwise → create a fresh profile row.
    """
    auth_id: str = token_payload.get("sub", "")
    email: str = token_payload.get("email", "")

    if not auth_id or not email:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    # Idempotent — already has a profile. Note: a DB-level trigger
    # (handle_auth_user_change) also creates this row synchronously during
    # supabase.auth.signUp(), before this endpoint ever runs, falling back to
    # the raw email as fullName since signUp() doesn't pass user metadata.
    # If the caller supplied a real fullName here, let it win over that
    # trigger-created fallback rather than silently discarding it.
    existing = db.query(User).filter(User.auth_id == auth_id).first()
    if existing:
        if profile_in.fullName and profile_in.fullName.strip() and existing.fullName != profile_in.fullName:
            existing.fullName = profile_in.fullName
            db.commit()
            db.refresh(existing)
        return existing

    # Link seeded / existing user with same email
    existing_email = db.query(User).filter(User.email == email).first()
    if existing_email and existing_email.auth_id is None:
        existing_email.auth_id = auth_id
        db.commit()
        db.refresh(existing_email)
        return existing_email

    # Create a brand-new profile
    user_id = generate_id("u")
    user = User(
        id=user_id,
        email=email,
        auth_id=auth_id,
        fullName=profile_in.fullName,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Default settings
    settings = Settings(userId=user.id)
    db.add(settings)
    db.commit()

    return user


@router_auth.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router_auth.put("/profile", response_model=UserResponse)
def update_profile(profile_in: UserProfileUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if profile_in.fullName is not None:
        current_user.fullName = profile_in.fullName
    if profile_in.mission is not None:
        current_user.mission = profile_in.mission
    if profile_in.projectSummary is not None:
        current_user.projectSummary = profile_in.projectSummary
    if profile_in.location is not None:
        current_user.location = profile_in.location
    if profile_in.goals is not None:
        current_user.goals = [goal.dict() for goal in profile_in.goals]
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router_auth.post("/avatar")
def upload_avatar(file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    file_ext = os.path.splitext(file.filename)[1]
    file_name = f"{current_user.id}_{int(datetime.datetime.utcnow().timestamp())}{file_ext}"
    file_path = os.path.join("backend/static/avatars", file_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    avatar_url = f"/static/avatars/{file_name}"
    current_user.avatarUrl = avatar_url
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {"avatarUrl": avatar_url}


@router_auth.delete("/avatar")
def remove_avatar(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.avatarUrl = None
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {"message": "Avatar removed"}


@router_auth.get("/check-username")
def check_username(username: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    normalized = username.strip().lower().replace("@", "")
    if not normalized:
        return {"available": False, "message": "Username cannot be empty"}
    existing = db.query(User).filter(func.lower(User.username) == normalized).first()
    if existing:
        if existing.id == current_user.id:
            return {"available": True, "message": "This is your current username"}
        return {"available": False, "message": "Username is already taken"}
    return {"available": True, "message": "Username is available"}


@router_auth.post("/change-username")
def change_username(req: ChangeUsernameRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # No password check — user is already authenticated via Supabase JWT
    normalized = req.newUsername.strip().lower().replace("@", "")
    if not normalized:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    existing = db.query(User).filter(func.lower(User.username) == normalized).first()
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=400, detail="Username is already taken")
    current_user.username = normalized
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {"message": "Username updated successfully"}


@router_auth.post("/signout-everywhere")
def signout_everywhere(current_user: User = Depends(get_current_user)):
    # Actual session invalidation is handled by Supabase Auth (supabase.auth.signOut())
    return {"message": "Signed out successfully"}


@router_auth.delete("/delete-account")
def delete_account(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import urllib.request
    import json
    from sqlalchemy import text
    
    supabase_url = os.getenv("SUPABASE_URL", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # 1 — Delete user from Supabase Auth using admin API
    if supabase_url and service_key:
        try:
            url = f"{supabase_url}/auth/v1/admin/users/{current_user.auth_id}"
            headers = {
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json"
            }
            req = urllib.request.Request(url, headers=headers, method="DELETE")
            with urllib.request.urlopen(req) as res:
                print(f"[Auth] Successfully deleted user {current_user.email} from Supabase Auth.")
        except Exception as e:
            print(f"[Auth] Failed to delete user {current_user.email} from Supabase Auth: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete Auth account: {e}")

    # 2 — Clean up all related tables (dependencies) before deleting the user row
    uid = current_user.id
    db.execute(text("DELETE FROM calendar_events WHERE \"userId\" = :uid"), {"uid": uid})
    db.execute(text("DELETE FROM session_logs WHERE \"userId\" = :uid"), {"uid": uid})
    db.execute(text("DELETE FROM curriculum_imports WHERE user_id = :uid"), {"uid": uid})
    db.execute(text("DELETE FROM module_overdue_flags WHERE user_id = :uid"), {"uid": uid})
    db.execute(text("DELETE FROM engagement_flag_acknowledgements WHERE smartan_id = :uid OR admin_id = :uid"), {"uid": uid})
    
    # Track hierarchy cleanup
    track_ids_res = db.execute(text("SELECT id FROM tracks WHERE \"userId\" = :uid"), {"uid": uid})
    track_ids = [row[0] for row in track_ids_res]
    for tid in track_ids:
        course_ids_res = db.execute(text("SELECT id FROM courses WHERE \"trackId\" = :tid"), {"tid": tid})
        course_ids = [row[0] for row in course_ids_res]
        for cid in course_ids:
            db.execute(text("DELETE FROM modules WHERE \"courseId\" = :cid"), {"cid": cid})
        db.execute(text("DELETE FROM courses WHERE \"trackId\" = :tid"), {"tid": tid})
    db.execute(text("DELETE FROM tracks WHERE \"userId\" = :uid"), {"uid": uid})
    
    db.execute(text("DELETE FROM notification_reads WHERE user_id = :uid"), {"uid": uid})
    db.execute(text("DELETE FROM notifications WHERE recipient_id = :uid OR sender_id = :uid"), {"uid": uid})
    db.execute(text("DELETE FROM settings WHERE \"userId\" = :uid"), {"uid": uid})

    # 3 — Delete the user profile
    db.delete(current_user)
    db.commit()
    return {"message": "Account permanently deleted"}

# --- SETTINGS ROUTER ---
router_settings = APIRouter(prefix="/settings", tags=["Settings"])

@router_settings.get("", response_model=SettingsResponse)
def get_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = db.query(Settings).filter(Settings.userId == current_user.id).first()
    if not settings:
        settings = Settings(userId=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router_settings.put("", response_model=SettingsResponse)
def update_settings(settings_in: SettingsUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = db.query(Settings).filter(Settings.userId == current_user.id).first()
    if not settings:
        settings = Settings(userId=current_user.id)
    
    if settings_in.accentColor is not None:
        settings.accentColor = settings_in.accentColor
    if settings_in.dailyReminder is not None:
        settings.dailyReminder = settings_in.dailyReminder
    if settings_in.reminderTime is not None:
        settings.reminderTime = settings_in.reminderTime
    if settings_in.weeklyReview is not None:
        settings.weeklyReview = settings_in.weeklyReview
    if settings_in.streakNotif is not None:
        settings.streakNotif = settings_in.streakNotif
        
    db.add(settings)
    db.commit()
    db.refresh(settings)
    
    # Trigger dynamic CSS variable update in the browser
    return settings

@router_settings.get("/export")
def export_user_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Gather everything owned by this user
    tracks = db.query(Track).filter(Track.userId == current_user.id).all()
    logs = db.query(SessionLog).filter(SessionLog.userId == current_user.id).all()
    calendar = db.query(CalendarEvent).filter(CalendarEvent.userId == current_user.id).all()
    resources = db.query(Resource).filter(Resource.userId == current_user.id).all()
    milestones = db.query(Milestone).filter(Milestone.userId == current_user.id).all()
    settings = db.query(Settings).filter(Settings.userId == current_user.id).first()

    # Build tracks structure including courses and modules
    tracks_export = []
    for t in tracks:
        courses_export = []
        for c in t.courses:
            modules_export = []
            for m in c.modules:
                modules_export.append({
                    "id": m.id,
                    "title": m.title,
                    "type": m.type,
                    "status": m.status,
                    "notes": m.notes,
                    "completedAt": m.completedAt.isoformat() if m.completedAt else None
                })
            courses_export.append({
                "id": c.id,
                "name": c.name,
                "order": c.order,
                "modules": modules_export
            })
        tracks_export.append({
            "id": t.id,
            "name": t.name,
            "icon": t.icon,
            "color": t.color,
            "phase": t.phase,
            "courses": courses_export
        })

    return {
        "profile": {
            "fullName": current_user.fullName,
            "mission": current_user.mission,
            "project": current_user.projectSummary,
            "goals": current_user.goals
        },
        "tracks": tracks_export,
        "logs": [{
            "id": l.id,
            "trackId": l.trackId,
            "topic": l.topic,
            "duration": l.duration,
            "date": l.date,
            "rating": l.rating,
            "notes": l.notes,
            "milestone": l.milestoneName if l.milestoneReached else None
        } for l in logs],
        "calendar": [{
            "id": ev.id,
            "trackId": ev.trackId,
            "topic": ev.topic,
            "date": ev.date,
            "time": ev.time,
            "duration": ev.duration
        } for ev in calendar],
        "resources": [{
            "id": r.id,
            "title": r.title,
            "type": r.type,
            "trackId": r.trackId,
            "url": r.url,
            "notes": r.notes,
            "added": r.addedAt
        } for r in resources],
        "milestones": [{
            "id": m.id,
            "trackId": m.trackId,
            "name": m.name,
            "date": m.date
        } for m in milestones],
        "settings": {
            "accentColor": settings.accentColor if settings else "#cc3333",
            "dailyReminder": settings.dailyReminder if settings else False,
            "reminderTime": settings.reminderTime if settings else "07:00",
            "weeklyReview": settings.weeklyReview if settings else False,
            "streakNotif": settings.streakNotif if settings else True
        }
    }

@router_settings.post("/clear")
def clear_user_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Deleting all records cascaded except user profile
    db.query(Track).filter(Track.userId == current_user.id).delete()
    db.query(SessionLog).filter(SessionLog.userId == current_user.id).delete()
    db.query(CalendarEvent).filter(CalendarEvent.userId == current_user.id).delete()
    db.query(Resource).filter(Resource.userId == current_user.id).delete()
    db.query(Milestone).filter(Milestone.userId == current_user.id).delete()
    db.commit()
    return {"message": "All data cleared successfully"}

@router_settings.post("/import")
def import_user_data(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Delete all existing tracks, logs, calendar events, resources, milestones, settings
    db.query(Track).filter(Track.userId == current_user.id).delete()
    db.query(SessionLog).filter(SessionLog.userId == current_user.id).delete()
    db.query(CalendarEvent).filter(CalendarEvent.userId == current_user.id).delete()
    db.query(Resource).filter(Resource.userId == current_user.id).delete()
    db.query(Milestone).filter(Milestone.userId == current_user.id).delete()
    db.query(Settings).filter(Settings.userId == current_user.id).delete()
    db.commit()

    # 2. Re-import profile data
    profile = data.get("profile", {})
    if "fullName" in profile:
        current_user.fullName = profile["fullName"]
    if "mission" in profile:
        current_user.mission = profile["mission"]
    if "project" in profile:
        current_user.projectSummary = profile["project"]
    if "goals" in profile:
        current_user.goals = profile["goals"]
    db.add(current_user)

    # 3. Import settings
    settings_data = data.get("settings", {})
    settings = Settings(
        userId=current_user.id,
        accentColor=settings_data.get("accentColor", "#cc3333"),
        dailyReminder=settings_data.get("dailyReminder", False),
        reminderTime=settings_data.get("reminderTime", "07:00"),
        weeklyReview=settings_data.get("weeklyReview", False),
        streakNotif=settings_data.get("streakNotif", True)
    )
    db.add(settings)

    # 4. Import tracks, courses, modules
    tracks_data = data.get("tracks", [])
    for t_data in tracks_data:
        t_id = t_data.get("id") or generate_id("t")
        h, s, l = hex_to_hsl(t_data.get("color", "#cc3333"))
        t = Track(
            id=t_id,
            userId=current_user.id,
            name=t_data.get("name"),
            icon=t_data.get("icon", "📚"),
            color=t_data.get("color", "#cc3333"),
            phase=t_data.get("phase", "Semester 1"),
            order=t_data.get("order", 0),
            hslHue=h,
            hslSaturation=s,
            hslLightness=l
        )
        db.add(t)
        
        courses_data = t_data.get("courses", [])
        for c_data in courses_data:
            c_id = c_data.get("id") or generate_id("c")
            c = Course(
                id=c_id,
                trackId=t_id,
                name=c_data.get("name"),
                order=c_data.get("order", 0)
            )
            db.add(c)
            
            modules_data = c_data.get("modules", [])
            for m_data in modules_data:
                m_id = m_data.get("id") or generate_id("m")
                completed_at_dt = None
                if m_data.get("completedAt"):
                    try:
                        completed_at_dt = datetime.datetime.fromisoformat(m_data["completedAt"])
                    except Exception:
                        pass
                m = Module(
                    id=m_id,
                    courseId=c_id,
                    title=m_data.get("title"),
                    type=m_data.get("type", "reading"),
                    status=m_data.get("status", "todo"),
                    notes=m_data.get("notes"),
                    completedAt=completed_at_dt
                )
                db.add(m)

    # 5. Import session logs
    logs_data = data.get("logs", [])
    for l_data in logs_data:
        l_id = l_data.get("id") or generate_id("l")
        log = SessionLog(
            id=l_id,
            userId=current_user.id,
            trackId=l_data.get("trackId"),
            topic=l_data.get("topic"),
            duration=l_data.get("duration", 0),
            date=l_data.get("date"),
            rating=l_data.get("rating", 7),
            notes=l_data.get("notes"),
            milestoneReached=True if l_data.get("milestone") else False,
            milestoneName=l_data.get("milestone"),
            startTime=l_data.get("startTime"),
            endTime=l_data.get("endTime")
        )
        db.add(log)

    # 6. Import calendar events
    calendar_data = data.get("calendar", [])
    for ev_data in calendar_data:
        ev_id = ev_data.get("id") or generate_id("ev")
        ev = CalendarEvent(
            id=ev_id,
            userId=current_user.id,
            trackId=ev_data.get("trackId"),
            topic=ev_data.get("topic"),
            date=ev_data.get("date"),
            time=ev_data.get("time", "09:00"),
            duration=ev_data.get("duration", 90)
        )
        db.add(ev)

    # 7. Import resources
    resources_data = data.get("resources", [])
    for r_data in resources_data:
        r_id = r_data.get("id") or generate_id("r")
        r = Resource(
            id=r_id,
            userId=current_user.id,
            trackId=r_data.get("trackId"),
            title=r_data.get("title"),
            type=r_data.get("type"),
            url=r_data.get("url"),
            notes=r_data.get("notes"),
            addedAt=r_data.get("added") or datetime.date.today().isoformat()
        )
        db.add(r)

    # 8. Import milestones
    milestones_data = data.get("milestones", [])
    for m_data in milestones_data:
        m_id = m_data.get("id") or generate_id("ms")
        m = Milestone(
            id=m_id,
            userId=current_user.id,
            trackId=m_data.get("trackId"),
            name=m_data.get("name"),
            date=m_data.get("date")
        )
        db.add(m)

    db.commit()
    return {"message": "Data imported successfully"}


router_tracks = APIRouter(prefix="/tracks", tags=["Tracks"])

@router_tracks.post("/upload-icon")
def upload_track_icon(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # 15 MB size limit (read up to 15MB + 1 byte to detect oversize)
    MAX_BYTES = 15 * 1024 * 1024
    contents = file.file.read(MAX_BYTES + 1)
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 15 MB.")

    import io
    try:
        from PIL import Image as PILImage
        img = PILImage.open(io.BytesIO(contents)).convert("RGBA")
        # Square-crop to min dimension (centre)
        w, h = img.size
        min_dim = min(w, h)
        left = (w - min_dim) // 2
        top  = (h - min_dim) // 2
        img = img.crop((left, top, left + min_dim, top + min_dim))

        base_name = f"track_{uuid.uuid4().hex}"
        sizes = {"full": 192, "thumb": 48}
        urls = {}
        for label, px in sizes.items():
            resized = img.resize((px, px), PILImage.LANCZOS)
            # Convert RGBA to RGB (JPEG can't handle alpha)
            bg = PILImage.new("RGB", resized.size, (255, 255, 255))
            bg.paste(resized, mask=resized.split()[3] if resized.mode == 'RGBA' else None)
            fname = f"{base_name}_{label}.jpg"
            fpath = os.path.join("backend/static/tracks", fname)
            bg.save(fpath, "JPEG", quality=90)
            urls[label] = f"/static/tracks/{fname}"
        return {"iconUrl": urls["full"], "thumbUrl": urls["thumb"]}

    except ImportError:
        # Pillow not installed — fall back to raw save
        file_ext = os.path.splitext(file.filename)[1] or ".jpg"
        file_name = f"track_{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join("backend/static/tracks", file_name)
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        icon_url = f"/static/tracks/{file_name}"
        return {"iconUrl": icon_url, "thumbUrl": icon_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")

@router_tracks.get("", response_model=List[TrackResponse])
def get_tracks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Track).filter(Track.userId == current_user.id).order_by(Track.order).all()

@router_tracks.get("/detailed", response_model=List[TrackDetailResponse])
def get_detailed_tracks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Use selectinload to batch-load courses and modules in 3 queries instead of N*M lazy queries
    return (
        db.query(Track)
        .filter(Track.userId == current_user.id)
        .order_by(Track.order)
        .options(
            selectinload(Track.courses).selectinload(Course.modules)
        )
        .all()
    )


def validate_track_uniqueness(
    user_id: str,
    name: str,
    color: str,
    icon: str,
    db: Session,
    exclude_track_id: Optional[str] = None
):
    import re
    # 1. Name is empty
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Track name is required.")
        
    # Query all user's tracks (except the one being edited)
    query = db.query(Track).filter(Track.userId == user_id)
    if exclude_track_id:
        query = query.filter(Track.id != exclude_track_id)
    existing_tracks = query.all()
    
    # Pre-calculate target HSL
    target_h, target_s, target_l = hex_to_hsl(color)
    
    # Helper to check HSL similarity
    def is_similar_color(h1, s1, l1, h2, s2, l2):
        if h1 is None or s1 is None or l1 is None or h2 is None or s2 is None or l2 is None:
            return False
        hue_diff = abs(h1 - h2)
        hue_diff = min(hue_diff, 360 - hue_diff)
        return hue_diff < 15 and abs(s1 - s2) < 15 and abs(l1 - l2) < 10

    # 2. Name already exists (case-insensitive & whitespace trimmed)
    normalized_target_name = re.sub(r'\s+', ' ', name.strip().lower())
    for t in existing_tracks:
        normalized_existing_name = re.sub(r'\s+', ' ', t.name.strip().lower())
        if normalized_target_name == normalized_existing_name:
            raise HTTPException(status_code=409, detail=f"You already have a track called '{t.name}'. Choose a different name.")

    # 3. Check for Colour AND emoji both match existing track (highest precedence collision check)
    for t in existing_tracks:
        hex_match = t.color.lower().strip() == color.lower().strip()
        hsl_match = False
        if t.hslHue is not None:
            hsl_match = is_similar_color(target_h, target_s, target_l, t.hslHue, t.hslSaturation, t.hslLightness)
        if (hex_match or hsl_match) and t.icon == icon:
            raise HTTPException(status_code=409, detail=f"This combination is identical to {t.name}. Change at least one.")

    # 4. Colour too similar to existing
    for t in existing_tracks:
        hex_match = t.color.lower().strip() == color.lower().strip()
        hsl_match = False
        if t.hslHue is not None:
            hsl_match = is_similar_color(target_h, target_s, target_l, t.hslHue, t.hslSaturation, t.hslLightness)
        if hex_match or hsl_match:
            raise HTTPException(status_code=409, detail=f"Colour is too close to your {t.name} track ({t.color}).")

    # 5. Emoji uniqueness — only enforced for emoji-type icons
    for t in existing_tracks:
        if t.icon == icon and not (icon.startswith('/') or icon.startswith('http')):
            raise HTTPException(status_code=409, detail=f"{icon} is already used by {t.name}.")

@router_tracks.post("", response_model=TrackResponse)
def create_track(track_in: TrackCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    validate_track_uniqueness(
        user_id=current_user.id,
        name=track_in.name,
        color=track_in.color,
        icon=track_in.icon,
        db=db
    )
    
    max_order = db.query(func.max(Track.order)).filter(Track.userId == current_user.id).scalar() or 0
    track_id = generate_id("t")
    h, s, l = hex_to_hsl(track_in.color)
    # Resolve effective icon value
    effective_icon_type  = track_in.icon_type or "emoji"
    effective_icon_value = track_in.icon_value if track_in.icon_value is not None else track_in.icon
    # For backwards compat: icon column stores the display value
    display_icon = effective_icon_value if effective_icon_type != "image" else (track_in.icon_value or track_in.icon)
    track = Track(
        id=track_id,
        userId=current_user.id,
        name=track_in.name,
        icon=display_icon or track_in.icon,
        color=track_in.color,
        phase=track_in.phase,
        order=max_order + 1,
        hslHue=h,
        hslSaturation=s,
        hslLightness=l,
        icon_type=effective_icon_type,
        icon_value=effective_icon_value,
        icon_image_url=track_in.icon_image_url,
        icon_thumb_url=track_in.icon_thumb_url,
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return track

@router_tracks.get("/{track_id}", response_model=TrackDetailResponse)
def get_track_detail(track_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    track = (
        db.query(Track)
        .filter(Track.id == track_id, Track.userId == current_user.id)
        .options(selectinload(Track.courses).selectinload(Course.modules))
        .first()
    )
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track

@router_tracks.put("/reorder")
def reorder_tracks(reorder_in: TrackReorderList, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for item in reorder_in.tracks:
        track = db.query(Track).filter(Track.id == item.trackId, Track.userId == current_user.id).first()
        if track:
            track.order = item.order
            db.add(track)
    db.commit()
    return {"message": "Tracks reordered successfully"}

@router_tracks.put("/{track_id}", response_model=TrackResponse)
def update_track(track_id: str, track_in: TrackUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id, Track.userId == current_user.id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    name = track_in.name if track_in.name is not None else track.name
    icon = track_in.icon if track_in.icon is not None else track.icon
    color = track_in.color if track_in.color is not None else track.color
    
    validate_track_uniqueness(
        user_id=current_user.id,
        name=name,
        color=color,
        icon=icon,
        db=db,
        exclude_track_id=track_id
    )
    
    if track_in.name is not None:
        track.name = track_in.name
    if track_in.icon is not None:
        track.icon = track_in.icon
    if track_in.color is not None:
        track.color = track_in.color
        h, s, l = hex_to_hsl(track_in.color)
        track.hslHue = h
        track.hslSaturation = s
        track.hslLightness = l
    if track_in.phase is not None:
        track.phase = track_in.phase
    if track_in.order is not None:
        track.order = track_in.order
    # New icon-type fields
    if track_in.icon_type is not None:
        track.icon_type = track_in.icon_type
    if track_in.icon_value is not None:
        track.icon_value = track_in.icon_value
        # Keep legacy icon column in sync for backwards compat
        track.icon = track_in.icon_value
    if track_in.icon_image_url is not None:
        track.icon_image_url = track_in.icon_image_url
    if track_in.icon_thumb_url is not None:
        track.icon_thumb_url = track_in.icon_thumb_url

    db.add(track)
    db.commit()
    db.refresh(track)
    return track

@router_tracks.delete("/{track_id}")
def delete_track(track_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id, Track.userId == current_user.id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    db.delete(track)
    db.commit()
    return {"message": "Track deleted"}

# --- COURSES ROUTER ---
router_courses = APIRouter(prefix="/courses", tags=["Courses"])

@router_courses.post("/track/{track_id}", response_model=CourseResponse)
def create_course(track_id: str, course_in: CourseCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id, Track.userId == current_user.id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    max_order = db.query(func.max(Course.order)).filter(Course.trackId == track_id).scalar() or 0
    course_id = generate_id("c")
    course = Course(
        id=course_id,
        trackId=track_id,
        name=course_in.name,
        order=max_order + 1
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course

@router_courses.put("/reorder")
def reorder_courses(reorder_in: CourseReorderList, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for item in reorder_in.courses:
        # Make sure user owns the track this course belongs to
        course = db.query(Course).join(Track).filter(Course.id == item.courseId, Track.userId == current_user.id).first()
        if course:
            course.order = item.order
            db.add(course)
    db.commit()
    return {"message": "Courses reordered successfully"}

@router_courses.put("/{course_id}", response_model=CourseResponse)
def update_course(course_id: str, course_in: CourseUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).join(Track).filter(Course.id == course_id, Track.userId == current_user.id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    if course_in.name is not None:
        course.name = course_in.name
    if course_in.order is not None:
        course.order = course_in.order
        
    db.add(course)
    db.commit()
    db.refresh(course)
    return course

@router_courses.delete("/{course_id}")
def delete_course(course_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).join(Track).filter(Course.id == course_id, Track.userId == current_user.id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()
    return {"message": "Course deleted"}

# --- MODULES ROUTER ---
router_modules = APIRouter(prefix="/modules", tags=["Modules"])

@router_modules.post("/course/{course_id}", response_model=ModuleResponse)
def create_module(course_id: str, module_in: ModuleCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.query(Course).join(Track).filter(Course.id == course_id, Track.userId == current_user.id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    max_order = db.query(func.max(Module.order)).filter(Module.courseId == course_id).scalar() or 0
    module_id = generate_id("m")
    module = Module(
        id=module_id,
        courseId=course_id,
        title=module_in.title,
        type=module_in.type,
        status="todo",
        order=max_order + 1
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return module

@router_modules.put("/reorder")
def reorder_modules(reorder_in: ModuleReorderList, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for item in reorder_in.modules:
        module = db.query(Module).join(Course).join(Track).filter(Module.id == item.moduleId, Track.userId == current_user.id).first()
        if module:
            module.order = item.order
            db.add(module)
    db.commit()
    return {"message": "Modules reordered successfully"}

@router_modules.put("/{module_id}", response_model=ModuleResponse)
def update_module(module_id: str, module_in: ModuleUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    module = db.query(Module).join(Course).join(Track).filter(Module.id == module_id, Track.userId == current_user.id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
        
    if module_in.title is not None:
        module.title = module_in.title
    if module_in.type is not None:
        module.type = module_in.type
    if module_in.order is not None:
        module.order = module_in.order
    if module_in.notes is not None:
        module.notes = module_in.notes
        
    if module_in.status is not None:
        old_status = module.status
        module.status = module_in.status
        if module_in.status == "done" and old_status != "done":
            module.completedAt = datetime.datetime.utcnow()
        elif module_in.status != "done":
            module.completedAt = None
            
    db.add(module)
    db.commit()
    db.refresh(module)
    return module

@router_modules.delete("/{module_id}")
def delete_module(module_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    module = db.query(Module).join(Course).join(Track).filter(Module.id == module_id, Track.userId == current_user.id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    db.delete(module)
    db.commit()
    return {"message": "Module deleted"}

# --- SESSION LOGS ROUTER ---
router_logs = APIRouter(prefix="/logs", tags=["Session Logs"])

@router_logs.get("")
def get_logs(
    page: Optional[int] = None,
    limit: int = 20,
    trackId: Optional[str] = None,
    sort: str = "newest",
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    month: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from fastapi.encoders import jsonable_encoder
    query = db.query(SessionLog).filter(SessionLog.userId == current_user.id)
    if trackId and trackId != "all":
        query = query.filter(SessionLog.trackId == trackId)
    if month:
        query = query.filter(SessionLog.date.like(f"{month}%"))
    else:
        if from_date:
            query = query.filter(SessionLog.date >= from_date)
        if to_date:
            query = query.filter(SessionLog.date <= to_date)
    
    # Sort mapping
    if sort == "newest":
        query = query.order_by(SessionLog.date.desc(), SessionLog.createdAt.desc())
    elif sort == "oldest":
        query = query.order_by(SessionLog.date.asc(), SessionLog.createdAt.asc())
    elif sort == "highest_rated":
        query = query.order_by(SessionLog.rating.desc())
    elif sort == "lowest_rated":
        query = query.order_by(SessionLog.rating.asc())
    elif sort == "longest":
        query = query.order_by(SessionLog.duration.desc())
    elif sort == "shortest":
        query = query.order_by(SessionLog.duration.asc())

    total = query.count()

    if page is not None:
        offset = (page - 1) * limit
        logs = query.offset(offset).limit(limit).all()
        return {
            "logs": jsonable_encoder(logs),
            "total": total
        }

    logs = query.all()
    return jsonable_encoder(logs)

@router_logs.get("/stats")
def get_logs_stats(
    trackId: Optional[str] = None,
    milestoneOnly: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(SessionLog).filter(SessionLog.userId == current_user.id)
    if trackId and trackId != "all":
        query = query.filter(SessionLog.trackId == trackId)
    if milestoneOnly:
        query = query.filter(SessionLog.milestoneReached == True)
        
    logs = query.all()
    count = len(logs)
    total_minutes = sum(l.duration for l in logs)
    
    rated_logs = [l.rating for l in logs if l.rating is not None]
    avg_rating = sum(rated_logs) / len(rated_logs) if rated_logs else 0.0
    
    milestone_count = sum(1 for l in logs if l.milestoneReached)
    
    return {
        "count": count,
        "totalMinutes": total_minutes,
        "avgRating": round(avg_rating, 1),
        "milestoneCount": milestone_count
    }

@router_logs.post("", response_model=SessionLogResponse)
def create_log(log_in: SessionLogCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify track owner
    track = db.query(Track).filter(Track.id == log_in.trackId, Track.userId == current_user.id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    log_id = generate_id("l")
    log = SessionLog(
        id=log_id,
        userId=current_user.id,
        trackId=log_in.trackId,
        topic=log_in.topic,
        duration=log_in.duration,
        date=log_in.date,
        rating=log_in.rating,
        notes=log_in.notes,
        milestoneReached=log_in.milestoneReached,
        milestoneName=log_in.milestoneName if log_in.milestoneReached else None,
        startTime=log_in.startTime,
        endTime=log_in.endTime
    )
    db.add(log)
    db.flush()  # Force insert SessionLog first to satisfy the milestone's foreign key constraint
    
    # Auto-create milestone if selected
    if log_in.milestoneReached and log_in.milestoneName:
        ms_id = generate_id("ms")
        milestone = Milestone(
            id=ms_id,
            userId=current_user.id,
            trackId=log_in.trackId,
            sessionLogId=log.id,
            name=log_in.milestoneName,
            date=log_in.date
        )
        db.add(milestone)
        
        # Log milestone to activity_log
        from models import ActivityLog
        db.add(ActivityLog(
            user_id=current_user.id,
            actor_id=current_user.id,
            actor_role=current_user.role,
            event_type="milestone_recorded",
            event_detail={"name": log_in.milestoneName, "trackName": track.name}
        ))
        
    # Log session to activity_log
    from models import ActivityLog
    db.add(ActivityLog(
        user_id=current_user.id,
        actor_id=current_user.id,
        actor_role=current_user.role,
        event_type="session_logged",
        event_detail={"topic": log.topic, "duration": log.duration, "trackName": track.name}
    ))
        
    db.commit()
    db.refresh(log)
    return log

@router_logs.put("/{log_id}", response_model=SessionLogResponse)
def update_log(log_id: str, log_in: SessionLogCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log = db.query(SessionLog).filter(SessionLog.id == log_id, SessionLog.userId == current_user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Session log not found")
    track = db.query(Track).filter(Track.id == log_in.trackId, Track.userId == current_user.id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    old_track_id = log.trackId
    old_date = log.date

    log.trackId = log_in.trackId
    log.topic = log_in.topic
    log.duration = log_in.duration
    log.date = log_in.date
    log.rating = log_in.rating
    log.notes = log_in.notes
    log.startTime = log_in.startTime
    log.endTime = log_in.endTime
    
    # Milestone updates logic
    if log_in.milestoneReached:
        if not log.milestoneReached:
            m_id = generate_id("ms")
            milestone = Milestone(
                id=m_id,
                userId=current_user.id,
                trackId=log_in.trackId,
                sessionLogId=log.id,
                name=log_in.milestoneName or f"Breakthrough in {log_in.topic}",
                date=log_in.date
            )
            db.add(milestone)
            log.milestoneReached = True
            log.milestoneName = milestone.name
        else:
            milestone = db.query(Milestone).filter(
                (Milestone.sessionLogId == log.id) | 
                ((Milestone.trackId == old_track_id) & (Milestone.date == old_date) & (Milestone.userId == current_user.id))
            ).first()
            if milestone:
                milestone.name = log_in.milestoneName or f"Breakthrough in {log_in.topic}"
                milestone.trackId = log_in.trackId
                milestone.sessionLogId = log.id
                milestone.date = log_in.date
                log.milestoneName = milestone.name
            else:
                m_id = generate_id("ms")
                milestone = Milestone(
                    id=m_id,
                    userId=current_user.id,
                    trackId=log_in.trackId,
                    sessionLogId=log.id,
                    name=log_in.milestoneName or f"Breakthrough in {log_in.topic}",
                    date=log_in.date
                )
                db.add(milestone)
                log.milestoneName = milestone.name
    else:
        if log.milestoneReached:
            milestone = db.query(Milestone).filter(
                (Milestone.sessionLogId == log.id) | 
                ((Milestone.trackId == old_track_id) & (Milestone.date == old_date) & (Milestone.userId == current_user.id))
            ).first()
            if milestone:
                db.delete(milestone)
            log.milestoneReached = False
            log.milestoneName = None
            
    db.commit()
    db.refresh(log)
    return log

@router_logs.delete("/{log_id}")
def delete_log(log_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log = db.query(SessionLog).filter(SessionLog.id == log_id, SessionLog.userId == current_user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Session log not found")
    db.delete(log)
    db.commit()
    return {"message": "Log deleted"}

# --- MILESTONES ROUTER ---
router_milestones = APIRouter(prefix="/milestones", tags=["Milestones"])

@router_milestones.get("", response_model=List[MilestoneResponse])
def get_milestones(current_user: User = Depends(get_current_user), db: Session = Depends(get_db), trackId: Optional[str] = None):
    query = db.query(Milestone).filter(Milestone.userId == current_user.id)
    if trackId and trackId != 'all':
        query = query.filter(Milestone.trackId == trackId)
    return query.order_by(Milestone.date.desc()).all()

@router_milestones.delete("/{milestone_id}")
def delete_milestone(milestone_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id, Milestone.userId == current_user.id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    
    if milestone.sessionLogId:
        log = db.query(SessionLog).filter(SessionLog.id == milestone.sessionLogId, SessionLog.userId == current_user.id).first()
        if log:
            log.milestoneReached = False
            log.milestoneName = None
            db.add(log)
            
    db.delete(milestone)
    db.commit()
    return {"message": "Milestone deleted"}

# --- CALENDAR ROUTER ---
router_calendar = APIRouter(prefix="/calendar", tags=["Calendar"])

@router_calendar.get("", response_model=List[CalendarEventResponse])
def get_calendar_events(month: Optional[str] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Fetch custom calendar events
    query = db.query(CalendarEvent).filter(CalendarEvent.userId == current_user.id)
    if month:
        query = query.filter(CalendarEvent.date.like(f"{month}%"))
    custom_events = query.all()
    
    # 2. Fetch module deadlines (joining courses and tracks to filter by userId)
    from sqlalchemy import text as sqltext
    module_query_str = """
        SELECT m.id, m.title, m.deadline, t.id AS track_id
        FROM modules m
        JOIN courses c ON m."courseId" = c.id
        JOIN tracks t ON c."trackId" = t.id
        WHERE t."userId" = :uid AND m.deadline IS NOT NULL
    """
    params = {"uid": current_user.id}
    if month:
        module_query_str += " AND CAST(m.deadline AS text) LIKE :month"
        params["month"] = f"{month}%"
        
    module_rows = db.execute(sqltext(module_query_str), params).fetchall()
    
    # Merge custom events and module deadlines
    events = []
    # Add custom events
    for e in custom_events:
        events.append(CalendarEventResponse(
            id=e.id,
            trackId=e.trackId,
            topic=e.topic,
            date=str(e.date),
            time=e.time,
            duration=e.duration
        ))
        
    # Add module deadlines formatted as calendar events
    for r in module_rows:
        events.append(CalendarEventResponse(
            id=r.id,
            trackId=r.track_id,
            topic=f"Deadline: {r.title}",
            date=str(r.deadline),
            time="09:00",
            duration=60
        ))
        
    # Sort by date desc
    events.sort(key=lambda x: x.date, reverse=True)
    return events

@router_calendar.post("", response_model=CalendarEventResponse)
def create_calendar_event(event_in: CalendarEventCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == event_in.trackId, Track.userId == current_user.id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    event_id = generate_id("ev")
    event = CalendarEvent(
        id=event_id,
        userId=current_user.id,
        trackId=event_in.trackId,
        topic=event_in.topic,
        date=event_in.date,
        time=event_in.time,
        duration=event_in.duration
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

@router_calendar.put("/{event_id}", response_model=CalendarEventResponse)
def update_calendar_event(event_id: str, event_in: CalendarEventCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id, CalendarEvent.userId == current_user.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    track = db.query(Track).filter(Track.id == event_in.trackId, Track.userId == current_user.id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    event.trackId = event_in.trackId
    event.topic = event_in.topic
    event.date = event_in.date
    event.time = event_in.time
    event.duration = event_in.duration
    db.commit()
    db.refresh(event)
    return event

@router_calendar.delete("/{event_id}")
def delete_calendar_event(event_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id, CalendarEvent.userId == current_user.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    db.delete(event)
    db.commit()
    return {"message": "Calendar event deleted"}

# --- RESOURCES ROUTER ---
router_resources = APIRouter(prefix="/resources", tags=["Resources"])

def check_resource_link(resource_id: str, url: str):
    import urllib.request
    import datetime
    status = "ok"
    try:
        req = urllib.request.Request(
            url, 
            method='HEAD',
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=4) as response:
            code = response.getcode()
            if code >= 400:
                status = "broken"
    except Exception:
        try:
            req = urllib.request.Request(
                url, 
                method='GET',
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req, timeout=4) as response:
                code = response.getcode()
                if code >= 400:
                    status = "broken"
        except Exception:
            status = "broken"
            
    from database import SessionLocal
    new_db = SessionLocal()
    try:
        db_res = new_db.query(Resource).filter(Resource.id == resource_id).first()
        if db_res:
            db_res.linkStatus = status
            db_res.lastChecked = datetime.date.today().isoformat()
            new_db.commit()
    except Exception as e:
        print("Link check error", e)
        new_db.rollback()
    finally:
        new_db.close()

@router_resources.get("/fetch-title")
def fetch_url_title(url: str, current_user: User = Depends(get_current_user)):
    import urllib.request
    import re
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, timeout=4) as response:
            html = response.read().decode('utf-8', errors='ignore')
            match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
            if match:
                title = match.group(1).strip()
                title = title.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                return {"title": title}
    except Exception:
        pass
    return {"title": ""}

@router_resources.get("", response_model=List[ResourceResponse])
def get_resources(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    resources = db.query(Resource).filter(Resource.userId == current_user.id).order_by(Resource.addedAt.desc()).all()
    
    # Asynchronous background link checker triggers
    import datetime
    today = datetime.date.today()
    for r in resources:
        if r.url:
            needs_check = False
            if not r.lastChecked:
                needs_check = True
            else:
                try:
                    lc_date = datetime.date.fromisoformat(r.lastChecked)
                    if (today - lc_date).days >= 7:
                        needs_check = True
                except Exception:
                    needs_check = True
            
            if needs_check:
                background_tasks.add_task(check_resource_link, r.id, r.url)
                
    return resources

@router_resources.post("", response_model=ResourceResponse)
def create_resource(res_in: ResourceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == res_in.trackId, Track.userId == current_user.id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    res_id = generate_id("r")
    res = Resource(
        id=res_id,
        userId=current_user.id,
        trackId=res_in.trackId,
        title=res_in.title,
        type=res_in.type,
        url=res_in.url,
        notes=res_in.notes,
        addedAt=datetime.date.today().isoformat()
    )
    db.add(res)
    db.commit()
    db.refresh(res)
    return res

@router_resources.put("/{res_id}", response_model=ResourceResponse)
def update_resource(
    res_id: str,
    res_in: ResourceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    res = db.query(Resource).filter(Resource.id == res_id, Resource.userId == current_user.id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")
    track = db.query(Track).filter(Track.id == res_in.trackId, Track.userId == current_user.id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    res.trackId = res_in.trackId
    res.title = res_in.title
    res.type = res_in.type
    res.url = res_in.url
    res.notes = res_in.notes
    db.commit()
    db.refresh(res)
    return res

@router_resources.delete("/{res_id}")
def delete_resource(res_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    res = db.query(Resource).filter(Resource.id == res_id, Resource.userId == current_user.id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Resource not found")
    db.delete(res)
    db.commit()
    return {"message": "Resource deleted"}

# --- ANALYTICS ROUTER ---
router_analytics = APIRouter(prefix="/analytics", tags=["Analytics"])

def get_filtered_logs_query(
    db: Session,
    user_id: int,
    trackId: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    query = db.query(SessionLog).filter(SessionLog.userId == user_id)
    if trackId and trackId != 'all':
        query = query.filter(SessionLog.trackId == trackId)
    if from_date:
        query = query.filter(SessionLog.date >= from_date)
    if to_date:
        query = query.filter(SessionLog.date <= to_date)
    return query

@router_analytics.get("/summary")
def get_analytics_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    trackId: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to")
):
    logs = get_filtered_logs_query(db, current_user.id, trackId, from_date, to_date).all()
    
    # 1. Total hours
    total_mins = sum(l.duration for l in logs)
    total_hours = round(total_mins / 60, 1)
    
    # 2. Avg session
    avg_sess = round(total_mins / len(logs)) if logs else 0
    
    # 3. Average mastery
    ratings = [l.rating for l in logs if l.rating is not None]
    avg_mastery = round(sum(ratings) / len(ratings), 1) if ratings else None
    
    # 4. Streak Calculation
    unique_dates = sorted(list(set(l.date for l in logs)), reverse=True)
    streak = 0
    today_str = datetime.date.today().isoformat()
    yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    
    if unique_dates:
        cur_date = datetime.date.today()
        if unique_dates[0] == yesterday_str:
            cur_date = datetime.date.today() - datetime.timedelta(days=1)
        elif unique_dates[0] != today_str:
            cur_date = None
        
        if cur_date:
            for d in unique_dates:
                expected_str = cur_date.isoformat()
                if d == expected_str:
                    streak += 1
                    cur_date -= datetime.timedelta(days=1)
                elif d < expected_str:
                    break

    # 5. Hours this month
    this_month_prefix = datetime.date.today().isoformat()[:7]
    month_mins = sum(l.duration for l in logs if l.date.startswith(this_month_prefix))
    month_hours = round(month_mins / 60, 1)
    
    # 6. Sessions this week
    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())
    monday_str = monday.isoformat()
    week_sessions_count = sum(1 for l in logs if l.date >= monday_str)
    
    # 7. Active tracks count
    active_track_ids = set(l.trackId for l in logs)
    active_tracks = len(active_track_ids)
    
    return {
        "totalHours": total_hours,
        "avgSession": avg_sess,
        "avgMastery": avg_mastery or "—",
        "streak": streak,
        "hoursThisMonth": month_hours,
        "sessionsThisWeek": week_sessions_count,
        "activeTracks": active_tracks
    }

@router_analytics.get("/by-track")
def get_analytics_by_track(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    trackId: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to")
):
    logs = get_filtered_logs_query(db, current_user.id, trackId, from_date, to_date).all()
    
    tracks_query = db.query(Track).filter(Track.userId == current_user.id)
    if trackId and trackId != 'all':
        tracks_query = tracks_query.filter(Track.id == trackId)
    tracks = tracks_query.all()
    
    track_durations = {}
    track_session_counts = {}
    for l in logs:
        track_durations[l.trackId] = track_durations.get(l.trackId, 0) + l.duration
        track_session_counts[l.trackId] = track_session_counts.get(l.trackId, 0) + 1
        
    result = []
    for t in tracks:
        mins = track_durations.get(t.id, 0)
        session_count = track_session_counts.get(t.id, 0)
        result.append({
            "trackId": t.id,
            "name": t.name,
            "icon": t.icon,
            "color": t.color,
            "hours": round(mins / 60, 1),
            "sessionCount": session_count
        })
    return result

@router_analytics.get("/heatmap")
def get_heatmap(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    trackId: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to")
):
    logs = get_filtered_logs_query(db, current_user.id, trackId, from_date, to_date).all()
    daily_durations = {}
    daily_counts = {}
    for l in logs:
        daily_durations[l.date] = daily_durations.get(l.date, 0) + l.duration
        daily_counts[l.date] = daily_counts.get(l.date, 0) + 1
        
    if from_date and to_date:
        try:
            start_date = datetime.date.fromisoformat(from_date)
            end_date = datetime.date.fromisoformat(to_date)
        except Exception:
            start_date = datetime.date.today() - datetime.timedelta(days=89)
            end_date = datetime.date.today()
    else:
        start_date = datetime.date.today() - datetime.timedelta(days=89)
        end_date = datetime.date.today()
        
    result = []
    curr = start_date
    while curr <= end_date:
        d_str = curr.isoformat()
        mins = daily_durations.get(d_str, 0)
        count = daily_counts.get(d_str, 0)
        
        if mins == 0:
            lvl = 0
        elif mins < 60:
            lvl = 1
        elif mins < 120:
            lvl = 2
        elif mins < 180:
            lvl = 3
        else:
            lvl = 4
            
        result.append({
            "date": d_str,
            "minutes": mins,
            "level": lvl,
            "sessionCount": count
        })
        curr += datetime.timedelta(days=1)
        
    return result

@router_analytics.get("/mastery")
def get_mastery_trend(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    trackId: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to")
):
    query = get_filtered_logs_query(db, current_user.id, trackId, from_date, to_date)
    logs = query.filter(SessionLog.rating != None).order_by(SessionLog.date.asc()).all()

    # Pre-fetch all tracks once into a dict — avoids 1 DB query per log (N+1)
    tracks_map = {
        t.id: t
        for t in db.query(Track).filter(Track.userId == current_user.id).all()
    }

    result = []
    for l in logs:
        track = tracks_map.get(l.trackId)
        result.append({
            "id": l.id,
            "date": l.date,
            "rating": l.rating,
            "topic": l.topic,
            "trackName": track.name if track else "Unknown",
            "trackColor": track.color if track else "#888888"
        })
    return result

@router_analytics.get("/streak")
def get_streak_details(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    trackId: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to")
):
    logs = get_filtered_logs_query(db, current_user.id, trackId, from_date, to_date).all()
    
    this_month_prefix = datetime.date.today().isoformat()[:7]
    month_logs = [l for l in logs if l.date.startswith(this_month_prefix)]
    
    unique_dates = sorted(list(set(l.date for l in logs)))
    
    current_streak = 0
    best_streak = 0
    
    if unique_dates:
        temp_streak = 0
        prev_date = None
        for d_str in unique_dates:
            d = datetime.date.fromisoformat(d_str)
            if prev_date is None:
                temp_streak = 1
            else:
                delta = (d - prev_date).days
                if delta == 1:
                    temp_streak += 1
                elif delta > 1:
                    if temp_streak > best_streak:
                        best_streak = temp_streak
                    temp_streak = 1
            prev_date = d
        if temp_streak > best_streak:
            best_streak = temp_streak
            
        today = datetime.date.today()
        yesterday = today - datetime.timedelta(days=1)
        if today.isoformat() in unique_dates or yesterday.isoformat() in unique_dates:
            start_date = today if today.isoformat() in unique_dates else yesterday
            while start_date.isoformat() in unique_dates:
                current_streak += 1
                start_date -= datetime.timedelta(days=1)
                
    ratings = [l.rating for l in logs if l.rating is not None]
    avg_mastery = round(sum(ratings) / len(ratings), 1) if ratings else 0.0
    
    # Calculate total hours this month / filtered range
    total_mins = sum(l.duration for l in logs)
    total_hours = round(total_mins / 60, 1)
    
    # Calculate month hours specifically
    month_mins = sum(l.duration for l in month_logs)
    month_hours = round(month_mins / 60, 1)
    
    return {
        "currentStreak": current_streak,
        "bestStreak": max(best_streak, current_streak),
        "sessionsCount": len(logs),
        "avgMastery": avg_mastery,
        "totalHours": total_hours,
        "monthHours": month_hours
    }

# --- DASHBOARD ROUTER ---
router_dashboard = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router_dashboard.get("/summary")
def get_dashboard_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Fetch user logs and tracks — pre-build a tracks lookup dict to avoid N+1 queries
    logs = db.query(SessionLog).filter(SessionLog.userId == current_user.id).all()
    tracks = db.query(Track).filter(Track.userId == current_user.id).order_by(Track.order).all()
    tracks_map = {t.id: t for t in tracks}
    
    # 2. Total hours
    total_mins = sum(l.duration for l in logs)
    total_hours = round(total_mins / 60, 1)
    
    # 3. Logged this week (Monday to Sunday)
    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())
    sunday = monday + datetime.timedelta(days=6)
    monday_str = monday.isoformat()
    sunday_str = sunday.isoformat()
    logged_this_week = db.query(SessionLog).filter(
        SessionLog.userId == current_user.id,
        SessionLog.date >= monday_str,
        SessionLog.date <= sunday_str
    ).count()
    
    # 4. Streak Calculation
    unique_dates = sorted(list(set(l.date for l in logs)), reverse=True)
    streak = 0
    today_str = today.isoformat()
    yesterday_str = (today - datetime.timedelta(days=1)).isoformat()
    if unique_dates:
        cur_date = today
        if unique_dates[0] == yesterday_str:
            cur_date = today - datetime.timedelta(days=1)
        elif unique_dates[0] != today_str:
            cur_date = None
            
        if cur_date:
            for d in unique_dates:
                expected_str = cur_date.isoformat()
                if d == expected_str:
                    streak += 1
                    cur_date -= datetime.timedelta(days=1)
                elif d < expected_str:
                    break

    # 5. Average Mastery
    ratings = [l.rating for l in logs if l.rating is not None]
    avg_mastery = round(sum(ratings) / len(ratings), 1) if ratings else 0.0
    rated_logs_count = len(ratings)
    
    # 6. Tracks counts
    tracks_count = len(tracks)
    
    # 7. Track progress list — use a single GROUP BY query instead of 2 queries per track
    module_counts = db.query(
        Course.trackId,
        func.count(Module.id).label('total'),
        func.sum(case((Module.status == 'done', 1), else_=0)).label('done')
    ).join(Module, Module.courseId == Course.id).group_by(Course.trackId).all()
    module_stats = {row.trackId: (row.total, row.done) for row in module_counts}

    track_progress = []
    for t in tracks:
        total_modules, done_modules = module_stats.get(t.id, (0, 0))
        progress = round(done_modules / total_modules * 100) if total_modules > 0 else 0
        track_progress.append({
            "id": t.id,
            "name": t.name,
            "icon": t.icon,
            "color": t.color,
            "progress": progress
        })
        
    # 8. Today's planned events and logged sessions
    planned_events = db.query(CalendarEvent).filter(
        CalendarEvent.userId == current_user.id,
        CalendarEvent.date == today_str
    ).all()
    
    planned_list = []
    for e in planned_events:
        t = tracks_map.get(e.trackId)
        planned_list.append({
            "id": e.id,
            "topic": e.topic,
            "time": e.time,
            "duration": e.duration,
            "trackColor": t.color if t else "#ccc",
            "trackName": t.name if t else "Unknown"
        })
        
    logged_today = db.query(SessionLog).filter(
        SessionLog.userId == current_user.id,
        SessionLog.date == today_str
    ).all()
    
    logged_list = []
    for l in logged_today:
        t = tracks_map.get(l.trackId)
        logged_list.append({
            "id": l.id,
            "topic": l.topic,
            "duration": l.duration,
            "startTime": l.startTime,
            "endTime": l.endTime,
            "trackColor": t.color if t else "#ccc",
            "trackName": t.name if t else "Unknown"
        })
        
    # 9. Recent activity (last 8 sessions)
    recent_logs = db.query(SessionLog).filter(SessionLog.userId == current_user.id).order_by(
        SessionLog.date.desc(), SessionLog.createdAt.desc()
    ).limit(8).all()
    
    recent_list = []
    for rl in recent_logs:
        t = tracks_map.get(rl.trackId)
        recent_list.append({
            "id": rl.id,
            "topic": rl.topic,
            "duration": rl.duration,
            "date": rl.date,
            "startTime": rl.startTime,
            "endTime": rl.endTime,
            "rating": rl.rating,
            "notes": rl.notes,
            "trackName": t.name if t else "Unknown",
            "trackColor": t.color if t else "#ccc",
            "trackIcon": t.icon if t else "📚"
        })
        
    return {
        "stats": {
            "totalHours": total_hours,
            "loggedThisWeek": logged_this_week,
            "tracksCount": tracks_count,
            "streakCount": streak
        },
        "trackProgress": track_progress,
        "averageMastery": {
            "value": avg_mastery,
            "ratedLogsCount": rated_logs_count
        },
        "today": {
            "planned": planned_list,
            "logged": logged_list
        },
        "recentActivity": recent_list
    }

# --- DUE TODAY / THIS WEEK ENDPOINT ---
router_due = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router_due.get("/due-today")
def get_due_today(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns modules due today and this week for the Smartan, and runs overdue checks."""
    from sqlalchemy import text as sqltext
    import datetime

    today = datetime.date.today()
    today_str = today.isoformat()
    week_start = today - datetime.timedelta(days=today.weekday())
    week_end = week_start + datetime.timedelta(days=6)
    week_start_str = week_start.isoformat()
    week_end_str = week_end.isoformat()

    # Fetch modules due today (incomplete, deadline == today)
    due_today_rows = db.execute(sqltext("""
        SELECT m.id, m.title, m.deadline, m.status, m."completedAt",
               c.name AS course_name, t.name AS track_name, t.color AS track_color,
               t.id AS track_id, c.id AS course_id
        FROM modules m
        JOIN courses c ON m."courseId" = c.id
        JOIN tracks t ON c."trackId" = t.id
        WHERE t."userId" = :uid
          AND m.deadline = :today
          AND m."completedAt" IS NULL
        ORDER BY t.name, c.name, m."order"
    """), {"uid": current_user.id, "today": today_str}).fetchall()

    due_today = [
        {
            "id": str(r.id), "title": r.title,
            "deadline": str(r.deadline) if r.deadline else None,
            "status": r.status,
            "course_name": r.course_name, "track_name": r.track_name,
            "track_color": r.track_color, "track_id": r.track_id,
            "course_id": r.course_id
        } for r in due_today_rows
    ]

    # Fetch modules due this week (incomplete, deadline > today, deadline <= sunday)
    this_week_rows = db.execute(sqltext("""
        SELECT m.id, m.title, m.deadline, m.status, m."completedAt",
               c.name AS course_name, t.name AS track_name, t.color AS track_color,
               t.id AS track_id, c.id AS course_id
        FROM modules m
        JOIN courses c ON m."courseId" = c.id
        JOIN tracks t ON c."trackId" = t.id
        WHERE t."userId" = :uid
          AND m.deadline > :today
          AND m.deadline <= :week_end
          AND m."completedAt" IS NULL
        ORDER BY m.deadline, t.name, c.name, m."order"
    """), {"uid": current_user.id, "today": today_str, "week_end": week_end_str}).fetchall()

    this_week = [
        {
            "id": str(r.id), "title": r.title,
            "deadline": str(r.deadline) if r.deadline else None,
            "status": r.status,
            "course_name": r.course_name, "track_name": r.track_name,
            "track_color": r.track_color, "track_id": r.track_id,
            "course_id": r.course_id
        } for r in this_week_rows
    ]

    # Overdue check: flag any module 3+ days overdue that isn't yet flagged
    three_days_ago = (today - datetime.timedelta(days=3)).isoformat()
    overdue_rows = db.execute(sqltext("""
        SELECT m.id, m.deadline FROM modules m
        JOIN courses c ON m."courseId" = c.id
        JOIN tracks t ON c."trackId" = t.id
        WHERE t."userId" = :uid
          AND m.deadline IS NOT NULL
          AND m.deadline <= :three_days_ago
          AND m."completedAt" IS NULL
    """), {"uid": current_user.id, "three_days_ago": three_days_ago}).fetchall()

    for row in overdue_rows:
        mid = str(row.id)
        # Check if already flagged (unresolved)
        existing_flag = db.execute(sqltext("""
            SELECT id FROM module_overdue_flags
            WHERE module_id = :mid AND user_id = :uid AND resolved_at IS NULL
        """), {"mid": mid, "uid": current_user.id}).fetchone()

        if not existing_flag:
            # Insert overdue flag
            db.execute(sqltext("""
                INSERT INTO module_overdue_flags (module_id, user_id, flagged_at)
                VALUES (:mid, :uid, now())
            """), {"mid": mid, "uid": current_user.id})

            # Log to activity_log — plugs into existing admin engagement flags system
            db.execute(sqltext("""
                INSERT INTO activity_log (user_id, actor_id, actor_role, event_type, event_detail, created_at)
                VALUES (:uid, :uid, 'smartan', 'module_overdue',
                        jsonb_build_object('module_id', :mid, 'deadline', :dl), now())
            """), {"uid": current_user.id, "mid": mid, "dl": str(row.deadline)})

    try:
        db.commit()
    except Exception:
        db.rollback()

    return {"due_today": due_today, "this_week": this_week}


# --- CURRICULUM IMPORT ROUTER ---
router_curriculum = APIRouter(prefix="/curriculum-imports", tags=["Curriculum Import"])

def _validate_curriculum_json(lms: dict, meta: dict) -> list:
    """Server-side validation. Returns list of {field, message} dicts."""
    import datetime
    errors = []

    if not isinstance(lms, dict) or not isinstance(meta, dict):
        errors.append({"field": "root", "message": "Invalid curriculum JSON format"})
        return errors

    duration_weeks = meta.get("duration_weeks", 0)
    if not isinstance(duration_weeks, (int, float)):
        try:
            duration_weeks = float(duration_weeks)
        except (ValueError, TypeError):
            duration_weeks = 0

    prog_start = meta.get("programme_start_date")
    prog_end = meta.get("programme_end_date")

    try:
        prog_start_dt = datetime.date.fromisoformat(str(prog_start)) if prog_start else None
        prog_end_dt = datetime.date.fromisoformat(str(prog_end)) if prog_end else None
    except ValueError:
        errors.append({"field": "metadata.programme_start_date/end_date", "message": "Invalid programme date format"})
        prog_start_dt = prog_end_dt = None

    total_weekly_hours = meta.get("total_weekly_hours", 0)
    if not isinstance(total_weekly_hours, (int, float)):
        try:
            total_weekly_hours = float(total_weekly_hours)
        except (ValueError, TypeError):
            total_weekly_hours = 0

    tracks = lms.get("tracks", [])
    if not isinstance(tracks, list):
        errors.append({"field": "tracks", "message": "tracks must be a list"})
        return errors

    sum_weekly = 0
    for t in tracks:
        if isinstance(t, dict):
            wh = t.get("weekly_hours")
            if wh is not None:
                try:
                    sum_weekly += float(wh)
                except (ValueError, TypeError):
                    pass

    if tracks and abs(sum_weekly - total_weekly_hours) > 0.5:
        errors.append({
            "field": "metadata.total_weekly_hours",
            "message": f"total_weekly_hours ({total_weekly_hours}) does not equal sum of track weekly_hours ({sum_weekly})"
        })

    def parse_date(ds, field):
        if not ds:
            return None
        try:
            return datetime.date.fromisoformat(str(ds))
        except ValueError:
            errors.append({"field": field, "message": f"Invalid date '{ds}' — must be YYYY-MM-DD"})
            return None

    def check_weekday(d, field):
        if d and d.weekday() >= 5:
            day_name = "Saturday" if d.weekday() == 5 else "Sunday"
            errors.append({"field": field, "message": f"Deadline {d} falls on a {day_name} — must be a weekday"})

    def check_in_window(d, field):
        if d and prog_start_dt and prog_end_dt:
            if d < prog_start_dt or d > prog_end_dt:
                errors.append({"field": field, "message": f"Date {d} falls outside programme window ({prog_start}–{prog_end})"})

    for ti, track in enumerate(tracks):
        if not isinstance(track, dict):
            errors.append({"field": f"tracks[{ti}]", "message": "track item must be an object"})
            continue
        track_id = track.get("id", f"track_{ti}")
        t_dl = parse_date(track.get("deadline"), f"tracks[{track_id}].deadline")
        if t_dl:
            check_weekday(t_dl, f"tracks[{track_id}].deadline")
            check_in_window(t_dl, f"tracks[{track_id}].deadline")

        # Check total_hours = weekly_hours * duration_weeks
        wh = track.get("weekly_hours") or 0
        if not isinstance(wh, (int, float)):
            try: wh = float(wh)
            except (ValueError, TypeError): wh = 0
        th = track.get("total_hours") or 0
        if not isinstance(th, (int, float)):
            try: th = float(th)
            except (ValueError, TypeError): th = 0

        expected_th = round(wh * duration_weeks, 1)
        if wh and duration_weeks and abs(th - expected_th) > 0.5:
            errors.append({
                "field": f"tracks[{track_id}].total_hours",
                "message": f"total_hours ({th}) should equal weekly_hours ({wh}) × duration_weeks ({duration_weeks}) = {expected_th}"
            })

        courses = track.get("courses", [])
        if not isinstance(courses, list):
            errors.append({"field": f"tracks[{track_id}].courses", "message": "courses must be a list"})
            continue

        last_course_dl = None
        for ci, course in enumerate(courses):
            if not isinstance(course, dict):
                errors.append({"field": f"tracks[{track_id}].courses[{ci}]", "message": "course item must be an object"})
                continue
            course_id = course.get("id", f"course_{ci}")
            c_dl = parse_date(course.get("deadline"), f"tracks[{track_id}].courses[{course_id}].deadline")
            if c_dl:
                check_weekday(c_dl, f"tracks[{track_id}].courses[{course_id}].deadline")
                check_in_window(c_dl, f"tracks[{track_id}].courses[{course_id}].deadline")
            last_course_dl = c_dl

            modules = course.get("modules", [])
            if not isinstance(modules, list):
                errors.append({"field": f"tracks[{track_id}].courses[{course_id}].modules", "message": "modules must be a list"})
                continue

            last_module_dl = None
            prev_module_dl = None
            for mi, module in enumerate(modules):
                if not isinstance(module, dict):
                    errors.append({"field": f"tracks[{track_id}].courses[{course_id}].modules[{mi}]", "message": "module item must be an object"})
                    continue
                module_id = module.get("id", f"module_{mi}")
                m_dl = parse_date(module.get("deadline"), f"tracks[{track_id}].courses[{course_id}].modules[{module_id}].deadline")
                if m_dl:
                    check_weekday(m_dl, f"tracks[{track_id}].courses[{course_id}].modules[{module_id}].deadline")
                    check_in_window(m_dl, f"tracks[{track_id}].courses[{course_id}].modules[{module_id}].deadline")
                    # Ascending order check
                    if prev_module_dl and m_dl < prev_module_dl:
                        errors.append({
                            "field": f"tracks[{track_id}].courses[{course_id}].modules[{module_id}].deadline",
                            "message": f"Module deadline {m_dl} is before previous module deadline {prev_module_dl} — must be ascending"
                        })
                    prev_module_dl = m_dl
                last_module_dl = m_dl

            # Last module deadline should equal course deadline
            if last_module_dl and c_dl and last_module_dl != c_dl:
                errors.append({
                    "field": f"tracks[{track_id}].courses[{course_id}].deadline",
                    "message": f"Course deadline ({c_dl}) should equal its last module deadline ({last_module_dl})"
                })

        # Last course deadline should equal track deadline
        if last_course_dl and t_dl and last_course_dl != t_dl:
            errors.append({
                "field": f"tracks[{track_id}].deadline",
                "message": f"Track deadline ({t_dl}) should equal its last course deadline ({last_course_dl})"
            })

    return errors


@router_curriculum.post("")
def upload_curriculum(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a pre-generated curriculum JSON. Stores as draft, validates, returns import_id + errors."""
    from sqlalchemy import text as sqltext
    import logging

    logger = logging.getLogger(__name__)

    try:
        raw = payload.get("json_data")
        filename = payload.get("filename", "upload.json")

        if not raw or not isinstance(raw, dict):
            raise HTTPException(status_code=400, detail="Missing or invalid json_data field")

        lms = raw.get("lms_export")
        if not lms:
            raise HTTPException(status_code=400, detail="JSON must have top-level 'lms_export' key")

        meta = lms.get("metadata", {})
        
        try:
            validation_errors = _validate_curriculum_json(lms, meta)
        except Exception as ve:
            logger.exception("Validation logic failed due to structure mismatch")
            raise HTTPException(status_code=400, detail=f"Failed to validate curriculum JSON structure: {str(ve)}")

        import_id_str = str(uuid.uuid4())
        
        try:
            db.execute(sqltext("""
                INSERT INTO curriculum_imports (id, user_id, original_filename, raw_json, status, validation_errors, created_at)
                VALUES (:id, :uid, :fname, CAST(:raw AS jsonb), 'draft', CAST(:errors AS jsonb), now())
            """), {
                "id": import_id_str,
                "uid": current_user.id,
                "fname": filename,
                "raw": __import__("json").dumps(raw),
                "errors": __import__("json").dumps(validation_errors)
            })
            db.commit()
        except Exception as dbe:
            db.rollback()
            logger.exception("Database error during curriculum upload insertion")
            raise HTTPException(status_code=500, detail=f"Database error saving curriculum import: {str(dbe)}")

        return {
            "import_id": import_id_str,
            "validation_errors": validation_errors,
            "has_errors": len(validation_errors) > 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in upload_curriculum")
        raise HTTPException(status_code=500, detail="An unexpected server error occurred while processing the upload.")


@router_curriculum.get("/{import_id}")
def get_curriculum_import(
    import_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from sqlalchemy import text as sqltext
    import logging

    logger = logging.getLogger(__name__)
    try:
        row = db.execute(sqltext("""
            SELECT original_filename, raw_json, edited_json, status, validation_errors
            FROM curriculum_imports WHERE id = :id AND user_id = :uid
        """), {"id": import_id, "uid": current_user.id}).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Import not found")

        final_json = row.edited_json if row.edited_json else row.raw_json
        return {
            "filename": row.original_filename,
            "status": row.status,
            "json_data": final_json,
            "validation_errors": row.validation_errors or []
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in get_curriculum_import")
        raise HTTPException(status_code=500, detail="An unexpected server error occurred while retrieving the curriculum.")


@router_curriculum.put("/{import_id}")
def update_curriculum_import(
    import_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save edited_json (debounced from review screen)."""
    from sqlalchemy import text as sqltext
    import json
    import logging

    logger = logging.getLogger(__name__)

    try:
        edited = payload.get("edited_json")
        if not edited:
            raise HTTPException(status_code=400, detail="Missing edited_json")

        lms = edited.get("lms_export")
        meta = (lms or {}).get("metadata", {})
        
        try:
            validation_errors = _validate_curriculum_json(lms or {}, meta) if lms else []
        except Exception as ve:
            logger.exception("Validation logic failed in update due to structure mismatch")
            raise HTTPException(status_code=400, detail=f"Failed to validate curriculum JSON structure: {str(ve)}")

        try:
            db.execute(sqltext("""
                UPDATE curriculum_imports
                SET edited_json = CAST(:ej AS jsonb), validation_errors = CAST(:errors AS jsonb)
                WHERE id = :id AND user_id = :uid AND status = 'draft'
            """), {
                "ej": json.dumps(edited),
                "errors": json.dumps(validation_errors),
                "id": import_id,
                "uid": current_user.id
            })
            db.commit()
        except Exception as dbe:
            db.rollback()
            logger.exception("Database error during curriculum update")
            raise HTTPException(status_code=500, detail=f"Database error updating curriculum import: {str(dbe)}")

        return {"validation_errors": validation_errors, "has_errors": len(validation_errors) > 0}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in update_curriculum_import")
        raise HTTPException(status_code=500, detail="An unexpected server error occurred while updating the curriculum.")


@router_curriculum.post("/{import_id}/confirm")
def confirm_curriculum_import(
    import_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Re-validate, then commit tracks/courses/modules from edited_json (falling back to raw_json)."""
    from sqlalchemy import text as sqltext
    import json, datetime, logging

    logger = logging.getLogger(__name__)

    try:
        row = db.execute(sqltext("""
            SELECT raw_json, edited_json, status FROM curriculum_imports
            WHERE id = :id AND user_id = :uid
        """), {"id": import_id, "uid": current_user.id}).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Import not found")
        if row.status == "confirmed":
            raise HTTPException(status_code=400, detail="Already confirmed")

        final_json = row.edited_json if row.edited_json else row.raw_json
        lms = final_json.get("lms_export") if final_json else None
        if not lms:
            raise HTTPException(status_code=400, detail="No valid curriculum data to confirm")

        meta = lms.get("metadata", {})
        
        try:
            errors = _validate_curriculum_json(lms, meta)
        except Exception as ve:
            logger.exception("Validation logic failed during confirm due to structure mismatch")
            raise HTTPException(status_code=400, detail=f"Failed to validate curriculum JSON structure: {str(ve)}")

        if errors:
            raise HTTPException(status_code=422, detail={"validation_errors": errors})

        tracks_data = lms.get("tracks", [])
        
        try:
            max_order = db.execute(sqltext('SELECT COALESCE(MAX("order"), -1) FROM tracks WHERE "userId" = :uid'),
                                   {"uid": current_user.id}).scalar() or -1

            for ti, t_data in enumerate(tracks_data):
                track_id = generate_id("t")
                color_palette = ["#C25A3A", "#4285F4", "#34A853", "#FBBC05", "#A066CB", "#EA4335", "#0891B2"]
                color = color_palette[ti % len(color_palette)]
                h, s, l = hex_to_hsl(color)

                deadline_val = t_data.get("deadline")
                if not deadline_val or str(deadline_val).strip() == "":
                    deadline_val = None

                icon_val = t_data.get("icon") or "📚"
                is_img = icon_val.startswith("http") or icon_val.startswith("/") or "static" in icon_val
                icon_type = "image" if is_img else "emoji"
                icon_image_url = icon_val if is_img else None
                icon_thumb_url = icon_val if is_img else None

                db.execute(sqltext("""
                    INSERT INTO tracks (id, "userId", name, icon, color, phase, "order", "createdAt",
                                        "hslHue", "hslSaturation", "hslLightness",
                                        deadline, code, weekly_hours, total_hours,
                                        track_resources, smartan_builder_alignment, live_industry_experiences,
                                        icon_type, icon_value, icon_image_url, icon_thumb_url)
                    VALUES (:id, :uid, :name, :icon, :color, :phase, :order, now(),
                            :hue, :sat, :lig,
                            :deadline, :code, :wh, :th, CAST(:res AS jsonb), CAST(:sba AS jsonb), CAST(:lie AS jsonb),
                            :icon_type, :icon_value, :icon_image_url, :icon_thumb_url)
                """), {
                    "id": track_id, "uid": current_user.id,
                    "name": t_data.get("name", "Untitled Track"),
                    "icon": icon_val, "color": color, "phase": "Semester 1",
                    "order": max_order + 1 + ti,
                    "hue": h, "sat": s, "lig": l,
                    "deadline": deadline_val,
                    "code": t_data.get("code"),
                    "wh": t_data.get("weekly_hours"),
                    "th": t_data.get("total_hours"),
                    "res": json.dumps(t_data.get("resources", {})),
                    "sba": json.dumps(t_data.get("smartan_builder_alignment", [])),
                    "lie": json.dumps(t_data.get("live_industry_experiences", [])),
                    "icon_type": icon_type,
                    "icon_value": icon_val,
                    "icon_image_url": icon_image_url,
                    "icon_thumb_url": icon_thumb_url
                })

                for ci, c_data in enumerate(t_data.get("courses", [])):
                    course_id = generate_id("c")
                    c_deadline = c_data.get("deadline")
                    if not c_deadline or str(c_deadline).strip() == "":
                        c_deadline = None

                    db.execute(sqltext("""
                        INSERT INTO courses (id, "trackId", name, "order", "createdAt", deadline, deliverable, spans_weeks, reference)
                        VALUES (:id, :tid, :name, :order, now(), :deadline, :deliv, :spans, :ref)
                    """), {
                        "id": course_id, "tid": track_id,
                        "name": c_data.get("name", "Untitled Course"),
                        "order": ci,
                        "deadline": c_deadline,
                        "deliv": c_data.get("deliverable"),
                        "spans": c_data.get("spans_weeks"),
                        "ref": c_data.get("reference")
                    })

                    for mi, m_data in enumerate(c_data.get("modules", [])):
                        module_id = generate_id("m")
                        m_deadline = m_data.get("deadline")
                        if not m_deadline or str(m_deadline).strip() == "":
                            m_deadline = None

                        db.execute(sqltext("""
                            INSERT INTO modules (id, "courseId", title, type, status, "order", "createdAt",
                                                deadline, source, day, task, description, due_by_week)
                            VALUES (:id, :cid, :title, 'reading', 'todo', :order, now(),
                                    :deadline, 'imported', :day, :task, :desc, :dbw)
                        """), {
                            "id": module_id, "cid": course_id,
                            "title": m_data.get("name") or m_data.get("title", "Untitled Module"),
                            "order": mi,
                            "deadline": m_deadline,
                            "day": m_data.get("day"),
                            "task": m_data.get("task"),
                            "desc": m_data.get("description"),
                            "dbw": m_data.get("due_by_week")
                        })

            # Mark import confirmed
            db.execute(sqltext("""
                UPDATE curriculum_imports SET status = 'confirmed', confirmed_at = now()
                WHERE id = :id AND user_id = :uid
            """), {"id": import_id, "uid": current_user.id})

            db.commit()
        except Exception as dbe:
            db.rollback()
            logger.exception("Database error during curriculum confirmation")
            raise HTTPException(status_code=500, detail=f"Database error importing curriculum: {str(dbe)}")

        return {"status": "confirmed", "message": "Curriculum imported successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in confirm_curriculum_import")
        raise HTTPException(status_code=500, detail="An unexpected server error occurred while confirming the curriculum.")


@router_curriculum.delete("/{import_id}")
def discard_curriculum_import(
    import_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from sqlalchemy import text as sqltext
    import logging

    logger = logging.getLogger(__name__)
    try:
        db.execute(sqltext("""
            UPDATE curriculum_imports SET status = 'discarded'
            WHERE id = :id AND user_id = :uid
        """), {"id": import_id, "uid": current_user.id})
        db.commit()
        return {"status": "discarded"}
    except Exception as e:
        db.rollback()
        logger.exception("Unexpected error in discard_curriculum_import")
        raise HTTPException(status_code=500, detail="An unexpected server error occurred while discarding the curriculum.")


# --- PUSH SCHEDULE FORWARD ENDPOINT ---
@router_tracks.post("/push-schedule")
def push_schedule_forward(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Shift all incomplete imported modules for this user forward by N days."""
    from sqlalchemy import text as sqltext
    import datetime

    days = int(payload.get("days", 0))
    if days <= 0 or days > 365:
        raise HTTPException(status_code=400, detail="days must be between 1 and 365")

    # Shift all incomplete imported modules that have a deadline
    db.execute(sqltext("""
        UPDATE modules SET deadline = deadline + :days
        WHERE "courseId" IN (
            SELECT c.id FROM courses c
            JOIN tracks t ON c."trackId" = t.id
            WHERE t."userId" = :uid
        )
        AND deadline IS NOT NULL
        AND status != 'done'
        AND source = 'imported'
    """), {"days": days, "uid": current_user.id})
    db.commit()
    return {"message": f"Pushed {days} day(s) forward for all incomplete imported modules"}


app.include_router(router_auth)
app.include_router(router_settings)
app.include_router(router_tracks)
app.include_router(router_courses)
app.include_router(router_modules)
app.include_router(router_logs)
app.include_router(router_milestones)
app.include_router(router_calendar)
app.include_router(router_resources)
app.include_router(router_analytics)
app.include_router(router_dashboard)
app.include_router(router_due)

@app.get("/api/dashboard/summary")
def get_api_dashboard_summary_fallback(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_dashboard_summary(current_user, db)


# --- ADMIN ROUTER ---
router_admin = APIRouter(prefix="/admin", tags=["Admin Panel"])

@router_admin.get("/dashboard")
def get_admin_dashboard(current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import SessionLog, User, ActivityLog, EngagementFlagAcknowledgement
    import datetime

    today_dt = datetime.date.today()
    today_str = today_dt.isoformat()
    week_ago_str = (today_dt - datetime.timedelta(days=7)).isoformat()
    month_ago_str = (today_dt - datetime.timedelta(days=30)).isoformat()
    semester_ago_str = (today_dt - datetime.timedelta(days=84)).isoformat()
    year_ago_str = (today_dt - datetime.timedelta(days=365)).isoformat()

    total_smartans = db.query(User).filter(User.role == "smartan").count()
    smartans_denom = total_smartans if total_smartans > 0 else 1

    def get_aggregate_stats(since_date_str=None):
        query = db.query(func.sum(SessionLog.duration), func.count(SessionLog.id))
        if since_date_str:
            query = query.filter(SessionLog.date >= since_date_str)
        dur, cnt = query.first()
        hours = round((dur or 0) / 60.0, 1)
        sessions = cnt or 0
        return hours, sessions

    h_today, s_today = get_aggregate_stats(today_str)
    h_week, s_week = get_aggregate_stats(week_ago_str)
    h_month, s_month = get_aggregate_stats(month_ago_str)
    h_semester, s_semester = get_aggregate_stats(semester_ago_str)
    h_year, s_year = get_aggregate_stats(year_ago_str)
    h_all, s_all = get_aggregate_stats(None)

    # 1. Dashboard summary aggregates
    aggregate_hours = {
        "total": {
            "today": h_today,
            "week": h_week,
            "month": h_month,
            "semester": h_semester,
            "year": h_year,
            "all_time": h_all
        },
        "avg": {
            "today": round(h_today / smartans_denom, 1),
            "week": round(h_week / smartans_denom, 1),
            "month": round(h_month / smartans_denom, 1),
            "semester": round(h_semester / smartans_denom, 1),
            "year": round(h_year / smartans_denom, 1),
            "all_time": round(h_all / smartans_denom, 1)
        }
    }

    aggregate_sessions = {
        "total": {
            "today": s_today,
            "week": s_week,
            "month": s_month,
            "semester": s_semester,
            "year": s_year,
            "all_time": s_all
        },
        "avg": {
            "today": round(s_today / smartans_denom, 1),
            "week": round(s_week / smartans_denom, 1),
            "month": round(s_month / smartans_denom, 1),
            "semester": round(s_semester / smartans_denom, 1),
            "year": round(s_year / smartans_denom, 1),
            "all_time": round(s_all / smartans_denom, 1)
        }
    }

    # 2. Live Engagement flags
    acks = db.query(EngagementFlagAcknowledgement).filter(EngagementFlagAcknowledgement.admin_id == current_admin.id).all()
    ack_lookup = {(a.smartan_id, a.flag_type): a.acknowledged_at for a in acks}

    latest_sessions = db.query(
        SessionLog.userId,
        func.max(SessionLog.date).label("max_date")
    ).group_by(SessionLog.userId).subquery()

    smartans_data = db.query(User, latest_sessions.c.max_date).outerjoin(
        latest_sessions, User.id == latest_sessions.c.userId
    ).filter(User.role == "smartan").all()

    # Calculate streaks
    user_dates = {}
    for row in db.query(SessionLog.userId, SessionLog.date).distinct().all():
        if row.userId not in user_dates:
            user_dates[row.userId] = []
        user_dates[row.userId].append(row.date)

    user_streaks = {}
    for uid, dates in user_dates.items():
        sorted_dates = sorted(dates, reverse=True)
        streak = 0
        cur_date = today_dt
        if sorted_dates and sorted_dates[0] == today_str:
            pass
        elif sorted_dates and sorted_dates[0] == (today_dt - datetime.timedelta(days=1)).isoformat():
            cur_date = today_dt - datetime.timedelta(days=1)
        else:
            user_streaks[uid] = 0
            continue

        for d in sorted_dates:
            expected_str = cur_date.isoformat()
            if d == expected_str:
                streak += 1
                cur_date -= datetime.timedelta(days=1)
            elif d < expected_str:
                break
        user_streaks[uid] = streak

    flags = []
    for user, last_date_str in smartans_data:
        uid = user.id
        streak = user_streaks.get(uid, 0)
        triggered = []

        if not last_date_str:
            last_active = "Never"
            triggered.append("no_session_7d")
        else:
            last_active = last_date_str
            last_dt = datetime.date.fromisoformat(last_date_str)
            days_inactive = (today_dt - last_dt).days

            if days_inactive > 7:
                triggered.append("no_session_7d")
            elif days_inactive > 3:
                triggered.append("no_session_3d_this_week")

            if streak == 0 and days_inactive <= 7:
                triggered.append("broken_streak")

        for f_type in triggered:
            ack_at = ack_lookup.get((uid, f_type))
            if ack_at:
                if last_date_str and last_date_str != "Never":
                    last_dt = datetime.date.fromisoformat(last_date_str)
                    if last_dt > ack_at.date():
                        pass  # Resurface
                    else:
                        continue  # Hidden
                else:
                    continue  # Hidden

            flags.append({
                "smartanId": uid,
                "fullName": user.fullName,
                "email": user.email,
                "flagType": f_type,
                "lastActive": last_active
            })

    # 3. Community activity feed
    total_activities = db.query(ActivityLog).count()
    activities = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(30).all()

    user_ids = set()
    for a in activities:
        if a.user_id: user_ids.add(a.user_id)
        if a.actor_id: user_ids.add(a.actor_id)

    users_lookup = {u.id: u.fullName for u in db.query(User).filter(User.id.in_(list(user_ids))).all()} if user_ids else {}

    recent_feed = []
    for a in activities:
        recent_feed.append({
            "id": str(a.id),
            "userId": a.user_id,
            "userName": users_lookup.get(a.user_id) if a.user_id else None,
            "actorId": a.actor_id,
            "actorName": users_lookup.get(a.actor_id) if a.actor_id else "System",
            "actorRole": a.actor_role,
            "eventType": a.event_type,
            "detail": a.event_detail,
            "createdAt": a.created_at
        })

    return {
        "aggregateHours": aggregate_hours,
        "aggregateSessions": aggregate_sessions,
        "totalSmartans": total_smartans,
        "engagementFlags": flags,
        "recentActivity": recent_feed
    }

@router_admin.post("/engagement-flags/{smartan_id}/acknowledge")
def acknowledge_flag(smartan_id: str, payload: dict, current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import EngagementFlagAcknowledgement
    import datetime

    flag_type = payload.get("flag_type")
    if not flag_type:
        raise HTTPException(400, "flag_type is required")

    ack = db.query(EngagementFlagAcknowledgement).filter(
        EngagementFlagAcknowledgement.admin_id == current_admin.id,
        EngagementFlagAcknowledgement.smartan_id == smartan_id,
        EngagementFlagAcknowledgement.flag_type == flag_type
    ).first()

    if not ack:
        ack = EngagementFlagAcknowledgement(
            admin_id=current_admin.id,
            smartan_id=smartan_id,
            flag_type=flag_type,
            acknowledged_at=datetime.datetime.utcnow()
        )
        db.add(ack)
    else:
        ack.acknowledged_at = datetime.datetime.utcnow()

    db.commit()
    return {"status": "success"}

@router_admin.get("/smartans")
def get_admin_smartans(current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import SessionLog, User
    import datetime

    latest_sessions = db.query(
        SessionLog.userId,
        func.max(SessionLog.date).label("max_date")
    ).group_by(SessionLog.userId).subquery()

    smartans = db.query(User, latest_sessions.c.max_date).outerjoin(
        latest_sessions, User.id == latest_sessions.c.userId
    ).filter(User.role == "smartan").order_by(User.fullName.asc()).all()

    res = []
    for u, max_date in smartans:
        res.append({
            "id": u.id,
            "fullName": u.fullName,
            "email": u.email,
            "joinDate": u.createdAt.date().isoformat() if u.createdAt else None,
            "lastActive": max_date or "Never",
            "status": "Deactivated" if u.deactivated_at else "Active"
        })
    return res

@router_admin.get("/smartans/{id}")
def get_admin_smartan_detail(
    id: str, 
    page: int = 1,
    limit: int = 10,
    current_admin: User = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    from models import User, ActivityLog, Milestone, SessionLog, Track
    user = db.query(User).filter(User.id == id, User.role == "smartan").first()
    if not user:
        raise HTTPException(404, "Smartan not found")

    dashboard = get_dashboard_summary(user, db)

    offset = (page - 1) * limit
    total_logs = db.query(ActivityLog).filter(ActivityLog.user_id == id).count()

    logs = db.query(ActivityLog).filter(
        ActivityLog.user_id == id
    ).order_by(
        ActivityLog.created_at.desc()
    ).offset(offset).limit(limit).all()

    activity_feed = []
    for a in logs:
        # Get actor name
        actor_name = "Self"
        if a.actor_id:
            actor = db.query(User).filter(User.id == a.actor_id).first()
            if actor:
                actor_name = actor.fullName

        activity_feed.append({
            "id": str(a.id),
            "actorName": actor_name,
            "eventType": a.event_type,
            "detail": a.event_detail,
            "createdAt": a.created_at
        })

    # Real milestones from the user's milestones table
    milestones = db.query(Milestone).filter(Milestone.userId == id).order_by(Milestone.date.desc()).all()
    tracks_map = {t.id: t for t in db.query(Track).filter(Track.userId == id).all()}
    milestones_list = []
    for m in milestones:
        track = tracks_map.get(m.trackId)
        milestones_list.append({
            "id": m.id,
            "name": m.name,
            "date": m.date,
            "trackId": m.trackId,
            "trackName": track.name if track else "Unknown",
            "trackColor": track.color if track else "#ccc"
        })

    # Real session logs (most recent 50)
    session_logs = db.query(SessionLog).filter(SessionLog.userId == id).order_by(
        SessionLog.date.desc(), SessionLog.createdAt.desc()
    ).limit(50).all()
    session_list = []
    for sl in session_logs:
        track = tracks_map.get(sl.trackId)
        session_list.append({
            "id": sl.id,
            "topic": sl.topic,
            "duration": sl.duration,
            "date": sl.date,
            "rating": sl.rating,
            "notes": sl.notes,
            "startTime": sl.startTime,
            "endTime": sl.endTime,
            "trackId": sl.trackId,
            "trackName": track.name if track else "Unknown",
            "trackColor": track.color if track else "#ccc",
            "trackIcon": track.icon if track else "📚",
            "createdAt": sl.createdAt
        })

    return {
        "profile": {
            "id": user.id,
            "fullName": user.fullName,
            "email": user.email,
            "username": user.username,
            "avatarUrl": user.avatarUrl,
            "mission": user.mission,
            "projectSummary": user.projectSummary,
            "location": user.location,
            "goals": user.goals,
            "createdAt": user.createdAt,
            "deactivated_at": user.deactivated_at
        },
        "dashboard": dashboard,
        "activityLog": activity_feed,
        "totalLogs": total_logs,
        "milestones": milestones_list,
        "sessionLogs": session_list,
        "page": page,
        "limit": limit
    }

@router_admin.post("/smartans/{id}/deactivate")
def deactivate_smartan(id: str, current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import User, ActivityLog
    import datetime

    user = db.query(User).filter(User.id == id, User.role == "smartan").first()
    if not user:
        raise HTTPException(404, "Smartan not found")

    user.deactivated_at = datetime.datetime.utcnow()

    db.add(ActivityLog(
        user_id=id,
        actor_id=current_admin.id,
        actor_role="admin",
        event_type="account_deactivated",
        event_detail={"email": user.email}
    ))
    db.commit()
    return {"status": "success"}

@router_admin.post("/smartans/{id}/reactivate")
def reactivate_smartan(id: str, current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import User, ActivityLog

    user = db.query(User).filter(User.id == id, User.role == "smartan").first()
    if not user:
        raise HTTPException(404, "Smartan not found")

    user.deactivated_at = None

    db.add(ActivityLog(
        user_id=id,
        actor_id=current_admin.id,
        actor_role="admin",
        event_type="account_reactivated",
        event_detail={"email": user.email}
    ))
    db.commit()
    return {"status": "success"}

@router_admin.post("/smartans/{id}/reset-password")
def reset_smartan_password(id: str, current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import User, ActivityLog
    import urllib.request
    import json

    user = db.query(User).filter(User.id == id, User.role == "smartan").first()
    if not user:
        raise HTTPException(404, "Smartan not found")

    try:
        url = f"{SUPABASE_URL}/auth/v1/recover"
        req_headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        }
        data = json.dumps({"email": user.email}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=req_headers, method="POST")
        with urllib.request.urlopen(req) as response:
            pass
    except Exception as e:
        print(f"Supabase password recover link request failed: {e}")
        raise HTTPException(500, f"Failed to trigger password recovery: {e}")

    db.add(ActivityLog(
        user_id=id,
        actor_id=current_admin.id,
        actor_role="admin",
        event_type="password_reset_triggered",
        event_detail={"email": user.email}
    ))
    db.commit()
    return {"status": "success"}

@router_admin.get("/leaderboard")
def get_admin_leaderboard(metric: str = "hours", scope: str = "all_time", current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import User, SessionLog
    import datetime

    today_dt = datetime.date.today()
    since_date = None
    if scope == "week": since_date = today_dt - datetime.timedelta(days=7)
    elif scope == "month": since_date = today_dt - datetime.timedelta(days=30)
    elif scope == "semester": since_date = today_dt - datetime.timedelta(days=84)
    elif scope == "year": since_date = today_dt - datetime.timedelta(days=365)

    smartans = db.query(User).filter(User.role == "smartan").all()
    leaderboard = []

    user_dates = {}
    for row in db.query(SessionLog.userId, SessionLog.date).distinct().all():
        if row.userId not in user_dates:
            user_dates[row.userId] = []
        user_dates[row.userId].append(row.date)

    user_streaks = {}
    for uid, dates in user_dates.items():
        sorted_dates = sorted(dates, reverse=True)
        streak = 0
        cur_date = today_dt
        today_str = today_dt.isoformat()
        if sorted_dates and sorted_dates[0] == today_str:
            pass
        elif sorted_dates and sorted_dates[0] == (today_dt - datetime.timedelta(days=1)).isoformat():
            cur_date = today_dt - datetime.timedelta(days=1)
        else:
            user_streaks[uid] = 0
            continue

        for d in sorted_dates:
            expected_str = cur_date.isoformat()
            if d == expected_str:
                streak += 1
                cur_date -= datetime.timedelta(days=1)
            elif d < expected_str:
                break
        user_streaks[uid] = streak

    for u in smartans:
        query = db.query(SessionLog).filter(SessionLog.userId == u.id)
        if since_date:
            query = query.filter(SessionLog.date >= since_date.isoformat())
        logs = query.all()

        total_dur = sum([l.duration for l in logs])
        hours = round(total_dur / 60.0, 1)
        sessions = len(logs)
        streak = user_streaks.get(u.id, 0)

        score = 0
        if metric == "hours": score = hours
        elif metric == "sessions": score = sessions
        elif metric == "streak": score = streak

        leaderboard.append({
            "id": u.id,
            "fullName": u.fullName,
            "email": u.email,
            "avatarUrl": u.avatarUrl,
            "score": score,
            "hours": hours,
            "sessions": sessions,
            "streak": streak
        })

    leaderboard.sort(key=lambda x: x["score"], reverse=True)
    return leaderboard

@router_admin.get("/analytics")
def get_admin_analytics(
    smartan_id: Optional[str] = None, 
    days: Optional[str] = "all",
    track_category: Optional[str] = "All",
    current_admin: User = Depends(get_current_admin), 
    db: Session = Depends(get_db)
):
    from models import User, SessionLog, Track, Module
    import datetime

    since_date = None
    if days != "all":
        try:
            d_val = int(days)
            since_date = datetime.date.today() - datetime.timedelta(days=d_val)
        except Exception:
            pass

    def matches_category(track_name: str, cat: str) -> bool:
        name_low = track_name.strip().lower()
        cat_low = cat.strip().lower()
        if cat_low == "all" or not cat_low:
            return True
        if cat_low == "cybersecurity":
            return any(x in name_low for x in ["cyber", "security", "hacking", "offensive", "defensive", "penetration", "network"])
        if cat_low in ["ai+ml", "ai + ml"]:
            return any(x in name_low for x in ["ai", "ml", "artificial", "intelligence", "machine", "learning", "deep", "neural", "python"])
        if cat_low == "mathematics":
            return any(x in name_low for x in ["math", "algebra", "calculus", "linear", "stats", "statistics"])
        if cat_low == "biology":
            return any(x in name_low for x in ["bio", "biology", "genetics", "chem", "chemistry", "medicine"])
        if cat_low in ["build+projects", "build + projects"]:
            return any(x in name_low for x in ["build", "project", "app", "web", "react", "next", "fullstack", "dev"])
        return False

    if smartan_id:
        user = db.query(User).filter(User.id == smartan_id, User.role == "smartan").first()
        if not user:
            raise HTTPException(404, "Smartan not found")

        tracks = db.query(Track).filter(Track.userId == smartan_id).all()
        filtered_tracks = [t for t in tracks if matches_category(t.name, track_category)]
        filtered_track_ids = [t.id for t in filtered_tracks]

        log_query = db.query(SessionLog).filter(SessionLog.userId == smartan_id)
        if since_date:
            log_query = log_query.filter(SessionLog.date >= since_date.isoformat())
        if track_category != "All":
            log_query = log_query.filter(SessionLog.trackId.in_(filtered_track_ids))

        logs = log_query.order_by(SessionLog.date.desc()).all()

        total_mins = sum(l.duration for l in logs)
        total_hours = round(total_mins / 60.0, 1)
        avg_session = round(total_mins / len(logs)) if logs else 0

        ratings = [l.rating for l in logs if l.rating is not None]
        avg_mastery = round(sum(ratings) / len(ratings), 1) if ratings else 0.0

        unique_dates = sorted(list(set(l.date for l in logs)), reverse=True)
        streak = 0
        today_str = datetime.date.today().isoformat()
        yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        if unique_dates:
            cur_date = datetime.date.today()
            if unique_dates[0] == yesterday_str:
                cur_date = datetime.date.today() - datetime.timedelta(days=1)
            elif unique_dates[0] != today_str:
                cur_date = None
            if cur_date:
                for d in unique_dates:
                    expected_str = cur_date.isoformat()
                    if d == expected_str:
                        streak += 1
                        cur_date -= datetime.timedelta(days=1)
                    elif d < expected_str:
                        break

        daily_durations = {}
        for l in logs:
            daily_durations[l.date] = daily_durations.get(l.date, 0) + l.duration
        heatmap = []
        today = datetime.date.today()
        for offset_day in range(89, -1, -1):
            d_str = (today - datetime.timedelta(days=offset_day)).isoformat()
            mins = daily_durations.get(d_str, 0)
            lvl = min(4, mins // 60) if mins > 0 else 0
            heatmap.append({
                "date": d_str,
                "minutes": mins,
                "level": lvl
            })

        by_track = []
        for t in filtered_tracks:
            t_logs = [l for l in logs if l.trackId == t.id]
            t_mins = sum(l.duration for l in t_logs)
            by_track.append({
                "trackId": t.id,
                "name": t.name,
                "icon": t.icon,
                "color": t.color,
                "hours": round(t_mins / 60.0, 1),
                "sessionCount": len(t_logs)
            })

        return {
            "summary": {
                "totalHours": total_hours,
                "avgSession": avg_session,
                "avgMastery": avg_mastery,
                "streak": streak,
                "hoursThisMonth": total_hours,
                "sessionsThisWeek": len(logs),
                "activeTracks": len(filtered_tracks)
            },
            "byTrack": by_track,
            "heatmap": heatmap,
            "masteryData": {},
            "streakData": {
                "currentStreak": streak,
                "bestStreak": streak,
                "sessionsCount": len(logs),
                "avgMastery": avg_mastery,
                "totalHours": total_hours
            },
            "logs": logs[:50],
            "tracks": filtered_tracks
        }

    tracks_query = db.query(Track)
    tracks = tracks_query.all()
    filtered_tracks = [t for t in tracks if matches_category(t.name, track_category)]
    filtered_track_ids = {t.id for t in filtered_tracks}

    log_query = db.query(SessionLog)
    if since_date:
        log_query = log_query.filter(SessionLog.date >= since_date.isoformat())
    if track_category != "All":
        log_query = log_query.filter(SessionLog.trackId.in_(list(filtered_track_ids)))
    
    logs = log_query.all()

    total_mins = sum(l.duration for l in logs)
    total_hours = round(total_mins / 60.0, 1)
    avg_session = round(total_mins / len(logs)) if logs else 0

    ratings = [l.rating for l in logs if l.rating is not None]
    avg_mastery = round(sum(ratings) / len(ratings), 1) if ratings else 0.0

    today = datetime.date.today()
    this_month_prefix = today.isoformat()[:7]
    month_mins = sum(l.duration for l in logs if l.date.startswith(this_month_prefix))
    month_hours = round(month_mins / 60.0, 1)

    monday = today - datetime.timedelta(days=today.weekday())
    week_sessions = sum(1 for l in logs if l.date >= monday.isoformat())

    total_smartans = db.query(User).filter(User.role == "smartan").count()

    track_durations = {}
    track_counts = {}
    track_names = {}
    track_owners = {}
    for l in logs:
        t = db.query(Track).filter(Track.id == l.trackId).first()
        if not t:
            continue
        tname = t.name.strip()
        tkey = tname.lower()
        track_durations[tkey] = track_durations.get(tkey, 0) + l.duration
        track_counts[tkey] = track_counts.get(tkey, 0) + 1
        track_names[tkey] = tname
        owner = db.query(User).filter(User.id == t.userId).first()
        track_owners[tkey] = owner.fullName if owner else "Unknown"

    by_track = []
    for idx, (tkey, mins) in enumerate(sorted(track_durations.items(), key=lambda x: x[1], reverse=True)[:5]):
        by_track.append({
            "trackId": f"agg_{idx}",
            "name": track_names[tkey],
            "ownerName": track_owners[tkey],
            "icon": "📚",
            "color": "#C25A3A" if idx == 0 else "#22c55e" if idx == 1 else "#3b82f6",
            "hours": round(mins / 60.0, 1),
            "sessionCount": track_counts.get(tkey, 0)
        })

    daily_durations = {}
    for l in logs:
        daily_durations[l.date] = daily_durations.get(l.date, 0) + l.duration

    heatmap = []
    for offset_day in range(89, -1, -1):
        d_str = (today - datetime.timedelta(days=offset_day)).isoformat()
        mins = daily_durations.get(d_str, 0)
        lvl = min(4, mins // 60) if mins > 0 else 0
        heatmap.append({
            "date": d_str,
            "minutes": mins,
            "level": lvl
        })

    student_durations = {}
    for l in logs:
        student_durations[l.userId] = student_durations.get(l.userId, 0) + l.duration
    
    dist = {"0-5h": 0, "5-20h": 0, "20-50h": 0, "50h+": 0}
    all_students = db.query(User).filter(User.role == "smartan").all()
    for s in all_students:
        s_dur = student_durations.get(s.id, 0)
        s_hrs = s_dur / 60.0
        if s_hrs < 5:
            dist["0-5h"] += 1
        elif s_hrs < 20:
            dist["5-20h"] += 1
        elif s_hrs < 50:
            dist["20-50h"] += 1
        else:
            dist["50h+"] += 1

    return {
        "summary": {
            "totalHours": total_hours,
            "avgSession": avg_session,
            "avgMastery": avg_mastery,
            "streak": 6,
            "hoursThisMonth": month_hours,
            "sessionsThisWeek": week_sessions,
            "activeTracks": len(filtered_tracks)
        },
        "byTrack": by_track,
        "heatmap": heatmap,
        "masteryData": dist,
        "streakData": {
            "currentStreak": 6,
            "bestStreak": 11,
            "sessionsCount": len(logs),
            "avgMastery": avg_mastery,
            "totalHours": total_hours
        },
        "logs": logs[:100],
        "tracks": filtered_tracks
    }

@router_admin.post("/notifications")
def send_admin_notification(payload: dict, current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import Notification, ActivityLog

    message = payload.get("message")
    recipient_id = payload.get("recipient_id")  # nullable

    if not message:
        raise HTTPException(400, "message is required")

    notif = Notification(
        sender_id=current_admin.id,
        recipient_id=recipient_id,
        message=message
    )
    db.add(notif)
    db.flush()

    db.add(ActivityLog(
        user_id=recipient_id,
        actor_id=current_admin.id,
        actor_role="admin",
        event_type="notification_sent",
        event_detail={"message": message, "broadcast": recipient_id is None}
    ))
    db.commit()
    return {"status": "success"}


@router_admin.get("/profile")
def get_admin_profile(current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import User, EngagementFlagAcknowledgement, Notification, ActivityLog

    smartans_overseen = db.query(User).filter(User.role == "smartan").count()
    flags_resolved = db.query(EngagementFlagAcknowledgement).filter(EngagementFlagAcknowledgement.admin_id == current_admin.id).count()
    broadcasts_sent = db.query(Notification).filter(Notification.sender_id == current_admin.id, Notification.recipient_id == None).count()

    logs = db.query(ActivityLog).filter(
        ActivityLog.actor_id == current_admin.id
    ).order_by(
        ActivityLog.created_at.desc()
    ).limit(100).all()

    activity = []
    for a in logs:
        target_name = None
        if a.user_id:
            target_user = db.query(User).filter(User.id == a.user_id).first()
            if target_user:
                target_name = target_user.fullName

        activity.append({
            "id": str(a.id),
            "eventType": a.event_type,
            "detail": a.event_detail,
            "userName": target_name,
            "createdAt": a.created_at
        })

    return {
        "profile": {
            "fullName": current_admin.fullName,
            "mission": current_admin.mission,
            "avatarUrl": current_admin.avatarUrl,
            "createdAt": current_admin.createdAt
        },
        "stats": {
            "smartansOverseen": smartans_overseen,
            "flagsResolved": flags_resolved,
            "broadcastsSent": broadcasts_sent
        },
        "activity": activity
    }

@router_admin.post("/profile/edit")
def edit_admin_profile(payload: dict, current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    fullName = payload.get("fullName")
    mission = payload.get("mission")
    avatarUrl = payload.get("avatarUrl")

    if not fullName:
        raise HTTPException(400, "fullName is required")

    current_admin.fullName = fullName
    current_admin.mission = mission
    current_admin.avatarUrl = avatarUrl
    db.commit()
    return {"status": "success"}


@router_admin.get("/smartans/{id}/tracks/{track_id}")
def get_admin_student_track_detail(id: str, track_id: str, current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import Track, Course
    from sqlalchemy.orm import selectinload
    user = db.query(User).filter(User.id == id, User.role == "smartan").first()
    if not user:
        raise HTTPException(404, "Smartan not found")

    track = (
        db.query(Track)
        .filter(Track.id == track_id, Track.userId == id)
        .options(selectinload(Track.courses).selectinload(Course.modules))
        .first()
    )
    if not track:
        raise HTTPException(404, "Track not found")
    
    return track



@router_admin.get("/smartans/{id}/sessions")
def get_admin_student_sessions(id: str, current_admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from models import SessionLog, Track
    user = db.query(User).filter(User.id == id, User.role == "smartan").first()
    if not user:
        raise HTTPException(404, "Smartan not found")

    logs = db.query(SessionLog).filter(SessionLog.userId == id).order_by(SessionLog.date.desc(), SessionLog.createdAt.desc()).all()
    tracks = db.query(Track).filter(Track.userId == id).all()

    return {
        "logs": logs,
        "tracks": tracks
    }


# --- NOTIFICATIONS ROUTER ---
router_notifications = APIRouter(prefix="/notifications", tags=["Notifications"])

@router_notifications.get("")
def get_user_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from models import Notification, NotificationRead
    from sqlalchemy import or_

    # Get all notifications (broadcast or targeted to this user)
    notifs = db.query(Notification).filter(
        or_(Notification.recipient_id == None, Notification.recipient_id == current_user.id)
    ).order_by(Notification.created_at.desc()).all()

    # Get user read list
    reads = db.query(NotificationRead.notification_id).filter(NotificationRead.user_id == current_user.id).all()
    read_ids = {str(r[0]) for r in reads}

    res = []
    for n in notifs:
        res.append({
            "id": str(n.id),
            "senderId": n.sender_id,
            "recipientId": n.recipient_id,
            "message": n.message,
            "createdAt": n.created_at,
            "read": str(n.id) in read_ids
        })
    return res

@router_notifications.post("/{id}/read")
def mark_notification_read(id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from models import NotificationRead
    import datetime

    read_log = db.query(NotificationRead).filter(
        NotificationRead.notification_id == id,
        NotificationRead.user_id == current_user.id
    ).first()

    if not read_log:
        read_log = NotificationRead(
            notification_id=id,
            user_id=current_user.id,
            read_at=datetime.datetime.utcnow()
        )
        db.add(read_log)
        db.commit()

    return {"status": "success"}


# --- REGISTER ALL ROUTERS TO APP ---
app.include_router(router_auth)
app.include_router(router_settings)
app.include_router(router_tracks)
app.include_router(router_courses)
app.include_router(router_modules)
app.include_router(router_logs)
app.include_router(router_milestones)
app.include_router(router_calendar)
app.include_router(router_resources)
app.include_router(router_analytics)
app.include_router(router_dashboard)
app.include_router(router_due)
app.include_router(router_curriculum)
app.include_router(router_admin)
app.include_router(router_notifications)


