from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    google_id = Column(String, unique=True, index=True, nullable=True)
    avatar_url = Column(String, nullable=True)
    theme = Column(String, default="dark")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    resumes = relationship("Resume", back_populates="user")
    sessions = relationship("InterviewSession", back_populates="user")
    api_keys = relationship("ApiKey", back_populates="user")

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    file_name = Column(String)
    raw_text = Column(Text, nullable=True)
    match_percentage = Column(Integer)
    score_breakdown = Column(JSON)
    skills_matched = Column(JSON)
    skills_missing = Column(JSON)
    summary = Column(Text)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="resumes")

class Domain(Base):
    __tablename__ = "domains"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    roles = relationship("Role", back_populates="domain")
    questions = relationship("Question", back_populates="domain")

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"))
    title = Column(String)

    domain = relationship("Domain", back_populates="roles")

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"))
    track = Column(String) # technical, behavioral, system-design
    difficulty = Column(String)
    question_text = Column(Text)
    duration_seconds = Column(Integer)
    hint = Column(Text)

    domain = relationship("Domain", back_populates="questions")

class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    role_id = Column(Integer, ForeignKey("roles.id"))
    persona = Column(String)
    track = Column(String)
    difficulty = Column(String)
    experience_level = Column(String)
    question_count = Column(Integer)
    overall_score = Column(Integer, nullable=True)
    interviewer_comments = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")
    role = relationship("Role")
    answers = relationship("SessionAnswer", back_populates="session")
    score = relationship("SessionScore", back_populates="session", uselist=False)

class SessionAnswer(Base):
    __tablename__ = "session_answers"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    user_answer = Column(Text)
    score = Column(Integer)
    feedback = Column(Text)
    strengths = Column(Text)
    suggestions = Column(JSON)

    session = relationship("InterviewSession", back_populates="answers")
    question = relationship("Question")

class SessionScore(Base):
    __tablename__ = "session_scores"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"))
    technical_accuracy = Column(Integer)
    communication = Column(Integer)
    depth = Column(Integer)
    time_management = Column(Integer)

    session = relationship("InterviewSession", back_populates="score")

class ApiKey(Base):
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    provider = Column(String) # e.g. "anthropic"
    encrypted_key = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="api_keys")
