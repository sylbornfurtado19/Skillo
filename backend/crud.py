from sqlalchemy.orm import Session
import models, auth
from datetime import datetime

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: dict):
    hashed_password = auth.get_password_hash(user["password"])
    db_user = models.User(
        email=user["email"],
        name=user["name"],
        password_hash=hashed_password,
        avatar_url=user.get("avatar_url", "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user["name"])
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_or_create_google_user(db: Session, email: str, name: str, avatar_url: str, google_id: str):
    user = get_user_by_email(db, email)
    if not user:
        user = models.User(
            email=email,
            name=name,
            avatar_url=avatar_url,
            password_hash="!GOOGLE_OAUTH_ACCOUNT!", # Sentinel value to prevent regular login
            google_id=google_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.google_id:
        user.google_id = google_id
        db.commit()
        db.refresh(user)
    return user

def create_session(db: Session, user_id: int, setup_data: dict):
    db_session = models.InterviewSession(
        user_id=user_id,
        persona=setup_data.get("persona"),
        track=setup_data.get("type"),
        difficulty=setup_data.get("difficulty"),
        experience_level=setup_data.get("experienceLevel"),
        question_count=setup_data.get("questionCount")
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def save_session_results(db: Session, session_id: int, report: dict):
    db_session = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()
    if db_session:
        db_session.overall_score = report.get("overallScore")
        db_session.interviewer_comments = report.get("interviewerComments")
        db_session.completed_at = datetime.utcnow()
        
    categories = report.get("categories", {})
    score = models.SessionScore(
        session_id=session_id,
        technical_accuracy=categories.get("technicalAccuracy", 0),
        communication=categories.get("communication", 0),
        depth=categories.get("depth", 0),
        time_management=categories.get("timeManagement", 0)
    )
    db.add(score)
    db.commit()

def get_user_sessions(db: Session, user_id: int):
    return db.query(models.InterviewSession).filter(models.InterviewSession.user_id == user_id).all()
