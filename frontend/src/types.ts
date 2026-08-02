export interface ResumeBullet {
  id: string;
  text: string;
}
export interface WorkExperience {
  id: string;
  employer: string;
  title: string;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  bullets: ResumeBullet[];
}
export interface ContactInfo {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  links: string[];
}
export interface SkillGroup {
  label?: string | null;
  items: string[];
}
export interface Education {
  institution: string;
  credential: string;
  field_of_study?: string | null;
  location?: string | null;
  dates?: string | null;
  details: string[];
}
export interface Project {
  id: string;
  name: string;
  role?: string | null;
  dates?: string | null;
  link?: string | null;
  bullets: ResumeBullet[];
}
export interface AdditionalSection {
  title: string;
  items: string[];
}
export interface ResumeDocument {
  contact: ContactInfo;
  professional_summary?: string | null;
  work_experience: WorkExperience[];
  skills: SkillGroup[];
  education: Education[];
  certifications: string[];
  projects: Project[];
  additional_sections: AdditionalSection[];
}
export interface RuntimeConfig {
  max_upload_bytes: number;
  accepted_extensions: string[];
  vision_fallback_available: boolean;
  gemini_model: string;
}
export interface GapAnalysis {
  match_score: number;
  keyword_gaps: { term: string; category: string; importance: string }[];
  title_alignment: {
    target_title: string;
    assessment: string;
    rationale: string;
    equivalent_title_suggestions: string[];
  };
  actionable_recommendations: string[];
}
export interface BulletRewriteResponse {
  items: {
    bullet_id: string;
    original_text: string;
    alternatives: { text: string; incorporated_keywords: string[] }[];
  }[];
}
export interface ApiErrorPayload {
  code?: string;
  message?: string;
  retryable?: boolean;
}

export type Step = 1 | 2 | 3 | 4;

export interface NormalizedError {
  code: string;
  message: string;
  retryable: boolean;
  requestId?: string;
}

export interface WorkflowState {
  step: Step;
  config: RuntimeConfig | null;
  resume: ResumeDocument | null;
  originalResume: ResumeDocument | null;
  jobDescription: string;
  warnings: string[];
  analysis: GapAnalysis | null;
  analysisStale: boolean;
  selectedBulletIds: string[];
  rewrites: BulletRewriteResponse | null;
  choices: Record<string, string>;
  docxBlob: Blob | null;
  error: NormalizedError | null;
  activeRequest: string | null;
}
