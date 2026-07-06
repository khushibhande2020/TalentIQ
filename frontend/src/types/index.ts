export interface Skill {
  name: string;
  proficiency: 'beginner' | 'intermediate' | 'advanced';
  endorsements: number;
  duration_months: number;
}

export interface CareerEntry {
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  duration_months: number;
  is_current: boolean;
  industry: string;
  company_size: string;
  description: string;
}

export interface Education {
  institution: string;
  degree: string;
  field_of_study: string;
  start_year: number;
  end_year: number;
  grade: string;
  tier: string;
}

export interface RedrobSignals {
  profile_completeness_score: number;
  open_to_work_flag: boolean;
  preferred_work_mode: string;
  willing_to_relocate: boolean;
  notice_period_days: number;
  expected_salary_range_inr_lpa: { min: number; max: number };
  github_activity_score: number;
  interview_completion_rate: number;
  offer_acceptance_rate: number;
  connection_count: number;
}

export interface Candidate {
  id: number;
  candidate_id: string;
  anonymized_name: string | null;
  headline: string | null;
  summary: string | null;
  location: string | null;
  country: string | null;
  years_of_experience: number | null;
  current_title: string | null;
  current_company: string | null;
  current_company_size: string | null;
  current_industry: string | null;
  career_history: CareerEntry[] | null;
  education: Education[] | null;
  skills: Skill[] | null;
  certifications: any[] | null;
  languages: any[] | null;
  redrob_signals: RedrobSignals | null;
  created_at: string | null;
}

export interface CandidatePage {
  total: number;
  page: number;
  page_size: number;
  items: Candidate[];
}

export interface Job {
  id: number;
  job_id: string;
  title: string | null;
  description: string;
  entities: { text: string; label: string }[] | null;
  status: 'pending' | 'matched';
  created_at: string | null;
}

export interface RankedCandidate {
  rank: number;
  candidate_id: string;
  anonymized_name: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  years_of_experience: number | null;
  skills: Skill[] | null;
  similarity_score: number;
  tfidf_score: number;
  semantic_score: number;
}

export interface MatchResponse {
  job_id: string;
  job_title: string | null;
  total_candidates: number;
  ranked: RankedCandidate[];
}

export interface Analytics {
  total_candidates: number;
  total_jobs: number;
  total_rankings: number;
  avg_similarity_score: number | null;
  top_skills: { skill: string; count: number }[];
  experience_distribution: { range: string; count: number }[];
  industry_distribution: { industry: string; count: number }[];
  location_distribution: { location: string; count: number }[];
  score_distribution: { range: string; count: number }[];
}

// ── Evaluation types ──────────────────────────────────────────────────────────

export interface IRMetrics {
  num_queries_evaluated: number;
  mrr: number;
  map: number;
  'precision@5': number;
  'precision@10': number;
  'recall@5': number;
  'recall@10': number;
  'ndcg@5': number;
  'ndcg@10': number;
  'hit_rate@5': number;
  'hit_rate@10': number;
}

export interface PerQueryResult {
  query_id: string;
  query_title: string;
  n_relevant: number;
  n_retrieved: number;
  tfidf_ms: number;
  semantic_ms: number;
  rr: number;
  ap: number;
  'p@5': number;
  'p@10': number;
  'r@5': number;
  'r@10': number;
  'ndcg@5': number;
  'ndcg@10': number;
  'hr@5': number;
  'hr@10': number;
}

export interface ParsingQuality {
  field_coverage_pct: number;
  skill_extraction_rate: number;
  avg_skills_per_resume: number;
  sample_size: number;
  methodology: string;
}

export interface GpuBenchmark {
  cpu_pandas_ms: number;
  gpu_cudf_ms: number | null;
  gpu_available: boolean;
  speedup_ratio: number | null;
  benchmark_size: number;
  note: string;
}

export interface GeminiStats {
  total_agent_calls: number;
  total_agent_errors: number;
  success_rate_pct: number | null;
  avg_response_ms: number | null;
  enabled: boolean;
  model: string;
  note: string | null;
}

export interface SystemPerf {
  avg_tfidf_ms: number | null;
  avg_semantic_ms: number | null;
  avg_e2e_query_ms: number | null;
  system: Record<string, any>;
}

export interface EvaluationReport {
  status: string;
  evaluated_at: string;
  candidate_pool_size: number;
  eval_candidate_sample: number;
  total_eval_time_ms: number;
  ir_metrics: IRMetrics;
  per_query_results: PerQueryResult[];
  parsing_quality: ParsingQuality;
  performance: SystemPerf;
  gemini: GeminiStats;
  gpu_benchmark: GpuBenchmark;
  methodology: Record<string, any>;
  _cached?: boolean;
  error?: string;
}

export interface EvaluationStatus {
  status: 'never_run' | 'running' | 'ready' | 'error';
  last_run?: string;
  total_eval_time_ms?: number;
  num_queries?: number;
  error?: string;
  note?: string;
}
