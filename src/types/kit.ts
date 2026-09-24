export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";
export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";

export interface Requirement {
  id: string; // e.g. "r1", "r2"
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

export interface Question {
  id: string; // e.g. "q1", "q2"
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  // Extended Builder Metadata (Preserved across regeneration)
  origin?: "generated" | "edited" | "manual";
  pinned?: boolean;
}

export interface Flashcard {
  id: string; // e.g. "f1", "f2"
  front: string;
  back: string;
  requirement_ids: string[];
  origin?: "generated" | "edited" | "manual";
  pinned?: boolean;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number; // Integer minutes
}

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface Coverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface SourceInfo {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string; // ISO 8601 string
  pages_used: string[];
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
  hiring_process_notes?: string;
}

export interface RoleInfo {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

// Exact Appendix A Kit Structure
export interface PrepKit {
  source: SourceInfo;
  company_brief: CompanyBrief;
  role: RoleInfo;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: Coverage;
}

// Batch Case Input (Appendix B)
export interface BatchCaseInput {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

// Batch Case Output Item (Appendix B)
export interface BatchCaseResult {
  id: string;
  status: "ok" | "failed";
  kit: PrepKit | null;
  error: {
    code: string;
    message: string;
  } | null;
}

// Batch File Output (Appendix B)
export interface BatchOutput {
  version: "1.0";
  generated_at: string;
  kits: BatchCaseResult[];
}

// User model for auth
export interface UserRecord {
  id: string;
  email: string;
  name?: string;
  passwordHash: string;
  createdAt: string;
}

// Progress Event for Live Streaming
export interface PipelineProgressEvent {
  step:
    | "init"
    | "extract_jd"
    | "crawl_company"
    | "gather_intel"
    | "generate_questions"
    | "generate_flashcards"
    | "check_coverage"
    | "gap_resolution"
    | "build_schedule"
    | "completed"
    | "failed";
  message: string;
  percentage: number;
  data?: any;
}
