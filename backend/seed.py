import json
import os
from sqlalchemy.orm import Session
from models import User, Track, Course, Module, SessionLog, Milestone, CalendarEvent, Resource, Settings
from auth import hash_password

def seed_db(db: Session):
    # Check if we already have data
    if db.query(User).first() is not None:
        print("Database already seeded.")
        return

    json_path = os.path.join(os.path.dirname(__file__), "..", "smartan-varsity-data.json")
    if not os.path.exists(json_path):
        print(f"Seed file not found at {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Seed User
    profile = data.get("profile", {})
    # Default credentials for dev seed
    default_email = "user@domain.com"
    hashed_pw = hash_password("smartan123")  # Default password
    
    user = User(
        id="u1",
        email=default_email,
        hashed_password=hashed_pw,
        fullName=profile.get("fullName", "your full name"),
        avatarUrl=None,
        mission=profile.get("mission", "Dangerous at 23."),
        projectSummary=profile.get("project", ""),
        goals=profile.get("goals", [])
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 2. Seed Settings
    settings_data = data.get("settings", {})
    settings = Settings(
        userId=user.id,
        accentColor=settings_data.get("accentColor", "#cc3333"),
        dailyReminder=settings_data.get("dailyReminder", False),
        reminderTime=settings_data.get("reminderTime", "07:00"),
        weeklyReview=settings_data.get("weeklyReview", False),
        streakNotif=settings_data.get("streakNotif", True)
    )
    db.add(settings)

    # 3. Seed Tracks, Courses, and Modules
    tracks_data = data.get("tracks", [])
    for t_data in tracks_data:
        track = Track(
            id=t_data["id"],
            userId=user.id,
            name=t_data["name"],
            icon=t_data.get("icon", "🧠"),
            color=t_data.get("color", "#cc3333"),
            phase=t_data.get("phase", "Phase I"),
            order=0  # will order sequentially
        )
        db.add(track)

        # Seed courses in track
        courses_data = t_data.get("courses", [])
        for c_idx, c_data in enumerate(courses_data):
            course = Course(
                id=c_data.get("id", f"c_{track.id}_{c_idx}"),
                trackId=track.id,
                name=c_data["name"],
                order=c_idx
            )
            db.add(course)

            # Seed modules in course
            modules_data = c_data.get("modules", [])
            for m_idx, m_data in enumerate(modules_data):
                module = Module(
                    id=m_data.get("id", f"m_{course.id}_{m_idx}"),
                    courseId=course.id,
                    title=m_data["title"],
                    type=m_data.get("type", "reading"),
                    status=m_data.get("status", "todo"),
                    order=m_idx
                )
                db.add(module)

    # 4. Seed Session Logs
    logs_data = data.get("logs", [])
    for log_data in logs_data:
        # Convert JS structure date placeholders or absolute dates
        log = SessionLog(
            id=log_data["id"],
            userId=user.id,
            trackId=log_data["trackId"],
            topic=log_data["topic"],
            duration=log_data["duration"],
            date=log_data["date"],
            rating=log_data.get("rating", 7),
            notes=log_data.get("notes"),
            milestoneReached=log_data.get("milestone") is not None,
            milestoneName=log_data.get("milestone")
        )
        db.add(log)

    # 5. Seed Calendar
    cal_events_data = data.get("calendar", [])
    for cal_data in cal_events_data:
        event = CalendarEvent(
            id=cal_data["id"],
            userId=user.id,
            trackId=cal_data["trackId"],
            topic=cal_data["topic"],
            date=cal_data["date"],
            time=cal_data.get("time", "09:00"),
            duration=cal_data.get("duration", 90)
        )
        db.add(event)

    # 6. Seed Resources
    resources_data = data.get("resources", [])
    for res_data in resources_data:
        res = Resource(
            id=res_data["id"],
            userId=user.id,
            trackId=res_data["trackId"],
            title=res_data["title"],
            type=res_data["type"],
            url=res_data.get("url"),
            notes=res_data.get("notes"),
            addedAt=res_data["added"]
        )
        db.add(res)

    # 7. Seed Milestones
    milestones_data = data.get("milestones", [])
    for ms_data in milestones_data:
        ms = Milestone(
            id=ms_data["id"],
            userId=user.id,
            trackId=ms_data["trackId"],
            name=ms_data["name"],
            date=ms_data["date"]
        )
        db.add(ms)

    db.commit()
    print("Database seeding completed.")

if __name__ == "__main__":
    from database import SessionLocal
    db = SessionLocal()
    try:
        seed_db(db)
    finally:
        db.close()
