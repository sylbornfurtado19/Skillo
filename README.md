<div align="center">
  <h1>Skillo 🤖👔</h1>
  <p><strong>Next-Generation AI Career Coach & Mock Interview Platform</strong></p>
  <p>Practice realistic, AI-driven behavioral, technical, and system design interviews tailored to your exact resume, target job description, and seniority level.</p>

  [![Next.js](https://img.shields.io/badge/Next.js-16%20App%20Router-black.svg?style=flat&logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20Database-3ECF8E.svg?style=flat&logo=supabase)](https://supabase.com/)
</div>

<br/>

## ✨ Key Features

- 📄 **AI Resume Parser & Job Alignment:** Upload PDF/DOCX/TXT resumes to match your technical profile against target job descriptions, receiving instant gap analysis and missing skill indicators.
- 🎭 **Adaptive AI Assessor Personas:** Practice with customizable interviewer personas (e.g. Staff Engineer, Product-Minded Manager, or Strict AI Assessor) with unique pacing rules.
- 🎙️ **Speech-to-Text & Code Studio Workspace:** Toggle between live voice speech recognition (Web Speech API) and code editor typing mode for flexible response capture.
- 📊 **Performance Analytics & Radar Reports:** Interactive Chart.js radar and progression charts evaluating Technical Knowledge, Communication, Depth, and Problem Solving.
- 📄 **PDF Report Export:** Download comprehensive performance reports using dynamic client-side rendering (`html2canvas` + `jsPDF`).
- 🔐 **Secure Server Architecture:** Protected API endpoints (`/api/resume/analyze`, `/api/interview/evaluate`) with Zod schema validation and Supabase auth token verification.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18.17+ or v20+)
- npm / pnpm / yarn

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sylbornfurtado19/Skillo.git
   cd Skillo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Add your Supabase and Anthropic API credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ANTHROPIC_API_KEY=sk-ant-your-api-key
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Production Build Verification:**
   ```bash
   npm run build
   ```

---

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack, Server Actions / API Routes)
- **Language:** TypeScript (Strict mode enabled)
- **Styling & UI:** Tailwind CSS, Framer Motion, React Icons
- **Data Visualization:** Chart.js, react-chartjs-2 (Dynamic imports with SSR disabled)
- **Authentication & Database:** Supabase Auth, PostgreSQL (via `@supabase/supabase-js`)
- **Validation:** Zod Schema Validation

---

## 📜 License
MIT License.
