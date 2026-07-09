import urllib.request
import urllib.error
import json
import sys
import os

# Get Supabase info from .env
env_path = r"c:\Users\SmartanHouse005\Downloads\STA_LEARNING_OS_1\.env"
supabase_url = None
service_key = None

if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.startswith("SUPABASE_URL="):
                supabase_url = line.split("=")[1].strip()
            elif line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                service_key = line.split("=")[1].strip()

# Let's authenticate user@domain.com
login_url = f"{supabase_url}/auth/v1/token?grant_type=password"
headers = {
    "apikey": service_key,
    "Content-Type": "application/json"
}

passwords = ["Smartan2026Varsity", "smartan123"]
token = None

for pw in passwords:
    try:
        print(f"Trying to login user@domain.com with password: {pw}")
        payload = {
            "email": "user@domain.com",
            "password": pw
        }
        req = urllib.request.Request(login_url, headers=headers, data=json.dumps(payload).encode("utf-8"), method="POST")
        with urllib.request.urlopen(req) as res:
            resp = json.loads(res.read().decode("utf-8"))
            token = resp.get("access_token")
            print("Login successful!")
            break
    except Exception as e:
        print(f"Failed: {e}")

if not token:
    print("Could not log in user@domain.com")
    sys.exit(1)

# Now request all 6 profile endpoints from the backend (port 8000)
backend_url = "http://127.0.0.1:8000"
endpoints = [
    "/auth/me",
    "/tracks/detailed",
    "/analytics/summary",
    "/logs",
    "/milestones",
    "/analytics/streak"
]

print("\n--- Testing backend endpoints ---")
for ep in endpoints:
    url = f"{backend_url}{ep}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    try:
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode("utf-8"))
            print(f"\n--- {ep} ---")
            print(json.dumps(data, indent=2))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"\n--- {ep} FAILED (status {e.code}) ---")
        print(f"  Response: {body}")
    except Exception as e:
        print(f"\n--- {ep} ERROR: {e} ---")
