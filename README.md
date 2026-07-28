<div align="center">
  <img src="https://api.dicebear.com/7.x/shapes/svg?seed=InterviewIQ" width="120" height="120" alt="InterviewIQ Logo">
  <h1>InterviewIQ 🤖👔</h1>
  <p><strong>A SaaS AI Mock Interview Platform</strong></p>
  <p>Practice realistic, AI-driven behavioral and technical interviews tailored to your exact industry, role, and experience level.</p>

  [![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com/)
  [![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg?style=flat&logo=Vite&logoColor=white)](https://vitejs.dev/)
  [![Security](https://img.shields.io/badge/Security-Hardened-success.svg)](#security-architecture)
</div>

<br/>

## ✨ Features
* 🧠 **Dynamic AI Personas:** Interview with tough, analytical, or friendly AI personalities.
* 📄 **Resume Parsing:** Upload your PDF resume to receive a customized match score against JD keywords.
* 📈 **Instant Grading:** Receive immediate feedback on your performance using the STAR method, complete with actionable improvement plans.
* 🛡️ **Enterprise-Grade Security:** The platform is extensively hardened against CSRF, XSS, and DoS attacks (see Security Architecture).

---

## 🚀 Quick Start (Local Development)

### Prerequisites
* Node.js (v18+)
* Python (3.10+)

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup
```bash
# In the project root directory
npm install
npm run dev
```
Navigate to `http://localhost:5173` to start interviewing.

---

## 🔒 Security Architecture (OWASP Top 10 Hardened)

InterviewIQ takes candidate data privacy seriously. The platform implements defense-in-depth measures natively:

1. **Anti-XSS Session Management:** 
   JWT authentication tokens are *never* stored in browser `localStorage`. They are transmitted strictly via `HttpOnly`, `Secure`, and `SameSite=Strict` cookies.
2. **Anti-CSRF (Double Submit Pattern):** 
   State-changing endpoints require an `X-CSRF-Token` header that strictly matches a cryptographically secure, non-HttpOnly cookie assigned at login.
3. **DoS & Brute Force Protection (Rate Limiting):**
   * Configured globally with an in-memory `slowapi` rate limiter supporting proxy `X-Forwarded-For` mapping.
   * `5 requests/minute` limit on authentication endpoints.
   * `3 requests/minute` limit on compute-heavy resume/grading endpoints.
4. **Content Security Policy (CSP):**
   Strictly limits allowed domains for scripts, styles, fonts, and images at the middleware level.
5. **Secure File Uploads:**
   PDF uploads are capped at 5MB using incremental stream chunking, validating raw magic bytes (`%PDF-`) to prevent payload spoofing.
6. **Strict Password Policies:**
   Passwords undergo strict Pydantic regex validation (8+ characters, complex requirements) and are checked against a blocklist of compromised/common passwords before bcrypt hashing (Cost factor: 12).

---

## 🛠 Tech Stack
* **Frontend:** React 18, Vite, Tailwind CSS, Context API
* **Backend:** Python, FastAPI, SQLite, SQLAlchemy, Pydantic
* **Auth:** JWT (python-jose), Passlib (Bcrypt)
* **Rate Limiting:** SlowAPI

## 📜 License
MIT License.
