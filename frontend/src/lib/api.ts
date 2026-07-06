import axios from 'axios';
import type { Candidate, CandidatePage, Job, MatchResponse, Analytics } from '@/types';

// Main API client — all /api/v1/* calls
const api = axios.create({ baseURL: '/api/v1' });

// Health API client — /health/* (no /api/v1 prefix, proxied separately)
const healthApi = axios.create({ baseURL: '' });

// ── Candidates ──────────────────────────────────────────────────────────────
export const getCandidates = (params: Record<string, any>): Promise<CandidatePage> =>
  api.get('/candidates', { params }).then(r => r.data);

export const getCandidate = (id: string): Promise<Candidate> =>
  api.get(`/candidates/${id}`).then(r => r.data);

// ── Jobs ────────────────────────────────────────────────────────────────────
export const getJobs = (): Promise<Job[]> =>
  api.get('/jobs').then(r => r.data);

export const getJob = (jobId: string): Promise<Job> =>
  api.get(`/jobs/${jobId}`).then(r => r.data);

export const uploadJob = (title: string, description: string): Promise<Job> =>
  api.post('/jobs', { title, description }).then(r => r.data);

// ── Match ───────────────────────────────────────────────────────────────────
export const runMatch = (job_id: string, top_k = 100): Promise<MatchResponse> =>
  api.post('/match', { job_id, top_k }).then(r => r.data);

export const getMatchResults = (job_id: string, top_k = 100): Promise<MatchResponse> =>
  api.get(`/match/${job_id}`, { params: { top_k } }).then(r => r.data);

// ── Analytics ───────────────────────────────────────────────────────────────
export const getAnalytics = (): Promise<Analytics> =>
  api.get('/analytics').then(r => r.data);

// ── Upload candidates ───────────────────────────────────────────────────────
export const uploadCandidates = (file: File): Promise<{ message: string; count: number }> => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/upload-candidates', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// ── Download ────────────────────────────────────────────────────────────────
export const downloadResults = (job_id: string): void => {
  window.open(`/api/v1/download-results/${job_id}`, '_blank');
};

// ── Evaluation ───────────────────────────────────────────────────────────────
export const getEvaluationReport = (): Promise<any> =>
  api.get('/evaluation/run').then(r => r.data);

export const triggerEvaluationRun = (): Promise<any> =>
  api.post('/evaluation/run').then(r => r.data);

export const getEvaluationStatus = (): Promise<any> =>
  api.get('/evaluation/status').then(r => r.data);

export const getEvaluationMethodology = (): Promise<any> =>
  api.get('/evaluation/methodology').then(r => r.data);

// ── Health (direct /health/* — proxied separately in vite) ───────────────────
export const getHealth = (): Promise<any> =>
  healthApi.get('/health').then(r => r.data).catch(() => ({ status: 'error' }));

export const getHealthServices = (): Promise<Record<string, any>> =>
  healthApi.get('/health/services').then(r => r.data).catch(() => ({}));

export const getHealthDatabase = (): Promise<any> =>
  healthApi.get('/health/database').then(r => r.data).catch(() => ({ status: 'error' }));

export const getHealthGemini = (): Promise<any> =>
  healthApi.get('/health/gemini').then(r => r.data).catch(() => ({ status: 'error' }));

export const getHealthGpu = (): Promise<any> =>
  healthApi.get('/health/gpu').then(r => r.data).catch(() => ({ status: 'error' }));

export const getHealthBigquery = (): Promise<any> =>
  healthApi.get('/health/bigquery').then(r => r.data).catch(() => ({ status: 'error' }));

export const getMetrics = (): Promise<any> =>
  healthApi.get('/health/metrics').then(r => r.data).catch(() => ({}));

// ── Command Center ────────────────────────────────────────────────────────────
export const getCommandCenter = (): Promise<any> =>
  api.get('/command-center').then(r => r.data);

// ── Workforce Intelligence ────────────────────────────────────────────────────
export const getWorkforceIntelligence = (): Promise<any> =>
  api.get('/workforce').then(r => r.data);

// ── Hiring Strategy Simulator ─────────────────────────────────────────────────
export const runSimulator = (params: any): Promise<any> =>
  api.post('/simulator', params).then(r => r.data);

// ── Executive Report ──────────────────────────────────────────────────────────
export const getExecutiveReport = (period = 'weekly'): Promise<any> =>
  api.get('/executive-report', { params: { period } }).then(r => r.data);

export const downloadExecutiveReportPdf = (period = 'weekly'): void => {
  window.open(`/api/v1/executive-report/pdf?period=${period}`, '_blank');
};

// ── AI Copilot ────────────────────────────────────────────────────────────────
export const copilotChat = (message: string, session_id = 'default'): Promise<any> =>
  api.post('/copilot', { message, session_id }).then(r => r.data);

export const clearCopilotSession = (session_id = 'default'): Promise<any> =>
  api.delete(`/copilot/session/${session_id}`).then(r => r.data).catch(() => ({}));

// ── GPU Benchmark ─────────────────────────────────────────────────────────────
export const getGpuBenchmark = (): Promise<any> =>
  api.get('/gpu-benchmark').then(r => r.data);

export default api;
