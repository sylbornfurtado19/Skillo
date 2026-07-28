# backend/main.py — InterviewIQ FastAPI Backend (Starter Scaffold)
# -------------------------------------------------------------------
# This file provides the same mock data the React front-end currently
# generates client-side, but served over proper HTTP endpoints so you
# can swap in real logic (DB queries, LLM calls, resume parsing) one
# endpoint at a time without touching the front-end.
# -------------------------------------------------------------------

import os
import random
import math
from typing import List, Optional
import secrets
import re

from dotenv import load_dotenv

load_dotenv() # Load .env file

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

class LimitUploadSize(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get('content-length')
        if content_length and int(content_length) > 6_291_456: # 6MB limit
            return Response(status_code=413, content=b'{"detail":"Payload Too Large"}', media_type="application/json")
        return await call_next(request)

class CSPMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        allowed = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            f"connect-src 'self' {allowed} http://localhost:8000 ws://localhost:5173 http://localhost:5173; "
            "img-src 'self' data: https://lh3.googleusercontent.com https://images.unsplash.com;"
        )
        response.headers["Content-Security-Policy"] = csp
        return response

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

def get_real_ip(request: Request):
    if "x-forwarded-for" in request.headers:
        return request.headers["x-forwarded-for"].split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

limiter = Limiter(key_func=get_real_ip, default_limits=["10/minute"])
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from database import engine, Base, get_db
import crud
import auth
import models

from google.oauth2 import id_token
from google.auth.transport import requests

# ─── App Setup ────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="InterviewIQ API",
    version="0.1.0",
    description="Backend API for the InterviewIQ mock-interview platform.",
)

# Allow the Vite dev server (localhost:5173) to call us
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(LimitUploadSize)
app.add_middleware(CSPMiddleware)

allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")]
print(f"[CORS] Allowed origins: {allowed_origins}")
print(f"[ENV] ENV={os.getenv('ENV')}, ALLOWED_ORIGINS={os.getenv('ALLOWED_ORIGINS')}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ─── Data Models (Pydantic) ──────────────────────────────────────────
class SetupData(BaseModel):
    domain: str = "Computer Science"
    role: str = "Software Engineer"
    experienceLevel: str = "Mid-Level"
    type: str = "Technical"
    difficulty: str = "Medium"
    questionCount: int = 5
    persona: str = "sarah"
    focusAreas: List[str] = []


class QuestionItem(BaseModel):
    id: str
    question: str
    duration: int
    hint: str = ""


class GradeRequest(BaseModel):
    setup: SetupData
    questions: List[QuestionItem]
    answers: List[str]


# ─── Static Data (mirrors src/services/*.js) ─────────────────────────

INTERVIEWER_PERSONAS = {
    "sarah": {
        "id": "sarah",
        "name": "Sarah Chen",
        "role": "Staff Engineer & Tech Lead",
        "company": "InterviewIQ (ex-Netflix)",
        "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120",
        "description": "Encouraging but detailed. Focuses heavily on clean architecture, performance, code readability, and deep problem-solving skills.",
        "accentColor": "text-indigo-400",
        "borderColor": "border-indigo-500/30",
        "bgColor": "bg-indigo-950/20",
        "glowColor": "glow-primary",
        "voicePitch": 1.0,
        "voiceRate": 1.0,
    },
    "david": {
        "id": "david",
        "name": "David Vance",
        "role": "Engineering Manager",
        "company": "InterviewIQ (ex-Stripe)",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120",
        "description": "Pragmatic, product-minded engineering manager. Focuses on execution, scope management, scalability, trade-offs, and communication.",
        "accentColor": "text-violet-400",
        "borderColor": "border-violet-500/30",
        "bgColor": "bg-violet-950/20",
        "glowColor": "glow-secondary",
        "voicePitch": 0.9,
        "voiceRate": 0.95,
    },
    "techbot": {
        "id": "techbot",
        "name": "TechBot v2.4",
        "role": "Autonomous AI Assessor",
        "company": "InterviewIQ Core Protocol",
        "avatar": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=120",
        "description": "Strict, analytical, and highly structured. Evaluates edge cases, algorithmic complexities, and rigorous logic without emotional bias.",
        "accentColor": "text-cyan-400",
        "borderColor": "border-cyan-500/30",
        "bgColor": "bg-cyan-950/20",
        "glowColor": "glow-accent",
        "voicePitch": 1.2,
        "voiceRate": 1.1,
    },
}

CAREER_DOMAINS = {
    "Computer Science": [
        "Software Engineer", "Frontend Developer", "Backend Developer",
        "Full Stack Developer", "Mobile App Developer", "DevOps Engineer",
        "Cloud Engineer", "Cybersecurity Analyst", "Network Engineer",
        "Database Engineer",
    ],
    "Artificial Intelligence": [
        "AI Engineer", "Machine Learning Engineer", "Deep Learning Engineer",
        "NLP Engineer", "Computer Vision Engineer", "Prompt Engineer",
    ],
    "Data & Analytics": [
        "Data Analyst", "Data Scientist",
        "Business Intelligence Analyst", "Data Engineer",
    ],
    "Finance": [
        "Financial Analyst", "Investment Analyst",
        "Equity Research Analyst", "Financial Planning Analyst",
    ],
    "Science & Education": [
        "Chemistry Teacher", "Physics Teacher", "Biology Teacher",
        "Mathematics Teacher", "Computer Science Teacher",
    ],
}

QUESTION_DATABASE = {
    "Computer Science": {
        "technical": [
            {"question": "Explain React's reconciliation algorithm and virtual DOM diffing. Why are keys important when rendering dynamic arrays?", "duration": 120, "hint": "Mention time complexity, element identity, and sibling reordering."},
            {"question": "What is the event loop in JavaScript? How does the browser handle microtasks (Promises) vs macrotasks (setTimeout)?", "duration": 150, "hint": "Talk about the call stack, task queues, and render cycles."},
            {"question": "Describe how closures work in JavaScript and how they can potentially cause memory leaks in modern single-page apps.", "duration": 120, "hint": "Discuss lexical scoping, garbage collection references, and clearing intervals."},
            {"question": "How would you optimize the Core Web Vitals (specifically LCP, INP, and CLS) for a large enterprise dashboard application?", "duration": 180, "hint": "Mention code splitting, dynamic imports, font swaps, and element sizing."},
            {"question": "What are the main architectural differences between SQL and NoSQL databases? In what scenarios would you choose one over the other?", "duration": 150, "hint": "Discuss transactions, ACID compliance, horizontal scaling, and document structures."},
        ]
    },
    "Artificial Intelligence": {
        "technical": [
            {"question": "Explain the self-attention mechanism in Transformer architectures. How does it resolve sequence order details?", "duration": 180, "hint": "Mention query-key-value projections, scaled dot-product attention, and positional encodings."},
            {"question": "What is the core difference between fine-tuning a Large Language Model and applying Retrieval-Augmented Generation (RAG)?", "duration": 150, "hint": "Analyze memory-weight updates, context window limitations, and latency costs."},
            {"question": "How do you handle issues of vanishing or exploding gradients when training deep neural network architectures?", "duration": 120, "hint": "Mention residual connections, batch normalization, gradient clipping, and activation functions."},
            {"question": "Explain the difference between supervised learning, unsupervised learning, and reinforcement learning.", "duration": 120, "hint": "Discuss labeled datasets, clustering algorithms, reward functions, and policy gradients."},
        ]
    },
    "Data & Analytics": {
        "technical": [
            {"question": "How would you write an optimized SQL query to perform a rolling average calculation over user activities without subqueries?", "duration": 150, "hint": "Mention window functions, PARTITION BY, and ROWS BETWEEN."},
            {"question": "What is the difference between a dimensional model (star schema) and a normalized model (snowflake schema)? When would you use each?", "duration": 120, "hint": "Discuss database normalization, query join performance, and data warehousing."},
            {"question": "How do you clean and preprocess a raw dataset containing significant levels of missing data and outliers?", "duration": 120, "hint": "Mention imputation methods, z-scores, interquartile range (IQR), and scaling."},
        ]
    },
    "Finance": {
        "technical": [
            {"question": "Walk me through how you build a discounted cash flow (DCF) model and how you calculate the Weighted Average Cost of Capital (WACC).", "duration": 180, "hint": "Explain free cash flows, terminal value, cost of equity (CAPM), and cost of debt."},
            {"question": "How do the three financial statements link together? Walk me through how a $10 depreciation expense flows through them.", "duration": 150, "hint": "Track changes from income statement net income, cash flow adjustments, to balance sheet assets."},
            {"question": "Explain the capital asset pricing model (CAPM) and how we would estimate beta for a private company.", "duration": 120, "hint": "Mention risk-free rate, market risk premium, and pure-play comparable public companies."},
        ]
    },
    "Science & Education": {
        "technical": [
            {"question": "How do you explain the concept of chemical equilibrium and Le Chatelier's principle to a class of high school students?", "duration": 120, "hint": "Focus on analogies, pressure/temperature stresses, and reversible reactions."},
            {"question": "Describe a laboratory experiment you would design to teach students about acid-base titrations. What indicators would you use?", "duration": 150, "hint": "Discuss safety protocols, buret setups, phenolphthalein, and pH curves."},
            {"question": "How do you structure a lesson plan on quadratic equations for students with diverse mathematical backgrounds?", "duration": 120, "hint": "Mention differentiated learning, visual graphs, factoring, and the quadratic formula."},
        ]
    },
    "behavioral": [
        {"question": "Describe a situation where you had a disagreement with a team member regarding a technical implementation. How did you resolve it?", "duration": 120, "hint": "Focus on communication, objective criteria, and team alignment."},
        {"question": "Tell me about a project that failed or had a significant setback. What was your role, and what steps did you take to mitigate it?", "duration": 150, "hint": "Show extreme ownership, constructive review, and prevention systems."},
        {"question": "How do you handle scope creep and tight deadlines when working on critical product launches?", "duration": 150, "hint": "Emphasize data-driven estimations, prioritization matrices, and stakeholder communication."},
    ],
    "system-design": [
        {"question": "Design a highly available and scalable notification service capable of sending billions of push alerts daily. How do you handle delivery deduplication?", "duration": 180, "hint": "Message queues (Kafka), idempotency keys, rate limiters, mail delivery providers."},
        {"question": "Design a real-time collaborative document editor like Google Docs. How do you manage concurrent editing conflicts?", "duration": 180, "hint": "Operational Transformation (OT) vs Conflict-free Replicated Data Types (CRDTs), WebSockets."},
        {"question": "Design a distributed rate limiter middleware for a high-traffic API gateway. What algorithms would you choose?", "duration": 180, "hint": "Token bucket vs leaky bucket, Redis cluster counters, sliding window logs."},
    ],
}


# ─── Helpers ──────────────────────────────────────────────────────────

def get_questions_for_setup(
    q_type: str = "technical",
    difficulty: str = "medium",
    domain: str = "Computer Science",
) -> list[dict]:
    """Return a list of questions matching the requested type/domain."""
    norm_type = q_type.lower()

    if norm_type == "behavioral":
        questions = list(QUESTION_DATABASE["behavioral"])
    elif norm_type in ("system design", "system-design"):
        questions = list(QUESTION_DATABASE["system-design"])
    elif norm_type == "mixed":
        domain_tech = (
            QUESTION_DATABASE.get(domain, {}).get("technical")
            or QUESTION_DATABASE["Computer Science"]["technical"]
        )
        questions = (
            domain_tech[:2]
            + QUESTION_DATABASE["behavioral"][:1]
            + QUESTION_DATABASE["system-design"][:1]
        )
    else:
        questions = list(
            QUESTION_DATABASE.get(domain, {}).get("technical")
            or QUESTION_DATABASE["Computer Science"]["technical"]
        )

    diff_prefix = ""
    if difficulty.lower() == "easy":
        diff_prefix = "[Fundamentals] "
    elif difficulty.lower() == "hard":
        diff_prefix = "[Advanced Theory] "

    return [
        {
            "id": f"q_{norm_type}_{idx}",
            "question": f"{diff_prefix}{q['question']}",
            "duration": q["duration"],
            "hint": q.get("hint", ""),
        }
        for idx, q in enumerate(questions)
    ]


def generate_feedback_report(
    setup: dict, questions_list: list[dict], answers_list: list[str]
) -> dict:
    """Produce a mock grading report identical to resultsApi.js output."""
    scores = {
        "technicalAccuracy": 75 + random.randint(0, 19),
        "communication": 80 + random.randint(0, 14),
        "depth": 70 + random.randint(0, 24),
        "timeManagement": 85 + random.randint(0, 11),
    }
    overall = round(sum(scores.values()) / 4)

    q_type = setup.get("type", "technical").lower()
    breakdowns = []
    for idx, q in enumerate(questions_list):
        answer = answers_list[idx] if idx < len(answers_list) else "No answer provided."
        score_val = 70 + (idx * 6 + len(answer) % 20) % 25

        if q_type == "technical":
            feedback = (
                "Good usage of technical terms. You successfully touched on key structural mechanics. "
                "Your description was logical and easy to follow."
            )
            suggestions = [
                "Include more concrete examples of how you applied this in a past production system.",
                "Mention the time complexity or rendering overhead details to showcase senior depth.",
            ]
        elif q_type == "behavioral":
            feedback = (
                "Strong narrative alignment. You set the context and actions clearly. "
                "Great usage of the STAR framework (Situation, Task, Action, Result)."
            )
            suggestions = [
                "Provide more specific metrics on the outcome (e.g. numbers, percentages, times saved).",
                "Explain what you would do differently in hindsight.",
            ]
        else:
            feedback = (
                "Your high level block diagram elements were well described. "
                "Clear explanation of network interfaces and data stores."
            )
            suggestions = [
                "Discuss scalability limitations and point out single points of failure (SPOFs).",
                "Consider caching and database read/write ratios.",
            ]

        breakdowns.append(
            {
                "id": q.get("id", f"q_{idx}"),
                "question": q["question"],
                "userAnswer": answer,
                "score": score_val,
                "idealConcepts": q.get("hint", "Core concepts related to the topic."),
                "feedback": feedback,
                "suggestions": suggestions,
                "strengths": (
                    "Detailed response structure, use of industry terminology."
                    if len(answer) > 80
                    else "Direct, straightforward communication."
                ),
            }
        )

    return {
        "overallScore": overall,
        "categories": scores,
        "breakdown": breakdowns,
        "interviewerComments": (
            f"You performed well during this {setup.get('type', 'technical')} interview. "
            "Your structural clarity stands out, and you communicate technical decisions with "
            "strong confidence. Focus on providing quantitative evidence in behavioral tracks "
            "and detailing edge cases in technical tracks to elevate your performance further."
        ),
        "personaId": setup.get("persona", "sarah"),
        "setupData": setup,
        "strengths": [
            "Clear articulation of core concepts",
            "Good structural organisation of answers",
            "Confident communication style",
        ],
        "weaknesses": [
            "Could provide more concrete production examples",
            "Edge-case analysis could be deeper",
        ],
        "plan": [
            {"topic": "System Design Patterns", "desc": "Study distributed caching, message queues, and load balancing strategies."},
            {"topic": "Algorithmic Complexity", "desc": "Practice Big-O analysis for common data structures and sorting algorithms."},
            {"topic": "Behavioural Storytelling", "desc": "Prepare 5 STAR-framework stories with quantifiable outcomes."},
        ],
    }


# ─── Endpoints ────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "ok", "service": "InterviewIQ API", "version": "0.1.0"}


@app.get("/healthz")
async def healthz():
    return {"status": "healthy"}


# --- Auth ---
COMMON_PASSWORDS = {"password", "12345678", "qwerty123", "123456789", "123456", "password123", "111111", "admin123"}

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character.")
        if v.lower() in COMMON_PASSWORDS:
            raise ValueError("Password is too common. Please choose a stronger password.")
        return v

class UserLogin(BaseModel):
    email: str
    password: str

def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    email = auth.verify_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = crud.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def verify_csrf_token(request: Request):
    csrf_cookie = request.cookies.get("csrf_token")
    csrf_header = request.headers.get("x-csrf-token")
    if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(status_code=403, detail="CSRF token validation failed")

@app.post("/api/auth/register")
@limiter.limit("5/minute")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user.model_dump())

@app.post("/api/auth/login")
@limiter.limit("5/minute")
def login(request: Request, user: UserLogin, response: Response, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    
    # Check if the user exists and if their password is valid.
    # Sentinel values for Google OAuth accounts will fail verify_password.
    if not db_user or db_user.password_hash == "!GOOGLE_OAUTH_ACCOUNT!":
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    try:
        if not auth.verify_password(user.password, db_user.password_hash):
            raise HTTPException(status_code=400, detail="Incorrect email or password")
    except ValueError:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token = auth.create_access_token(data={"sub": db_user.email})
    samesite_policy = "none" if os.getenv("ENV") == "production" else "strict"
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite=samesite_policy,
        path="/",
        max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=True,
        samesite=samesite_policy,
        path="/"
    )
    return {
        "user": {
            "id": db_user.id, 
            "email": db_user.email, 
            "name": db_user.name, 
            "avatar_url": db_user.avatar_url
        }
    }

# --- Google OAuth ---
class GoogleAuth(BaseModel):
    credential: str

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", os.getenv("VITE_GOOGLE_CLIENT_ID", "your-client-id.apps.googleusercontent.com"))

@app.post("/api/auth/google")
@limiter.limit("5/minute")
def google_auth(request: Request, data: GoogleAuth, response: Response, db: Session = Depends(get_db)):
    try:
        # Verify the token
        idinfo = id_token.verify_oauth2_token(
            data.credential, requests.Request(), GOOGLE_CLIENT_ID, clock_skew_in_seconds=10
        )
        
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer.")
            
        email = idinfo['email']
        name = idinfo.get('name', 'Google User')
        picture = idinfo.get('picture', '')
        google_id = idinfo['sub']
        
        db_user = crud.get_or_create_google_user(db, email, name, picture, google_id)
        
        access_token = auth.create_access_token(data={"sub": db_user.email})
        samesite_policy = "none" if os.getenv("ENV") == "production" else "strict"
        
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=True,
            samesite=samesite_policy,
            path="/",
            max_age=auth.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
        csrf_token = secrets.token_urlsafe(32)
        response.set_cookie(
            key="csrf_token",
            value=csrf_token,
            httponly=False,
            secure=True,
            samesite=samesite_policy,
            path="/"
        )
        return {
            "user": {
                "id": db_user.id,
                "email": db_user.email,
                "name": db_user.name,
                "avatar_url": db_user.avatar_url
            }
        }
    except ValueError as e:
        print(f"Google Token Verification Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google token")

@app.post("/api/auth/logout")
def logout(response: Response, _ = Depends(verify_csrf_token)):
    samesite_policy = "none" if os.getenv("ENV") == "production" else "strict"
    response.delete_cookie("access_token", path="/", samesite=samesite_policy, secure=True, httponly=True)
    response.delete_cookie("csrf_token", path="/", samesite=samesite_policy, secure=True, httponly=False)
    return {"status": "logged out"}

@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "avatar_url": current_user.avatar_url
        }
    }


# --- Personas ---
@app.get("/api/personas")
async def get_personas():
    """Return the list of available AI interviewer personas."""
    return INTERVIEWER_PERSONAS


# --- Career Domains & Roles ---
@app.get("/api/domains")
async def get_domains():
    """Return a list of supported career domain names."""
    return list(CAREER_DOMAINS.keys())


@app.get("/api/domains/{domain}/roles")
async def get_roles(domain: str):
    """Return the roles available under a specific domain."""
    roles = CAREER_DOMAINS.get(domain)
    if roles is None:
        raise HTTPException(status_code=404, detail=f"Domain '{domain}' not found.")
    return roles


# --- Questions ---
@app.get("/api/questions")
async def get_questions(
    domain: str = "Computer Science",
    difficulty: str = "medium",
    type: str = "technical",
    count: Optional[int] = None,
):
    """Return a set of mock interview questions."""
    qs = get_questions_for_setup(type, difficulty, domain)
    if count and count < len(qs):
        qs = qs[:count]
    return qs


# --- Resume Upload ---
@app.post("/api/resume")
@limiter.limit("3/minute")
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    jobTitle: str = Form("Software Engineer"),
    jobDescription: str = Form(""),
    _ = Depends(verify_csrf_token)
):
    """
    Accept a resume file and return a mock analysis report.
    """
    MAX_FILE_SIZE = 5 * 1024 * 1024
    real_file_size = 0
    
    # Read the first chunk to verify magic bytes (PDFs start with %PDF-)
    chunk = await file.read(1024)
    if not chunk.startswith(b'%PDF-'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDFs are allowed.")
    real_file_size += len(chunk)
    
    # Continue reading in chunks to ensure we don't exceed 5MB
    while True:
        chunk = await file.read(1024 * 1024) # read 1MB at a time
        if not chunk:
            break
        real_file_size += len(chunk)
        if real_file_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 5MB.")
            
    # Reset file cursor for any subsequent processing
    await file.seek(0)

    common_keywords = ["React", "TypeScript", "JavaScript", "Tailwind", "Git", "REST API", "Vite", "State Management"]
    missing_keywords = ["Next.js", "GraphQL", "Docker", "CI/CD", "Jest/Cypress", "System Design"]

    length_score = min(25, len(jobTitle) + len(jobDescription) // 10)
    base_match = 65 + (length_score % 20)

    return {
        "matchPercentage": base_match,
        "fileName": file.filename,
        "skillsMatched": common_keywords[: 4 + (base_match % 4)],
        "skillsMissing": missing_keywords[: 2 + (base_match % 3)],
        "summary": (
            f"Your resume demonstrates a strong foundational match for the {jobTitle} role. "
            "Key highlights include hands-on experience with modern frontend practices and "
            "responsive design systems. To improve compatibility, consider adding more "
            "references to full-stack integration and testing tools."
        ),
        "scoreBreakdown": {
            "formatting": 90,
            "skills": base_match + 2,
            "experienceRelevance": base_match - 5,
            "impactMetrics": 72,
        },
        "recommendations": [
            "Quantify accomplishments with metrics (e.g., 'Optimized render cycles leading to a 30% reduction in TTI').",
            f"Add explicit mentions of {missing_keywords[0]} and {missing_keywords[1]} to pass recruiter screening.",
            "Include testing workflows such as unit tests with Vitest/Jest or end-to-end integration.",
        ],
    }


# --- Grading ---
@app.post("/api/grade")
@limiter.limit("3/minute")
async def grade(request: Request, req: GradeRequest, _ = Depends(verify_csrf_token)):
    """
    Grade an interview session and return a detailed feedback report.
    In production, call Claude / OpenAI server-side here with your
    secret API key instead of the mock generator.
    """
    report = generate_feedback_report(
        req.setup.model_dump(),
        [q.model_dump() for q in req.questions],
        req.answers,
    )
    return report


# ─── Entry Point ──────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
