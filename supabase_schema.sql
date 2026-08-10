-- =========================================================
-- Skillo Database Schema & Row Level Security (RLS) Setup
-- Intelligent Resume Screening & AI Interview Assistant
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    title TEXT,
    location TEXT,
    experience TEXT,
    profile_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration-safe column additions for existing profiles tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_settings JSONB DEFAULT '{}'::jsonb;


-- 2. RESUMES TABLE
CREATE TABLE IF NOT EXISTS public.resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RESUME ANALYSIS TABLE
CREATE TABLE IF NOT EXISTS public.resume_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    job_title TEXT,
    job_description TEXT,
    match_percentage NUMERIC(5,2),
    skills_matched TEXT[],
    skills_missing TEXT[],
    summary TEXT,
    score_breakdown JSONB DEFAULT '{}'::jsonb,
    recommendations TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. JOBS TABLE
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    domain TEXT NOT NULL,
    description TEXT,
    requirements TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MOCK INTERVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.mock_interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    role TEXT NOT NULL,
    experience_level TEXT,
    interview_type TEXT,
    persona TEXT,
    overall_score NUMERIC(5,2),
    categories JSONB DEFAULT '{}'::jsonb,
    breakdown JSONB DEFAULT '[]'::jsonb,
    interviewer_comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration-safe column additions for existing mock_interviews tables
ALTER TABLE public.mock_interviews ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'Generic';
ALTER TABLE public.mock_interviews ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 45;
ALTER TABLE public.mock_interviews ADD COLUMN IF NOT EXISTS interview_mode_id TEXT DEFAULT 'generic-technical';
ALTER TABLE public.mock_interviews ADD COLUMN IF NOT EXISTS system_design_diagram JSONB DEFAULT '{}'::jsonb;

-- =========================================================
-- INDEXES FOR PERFORMANCE
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_analysis_user_id ON public.resume_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_interviews_user_id ON public.mock_interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);

-- =========================================================
-- TRIGGER TO AUTOMATICALLY CREATE PROFILE ON SIGNUP
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_interviews ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile" 
    ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Resumes Policies
CREATE POLICY "Users can view their own resumes" 
    ON public.resumes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resumes" 
    ON public.resumes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resumes" 
    ON public.resumes FOR DELETE USING (auth.uid() = user_id);

-- Resume Analysis Policies
CREATE POLICY "Users can view their own analysis" 
    ON public.resume_analysis FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analysis" 
    ON public.resume_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Jobs Policies
CREATE POLICY "Anyone authenticated can view jobs" 
    ON public.jobs FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create jobs" 
    ON public.jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Mock Interviews Policies
CREATE POLICY "Users can view their own interviews" 
    ON public.mock_interviews FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interviews" 
    ON public.mock_interviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- STORAGE BUCKET CONFIGURATION NOTES
-- =========================================================
-- Create a private bucket named "resumes" in Supabase Dashboard.
-- Add RLS Storage policies:
-- 1. SELECT: (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1])
-- 2. INSERT: (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1])
-- 3. DELETE: (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1])
