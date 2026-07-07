import os
import urllib.request
import json
from jose import JWTError, jwt, jwk
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# HTTPBearer scheme — reads Authorization: Bearer <token>
security = HTTPBearer(auto_error=False)

JWKS_CACHE = {}

import time

JWKS_CACHE_FILE = "backend/jwks_cache.json"

def fetch_jwks():
    global JWKS_CACHE
    # 1. Try loading from local file cache first if it exists and is less than 24 hours old
    now = time.time()
    if os.path.exists(JWKS_CACHE_FILE):
        try:
            mtime = os.path.getmtime(JWKS_CACHE_FILE)
            if now - mtime < 86400:  # 24 hours
                with open(JWKS_CACHE_FILE, "r", encoding="utf-8") as f:
                    keys = json.load(f)
                    if keys:
                        for key_data in keys:
                            kid = key_data.get("kid")
                            if kid:
                                JWKS_CACHE[kid] = key_data
                        print(f"Loaded {len(keys)} signing key(s) from local JWKS cache file.")
                        return
        except Exception as file_err:
            print(f"Failed to read local JWKS cache file: {file_err}")

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("Warning: SUPABASE_URL or SUPABASE_ANON_KEY environment variables not set.")
        return
    
    url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    headers = {
        "apikey": SUPABASE_ANON_KEY
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            jwks = json.loads(res.read().decode("utf-8"))
            keys_list = jwks.get("keys", [])
            for key_data in keys_list:
                kid = key_data.get("kid")
                if kid:
                    JWKS_CACHE[kid] = key_data
            
            # Save keys to cache file
            try:
                os.makedirs(os.path.dirname(JWKS_CACHE_FILE), exist_ok=True)
                with open(JWKS_CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump(keys_list, f)
            except Exception as write_err:
                print(f"Failed to write JWKS cache file: {write_err}")
                
            print(f"Successfully loaded {len(keys_list)} signing key(s) from Supabase JWKS.")
    except Exception as e:
        print(f"Failed to fetch JWKS from Supabase: {e}")


def _decode_supabase_token(token: str) -> dict:
    """
    Verify and decode a Supabase-issued JWT.
    Supports ES256 signature verification via JWKS and falls back to HS256 secret.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # 1. Decode header to check kid and alg
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        alg = header.get("alg")
        
        if not kid:
            if alg == "HS256":
                # Fallback to HS256 with JWT Secret
                if not SUPABASE_JWT_SECRET:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Server auth not configured (SUPABASE_JWT_SECRET missing for HS256)",
                    )
                return jwt.decode(
                    token,
                    SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated",
                )
            else:
                raise credentials_exception

        # 2. ES256 verification using JWKS
        if not JWKS_CACHE or kid not in JWKS_CACHE:
            fetch_jwks()

        key_data = JWKS_CACHE.get(kid)
        if not key_data:
            # Retry fetching to handle rotated/new keys
            fetch_jwks()
            key_data = JWKS_CACHE.get(kid)
            if not key_data:
                raise credentials_exception

        # 3. Construct key and decode
        key = jwk.construct(key_data)
        payload = jwt.decode(
            token,
            key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        return payload
    except JWTError:
        raise credentials_exception


def get_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Dependency that returns the raw decoded JWT payload.
    Does NOT require the user to exist in our DB — used for create-profile.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode_supabase_token(credentials.credentials)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Full auth dependency: verifies Supabase JWT, then looks up the
    matching row in our users table by auth_id (JWT sub claim).
    Automatically creates the profile row on-the-fly if it doesn't exist.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        print("[Auth DEBUG] No credentials header found in request.")
        raise credentials_exception

    try:
        payload = _decode_supabase_token(credentials.credentials)
    except Exception as e:
        print(f"[Auth DEBUG] Token decode failed: {e}")
        raise credentials_exception

    auth_id: str = payload.get("sub")
    if not auth_id:
        print("[Auth DEBUG] Token is missing 'sub' (auth_id) claim.")
        raise credentials_exception

    print(f"[Auth DEBUG] Decoded token: sub={auth_id}, email={payload.get('email')}, role={payload.get('role')}")

    user = db.query(User).filter(User.auth_id == auth_id).first()
    if user is None:
        print(f"[Auth DEBUG] User not found in public.users table for auth_id={auth_id}. Creating on-the-fly...")
        # Get email from token payload
        email = payload.get("email", "")
        # Extract full name from user_metadata in token payload
        user_metadata = payload.get("user_metadata", {})
        full_name = user_metadata.get("full_name") or user_metadata.get("fullName")
        if not full_name:
            full_name = email.split("@")[0] if email else "New Smartan"
        
        # Link seeded user with same email if they exist but have no auth_id
        if email:
            existing_email = db.query(User).filter(User.email == email).first()
            if existing_email and not existing_email.auth_id:
                print(f"[Auth DEBUG] Found existing email match without auth_id. Linking {email}...")
                existing_email.auth_id = auth_id
                db.commit()
                db.refresh(existing_email)
                return existing_email

        # Otherwise create a new profile
        import uuid
        user_id = f"u{uuid.uuid4().hex[:8]}"
        base_username = email.split("@")[0] if email else f"user_{user_id[1:]}"
        
        try:
            # Enforce unique username
            username = base_username
            counter = 1
            while db.query(User).filter(User.username == username).first() is not None:
                username = f"{base_username}{counter}"
                counter += 1

            user = User(
                id=user_id,
                email=email,
                auth_id=auth_id,
                fullName=full_name,
                username=username,
                role=user_metadata.get("role", "smartan") if user_metadata.get("role") in ("smartan", "admin") else "smartan"
            )
            db.add(user)
            db.commit()
            
            # Create default settings
            from backend.models import Settings
            settings = Settings(userId=user_id)
            db.add(settings)
            db.commit()
            
            db.refresh(user)
            print(f"[Auth DEBUG] On-the-fly created profile and settings for new user: {email} (id: {user_id})")
        except Exception as err:
            db.rollback()
            print(f"[Auth DEBUG] Failed to create user on-the-fly: {err}")
            raise credentials_exception

    # Deactivation check
    if user.deactivated_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated",
        )

    print(f"[Auth DEBUG] Successfully authenticated user: {user.email} (id: {user.id})")
    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Security dependency to enforce role == 'admin'."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


# Proactively load JWKS keys on startup to prevent latency on first request
try:
    fetch_jwks()
except Exception as startup_err:
    print(f"Warning: Proactive JWKS load failed: {startup_err}")
