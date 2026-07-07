import datetime
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(String, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True, nullable=False)
    auth_id         = Column(String, unique=True, index=True, nullable=False)  # UUID references auth.users(id)
    fullName        = Column(String, nullable=False)
    username        = Column(String, unique=True, index=True, nullable=True)
    avatarUrl       = Column(String, nullable=True)
    mission         = Column(Text, default="")
    projectSummary  = Column(Text, default="")
    location        = Column(String, default="")
    goals           = Column(JSONB, default=list)       # [{ text, target }]
    createdAt       = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    role            = Column(String, nullable=False, default="smartan")
    deactivated_at  = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    tracks         = relationship("Track",         back_populates="user", cascade="all, delete-orphan")
    session_logs   = relationship("SessionLog",    back_populates="user", cascade="all, delete-orphan")
    milestones     = relationship("Milestone",     back_populates="user", cascade="all, delete-orphan")
    calendar_events = relationship("CalendarEvent", back_populates="user", cascade="all, delete-orphan")
    resources      = relationship("Resource",      back_populates="user", cascade="all, delete-orphan")
    settings       = relationship("Settings",      back_populates="user", uselist=False, cascade="all, delete-orphan")


class Track(Base):
    __tablename__ = "tracks"

    id             = Column(String, primary_key=True, index=True)
    userId         = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name           = Column(String, nullable=False)
    icon           = Column(String, default="📚")
    color          = Column(String, default="#cc3333")
    phase          = Column(String, default="Phase I")
    order          = Column(Integer, default=0)
    createdAt      = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
    hslHue         = Column(Integer, nullable=True)
    hslSaturation  = Column(Integer, nullable=True)
    hslLightness   = Column(Integer, nullable=True)
    icon_type      = Column(String(10), default='emoji')   # 'emoji' | 'image' | 'library'
    icon_value     = Column(Text, nullable=True)            # emoji char, library icon ID, or upload URL
    icon_image_url = Column(Text, nullable=True)            # full-size uploaded image URL
    icon_thumb_url = Column(Text, nullable=True)            # 48 px thumbnail URL

    # Relationships
    user            = relationship("User",    back_populates="tracks")
    courses         = relationship("Course",        back_populates="track", cascade="all, delete-orphan", order_by="Course.order")
    session_logs    = relationship("SessionLog",    back_populates="track", cascade="all, delete-orphan")
    milestones      = relationship("Milestone",     back_populates="track", cascade="all, delete-orphan")
    calendar_events = relationship("CalendarEvent", back_populates="track", cascade="all, delete-orphan")
    resources       = relationship("Resource",      back_populates="track", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"

    id        = Column(String, primary_key=True, index=True)
    trackId   = Column(String, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    name      = Column(String, nullable=False)
    order     = Column(Integer, default=0)
    createdAt = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)

    # Relationships
    track   = relationship("Track",  back_populates="courses")
    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan", order_by="Module.order")


class Module(Base):
    __tablename__ = "modules"

    id          = Column(String, primary_key=True, index=True)
    courseId    = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title       = Column(String, nullable=False)
    type        = Column(String, default="reading")    # reading, video, drill, project, assessment, note, custom
    status      = Column(String, default="todo")       # todo, inprogress, done
    order       = Column(Integer, default=0)
    notes       = Column(Text, nullable=True)
    completedAt = Column(DateTime(timezone=True), nullable=True)
    createdAt   = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)

    # Relationships
    course = relationship("Course", back_populates="modules")


class SessionLog(Base):
    __tablename__ = "session_logs"

    id               = Column(String, primary_key=True, index=True)
    userId           = Column(String, ForeignKey("users.id", ondelete="CASCADE"),  nullable=False, index=True)
    trackId          = Column(String, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    topic            = Column(String, nullable=False)
    duration         = Column(Integer, nullable=False)   # minutes
    date             = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    rating           = Column(Integer, default=7)        # 1–10
    notes            = Column(Text, nullable=True)
    milestoneReached = Column(Boolean, default=False)
    milestoneName    = Column(String, nullable=True)
    startTime        = Column(String, nullable=True)
    endTime          = Column(String, nullable=True)
    createdAt        = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)

    # Relationships
    user  = relationship("User",  back_populates="session_logs")
    track = relationship("Track", back_populates="session_logs")


class Milestone(Base):
    __tablename__ = "milestones"

    id           = Column(String, primary_key=True, index=True)
    userId       = Column(String, ForeignKey("users.id",        ondelete="CASCADE"), nullable=False, index=True)
    trackId      = Column(String, ForeignKey("tracks.id",       ondelete="CASCADE"), nullable=False, index=True)
    sessionLogId = Column(String, ForeignKey("session_logs.id", ondelete="CASCADE"), nullable=True,  index=True)
    name         = Column(String, nullable=False)
    date         = Column(String, nullable=False)  # YYYY-MM-DD
    createdAt    = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)

    # Relationships
    user  = relationship("User",  back_populates="milestones")
    track = relationship("Track", back_populates="milestones")


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id        = Column(String, primary_key=True, index=True)
    userId    = Column(String, ForeignKey("users.id",  ondelete="CASCADE"), nullable=False, index=True)
    trackId   = Column(String, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    topic     = Column(String, nullable=False)
    date      = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    time      = Column(String, default="09:00")             # HH:MM
    duration  = Column(Integer, default=90)                 # minutes
    createdAt = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)

    # Relationships
    user  = relationship("User",  back_populates="calendar_events")
    track = relationship("Track", back_populates="calendar_events")


class Resource(Base):
    __tablename__ = "resources"

    id          = Column(String, primary_key=True, index=True)
    userId      = Column(String, ForeignKey("users.id",  ondelete="CASCADE"), nullable=False, index=True)
    trackId     = Column(String, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False, index=True)
    title       = Column(String, nullable=False)
    type        = Column(String, nullable=False)   # Article, Video, Book, Tool, Paper, Course
    url         = Column(String, nullable=True)
    notes       = Column(Text, nullable=True)
    addedAt     = Column(String, nullable=False)   # YYYY-MM-DD
    linkStatus  = Column(String, nullable=True)
    lastChecked = Column(String, nullable=True)

    # Relationships
    user  = relationship("User",  back_populates="resources")
    track = relationship("Track", back_populates="resources")


class Settings(Base):
    __tablename__ = "settings"

    userId         = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    accentColor    = Column(String,  default="#cc3333")
    dailyReminder  = Column(Boolean, default=False)
    reminderTime   = Column(String,  default="07:00")
    weeklyReview   = Column(Boolean, default=False)
    streakNotif    = Column(Boolean, default=True)

    # Relationships
    user = relationship("User", back_populates="settings")


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_id     = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_role   = Column(String, nullable=False)
    event_type   = Column(String, nullable=False)
    event_detail = Column(JSONB, nullable=True)
    created_at   = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)

    # Relationships
    user  = relationship("User", foreign_keys=[user_id])
    actor = relationship("User", foreign_keys=[actor_id])


class Notification(Base):
    __tablename__ = "notifications"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    message      = Column(Text, nullable=False)
    created_at   = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)

    sender    = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


class NotificationRead(Base):
    __tablename__ = "notification_reads"

    notification_id = Column(UUID(as_uuid=True), ForeignKey("notifications.id", ondelete="CASCADE"), primary_key=True, index=True)
    user_id         = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    read_at         = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)


class EngagementFlagAcknowledgement(Base):
    __tablename__ = "engagement_flag_acknowledgements"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id        = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    smartan_id      = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    flag_type       = Column(String, nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow)
