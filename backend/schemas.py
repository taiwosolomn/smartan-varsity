from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any
from datetime import datetime, date

# --- AUTH SCHEMAS ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    fullName: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoalSchema(BaseModel):
    text: str
    target: str
    completed: bool = False

class ProfileCreate(BaseModel):
    """Used by the frontend to create a user profile row after Supabase Auth signup."""
    fullName: str

class ChangeEmailRequest(BaseModel):
    newEmail: EmailStr
    # No password — Supabase Auth session is proof of identity

class ChangeUsernameRequest(BaseModel):
    newUsername: str
    # No password — user is authenticated via Supabase JWT

class ChangePasswordRequest(BaseModel):
    newPassword: str = Field(..., min_length=6)
    # No currentPassword — Supabase updateUser() is called directly from frontend
    # Backend endpoint kept for any server-side password logic if needed

class UserProfileUpdate(BaseModel):
    fullName: Optional[str] = None
    mission: Optional[str] = None
    projectSummary: Optional[str] = None
    location: Optional[str] = None
    goals: Optional[List[GoalSchema]] = None

class UserResponse(BaseModel):
    id: str
    email: str
    fullName: str
    username: Optional[str] = None
    avatarUrl: Optional[str] = None
    mission: str
    projectSummary: str
    location: str
    goals: List[GoalSchema]
    createdAt: datetime
    role: str
    deactivated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- SETTINGS SCHEMAS ---
class SettingsUpdate(BaseModel):
    accentColor: Optional[str] = None
    dailyReminder: Optional[bool] = None
    reminderTime: Optional[str] = None
    weeklyReview: Optional[bool] = None
    streakNotif: Optional[bool] = None

class SettingsResponse(BaseModel):
    userId: str
    accentColor: str
    dailyReminder: bool
    reminderTime: str
    weeklyReview: bool
    streakNotif: bool

    class Config:
        from_attributes = True

# --- MODULE SCHEMAS ---
class ModuleCreate(BaseModel):
    title: str
    type: str = "reading"  # reading, video, drill, project, assessment, note, custom

class ModuleUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None  # todo, inprogress, done
    order: Optional[int] = None
    notes: Optional[str] = None

class ModuleResponse(BaseModel):
    id: str
    courseId: str
    title: str
    type: str
    status: str
    order: int
    notes: Optional[str] = None
    completedAt: Optional[datetime] = None
    deadline: Optional[date] = None
    day: Optional[str] = None
    task: Optional[str] = None
    description: Optional[str] = None
    due_by_week: Optional[int] = None

    class Config:
        from_attributes = True

# --- COURSE SCHEMAS ---
class CourseCreate(BaseModel):
    name: str

class CourseUpdate(BaseModel):
    name: Optional[str] = None
    order: Optional[int] = None

class CourseResponse(BaseModel):
    id: str
    trackId: str
    name: str
    order: int
    modules: List[ModuleResponse] = []
    deadline: Optional[date] = None
    deliverable: Optional[str] = None
    spans_weeks: Optional[str] = None
    reference: Optional[str] = None

    class Config:
        from_attributes = True

# --- TRACK SCHEMAS ---
class TrackCreate(BaseModel):
    name: str
    icon: Optional[str] = "📚"
    color: Optional[str] = "#cc3333"
    phase: Optional[str] = "Semester 1"
    icon_type: Optional[str] = "emoji"
    icon_value: Optional[str] = None
    icon_image_url: Optional[str] = None
    icon_thumb_url: Optional[str] = None


class TrackUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    phase: Optional[str] = None
    order: Optional[int] = None
    icon_type: Optional[str] = None
    icon_value: Optional[str] = None
    icon_image_url: Optional[str] = None
    icon_thumb_url: Optional[str] = None

class TrackResponse(BaseModel):
    id: str
    name: str
    icon: str
    color: str
    phase: str
    order: int
    icon_type: Optional[str] = "emoji"
    icon_value: Optional[str] = None
    icon_image_url: Optional[str] = None
    icon_thumb_url: Optional[str] = None
    deadline: Optional[Any] = None
    code: Optional[str] = None
    weekly_hours: Optional[float] = None
    total_hours: Optional[float] = None
    track_resources: Optional[dict] = None
    smartan_builder_alignment: Optional[list] = None
    live_industry_experiences: Optional[list] = None

    class Config:
        from_attributes = True

class TrackDetailResponse(TrackResponse):
    courses: List[CourseResponse] = []

    class Config:
        from_attributes = True

class TrackReorder(BaseModel):
    trackId: str
    order: int

class TrackReorderList(BaseModel):
    tracks: List[TrackReorder]

class CourseReorder(BaseModel):
    courseId: str
    order: int

class CourseReorderList(BaseModel):
    courses: List[CourseReorder]

class ModuleReorder(BaseModel):
    moduleId: str
    order: int

class ModuleReorderList(BaseModel):
    modules: List[ModuleReorder]

# --- SESSION LOG SCHEMAS ---
class SessionLogCreate(BaseModel):
    trackId: str
    topic: str
    duration: int
    date: str  # YYYY-MM-DD
    rating: int  # 1-10
    notes: Optional[str] = None
    milestoneReached: bool = False
    milestoneName: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None

class SessionLogResponse(BaseModel):
    id: str
    trackId: str
    topic: str
    duration: int
    date: str
    rating: int
    notes: Optional[str] = None
    milestoneReached: bool = False
    milestoneName: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None

    class Config:
        from_attributes = True

# --- MILESTONE SCHEMAS ---
class MilestoneResponse(BaseModel):
    id: str
    trackId: str
    name: str
    date: str
    sessionLogId: Optional[str] = None

    class Config:
        from_attributes = True

# --- CALENDAR SCHEMAS ---
class CalendarEventCreate(BaseModel):
    trackId: str
    topic: str
    date: str  # YYYY-MM-DD
    time: str = "09:00"
    duration: int = 90

class CalendarEventResponse(BaseModel):
    id: str
    trackId: str
    topic: str
    date: str
    time: str
    duration: int

    class Config:
        from_attributes = True

# --- RESOURCE SCHEMAS ---
class ResourceCreate(BaseModel):
    title: str
    type: str  # Article, Video, Book, Tool, Paper, Course
    trackId: str
    url: Optional[str] = None
    notes: Optional[str] = None

class ResourceResponse(BaseModel):
    id: str
    trackId: str
    title: str
    type: str
    url: Optional[str] = None
    notes: Optional[str] = None
    addedAt: str
    linkStatus: Optional[str] = None
    lastChecked: Optional[str] = None

    class Config:
        from_attributes = True
