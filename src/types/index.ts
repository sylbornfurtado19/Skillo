export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ResumeRecord {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  created_at?: string;
}

export interface ResumeAnalysis {
  id: string;
  user_id: string;
  resume_id?: string;
  job_title?: string;
  job_description?: string;
  match_percentage?: number;
  skills_matched?: string[];
  skills_missing?: string[];
  summary?: string;
  score_breakdown?: Record<string, number>;
  recommendations?: string[];
  created_at?: string;
}

export interface MockInterview {
  id: string;
  user_id: string;
  domain: string;
  role: string;
  experience_level?: string;
  interview_type?: string;
  persona?: string;
  overall_score?: number;
  categories?: Record<string, number>;
  breakdown?: Array<any>;
  interviewer_comments?: string;
  created_at?: string;
}

export interface JobRecord {
  id: string;
  user_id?: string;
  title: string;
  domain: string;
  description?: string;
  requirements?: string[];
  created_at?: string;
}

export interface ServiceResponse<T> {
  data: T | null;
  error: any | null;
}
