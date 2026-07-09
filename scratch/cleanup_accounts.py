import os
import urllib.request
import urllib.error
import json
import sys
from sqlalchemy import create_engine, text

# Load env variables from root .env
env_path = r"c:\Users\SmartanHouse005\Downloads\STA_LEARNING_OS_1\.env"
db_url = None
supabase_url = None
service_key = None

if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                db_url = line.split("=")[1].strip()
            elif line.startswith("SUPABASE_URL="):
                supabase_url = line.split("=")[1].strip()
            elif line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                service_key = line.split("=")[1].strip()

if not db_url or not supabase_url or not service_key:
    print("Error: Missing env variables in root .env file.")
    sys.exit(1)

# Headers for Service Role admin access
headers = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json"
}

keep_emails = {"admin@domain.com", "user@domain.com"}

# 1. Fetch users from Supabase Auth admin API
print("\n--- Listing users from Supabase Auth ---")
auth_users = []
try:
    url = f"{supabase_url}/auth/v1/admin/users"
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req) as res:
        users_data = json.loads(res.read().decode('utf-8'))
        auth_users = users_data.get("users", [])
        print(f"Found {len(auth_users)} users in Auth.")
except Exception as e:
    print(f"Failed to list Auth users: {e}")
    sys.exit(1)

# 2. Connect to database and find users
engine = create_engine(db_url)
db_users = []
with engine.connect() as conn:
    res = conn.execute(text("SELECT id, email, auth_id, role FROM users"))
    for row in res:
        db_users.append({"id": row[0], "email": row[1], "auth_id": row[2], "role": row[3]})
    print(f"Found {len(db_users)} users in database public.users table.")

# 3. Identify who to delete
auth_to_delete = []
for au in auth_users:
    email = au.get("email")
    if email not in keep_emails:
        auth_to_delete.append(au)

db_to_delete = []
for du in db_users:
    email = du.get("email")
    if email not in keep_emails:
        db_to_delete.append(du)

print(f"\nUsers to delete from Auth ({len(auth_to_delete)}):")
for u in auth_to_delete:
    print(f"  - {u.get('email')} ({u.get('id')})")

print(f"\nUsers to delete from database table ({len(db_to_delete)}):")
for u in db_to_delete:
    print(f"  - {u.get('email')} ({u.get('id')})")

# 4. Perform Deletions from Database Table (to clean up dependencies first)
with engine.connect() as conn:
    # First, let's delete associated data for users being deleted
    for u in db_to_delete:
        uid = u["id"]
        email = u["email"]
        print(f"\nCleaning up dependencies for database user {email} ({uid})...")
        
        # Delete from tables referencing users
        conn.execute(text("DELETE FROM calendar_events WHERE \"userId\" = :uid"), {"uid": uid})
        conn.execute(text("DELETE FROM session_logs WHERE \"userId\" = :uid"), {"uid": uid})
        conn.execute(text("DELETE FROM curriculum_imports WHERE user_id = :uid"), {"uid": uid})
        conn.execute(text("DELETE FROM module_overdue_flags WHERE user_id = :uid"), {"uid": uid})
        conn.execute(text("DELETE FROM engagement_flag_acknowledgements WHERE smartan_id = :uid OR admin_id = :uid"), {"uid": uid})
        
        # In tracks, they might have courses and modules. Let's find tracks first.
        track_ids_res = conn.execute(text("SELECT id FROM tracks WHERE \"userId\" = :uid"), {"uid": uid})
        track_ids = [row[0] for row in track_ids_res]
        for tid in track_ids:
            course_ids_res = conn.execute(text("SELECT id FROM courses WHERE \"trackId\" = :tid"), {"tid": tid})
            course_ids = [row[0] for row in course_ids_res]
            for cid in course_ids:
                conn.execute(text("DELETE FROM modules WHERE \"courseId\" = :cid"), {"cid": cid})
            conn.execute(text("DELETE FROM courses WHERE \"trackId\" = :tid"), {"tid": tid})
        conn.execute(text("DELETE FROM tracks WHERE \"userId\" = :uid"), {"uid": uid})
        
        # Notifications
        conn.execute(text("DELETE FROM notification_reads WHERE user_id = :uid"), {"uid": uid})
        conn.execute(text("DELETE FROM notifications WHERE recipient_id = :uid OR sender_id = :uid"), {"uid": uid})
        
        # Finally delete from users
        conn.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": uid})
        print(f"Successfully deleted database user {email} and all their tracks/modules/sessions.")
    
    conn.commit()

# 5. Perform Deletions from Supabase Auth
for u in auth_to_delete:
    aid = u.get("id")
    email = u.get("email")
    print(f"\nDeleting Auth user {email} ({aid})...")
    try:
        url = f"{supabase_url}/auth/v1/admin/users/{aid}"
        req = urllib.request.Request(url, headers=headers, method="DELETE")
        with urllib.request.urlopen(req) as res:
            print(f"Successfully deleted Auth user {email}.")
    except Exception as e:
        print(f"Failed to delete Auth user {email}: {e}")

print("\n--- Cleanup completed ---")
