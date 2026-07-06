import { useState } from 'react';
import { Sliders, Play, Brain, AlertCircle, CheckCircle2, X, Plus } from 'lucide-react';
import { runSimulator } from '@/lib/api';
import { Card, PageHeader, Spinner, Badge } from '@/components/ui';
import { cn, scoreBadgeClass, formatScore } from '@/lib/utils';

const REMOTE_OPTIONS = ['any', 'remote', 'hybrid', 'onsite'];

export default function SimulatorPage() {
  const [params, setParams] = useState({
    job_description: '',
    salary_range: '',
    min_experience: 0,
    max_experience: 15,
    location_preference: '',
    remote_policy: 'any',
    required_skills: [] as string[],
    hiring_target: 5,
    budget_constraint: '',
    team_size: '',
    top_k: 20,
  });
  const [skillInput, setSkillInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !params.required_skills.includes(s)) {
      setParams(p => ({ ...p, required_skills: [...p.required_skills, s] }));
    }
    setSkillInput('');
  };

  const removeSkill = (s: string) =>
    setParams(p => ({ ...p, required_skills: p.required_skills.filter(x => x !== s) }));

  const handleRun = async () => {
    if (!params.job_description.trim()) { setError('Job description is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await runSimulator(params);
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const feasibilityColor = (label: string) =>
    label === 'Highly Feasible' ? 'badge-green'
    : label === 'Feasible'      ? 'badge-blue'
    : label === 'Challenging'   ? 'badge-amber'
    : 'badge-red';

  return (
    <div>
      <PageHeader
        title="Hiring Strategy Simulator"
        subtitle="Adjust parameters and let AI recompute hiring recommendations in real-time"
      />

      <div className="grid grid-cols-5 gap-6">
        {/* ── Left Panel: Controls ─────────────────────────────────────────── */}
        <div className="col-span-2 space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-brand-500" />
              <p className="font-semibold text-slate-800 dark:text-white">Simulation Parameters</p>
            </div>

            {/* Job Description */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Job Description *
              </label>
              <textarea
                value={params.job_description}
                onChange={e => setParams(p => ({ ...p, job_description: e.target.value }))}
                placeholder="Paste a job description…"
                rows={5}
                className="input-field resize-none text-xs font-mono"
              />
            </div>

            {/* Experience range */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Experience Range (years)
              </label>
              <div className="flex gap-2 items-center">
                <input type="number" min={0} max={params.max_experience}
                  value={params.min_experience}
                  onChange={e => setParams(p => ({ ...p, min_experience: +e.target.value }))}
                  className="input-field w-20 text-center"
                />
                <span className="text-slate-400 text-sm">to</span>
                <input type="number" min={params.min_experience} max={50}
                  value={params.max_experience}
                  onChange={e => setParams(p => ({ ...p, max_experience: +e.target.value }))}
                  className="input-field w-20 text-center"
                />
              </div>
            </div>

            {/* Remote policy */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Remote Policy
              </label>
              <div className="flex gap-2 flex-wrap">
                {REMOTE_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setParams(p => ({ ...p, remote_policy: opt }))}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                      params.remote_policy === opt
                        ? 'gradient-bg text-white shadow'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Salary + Location */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Salary Range</label>
                <input type="text" value={params.salary_range}
                  onChange={e => setParams(p => ({ ...p, salary_range: e.target.value }))}
                  placeholder="e.g. $80K–$120K"
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Location</label>
                <input type="text" value={params.location_preference}
                  onChange={e => setParams(p => ({ ...p, location_preference: e.target.value }))}
                  placeholder="e.g. Bangalore"
                  className="input-field text-xs"
                />
              </div>
            </div>

            {/* Hiring target + Team size */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Hiring Target</label>
                <input type="number" min={1} max={50} value={params.hiring_target}
                  onChange={e => setParams(p => ({ ...p, hiring_target: +e.target.value }))}
                  className="input-field text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Results (Top-K)</label>
                <input type="number" min={5} max={100} value={params.top_k}
                  onChange={e => setParams(p => ({ ...p, top_k: +e.target.value }))}
                  className="input-field text-center"
                />
              </div>
            </div>

            {/* Required skills */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Required Skills (bonus matching)
              </label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSkill()}
                  placeholder="Add skill…"
                  className="input-field flex-1 text-xs"
                />
                <button onClick={addSkill} className="btn-secondary px-3">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {params.required_skills.map(s => (
                  <span key={s} className="badge badge-purple flex items-center gap-1">
                    {s}
                    <button onClick={() => removeSkill(s)} className="hover:text-red-400 transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-500 mb-3 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleRun}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading
                ? <><Spinner size={14} /> Simulating…</>
                : <><Play className="w-4 h-4" /> Run Simulation</>}
            </button>
          </Card>
        </div>

        {/* ── Right Panel: Results ─────────────────────────────────────────── */}
        <div className="col-span-3 space-y-4">
          {!result && !loading && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <Sliders className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">Configure & Run Simulation</p>
              <p className="text-sm text-slate-400 mt-1">Adjust parameters on the left, then click Run Simulation</p>
            </div>
          )}

          {loading && <div className="flex justify-center py-32"><Spinner size={36} /></div>}

          {result && !loading && (
            <>
              {/* Feasibility banner */}
              <Card className={cn('border',
                result.feasibility_label === 'Highly Feasible' ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                : result.feasibility_label === 'Not Feasible' ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                : 'border-brand-300 dark:border-brand-800'
              )}>
                <div className="flex items-center gap-4">
                  {result.feasibility_score >= 0.5
                    ? <CheckCircle2 className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                    : <AlertCircle className="w-8 h-8 text-amber-500 flex-shrink-0" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {result.feasibility_label}
                      </p>
                      <Badge className={feasibilityColor(result.feasibility_label)}>
                        {Math.round(result.feasibility_score * 100)}% feasible
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Found <strong>{result.filtered_candidates?.length}</strong> candidates from a pool of{' '}
                      <strong>{result.total_matching_pool?.toLocaleString()}</strong> matching your filters.
                      Target: <strong>{params.hiring_target}</strong> hires.
                    </p>
                  </div>
                </div>
              </Card>

              {/* AI Strategy */}
              {result.strategy && Object.keys(result.strategy).length > 0 && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="w-4 h-4 text-brand-500" />
                    <p className="font-semibold text-slate-800 dark:text-white">AI Hiring Strategy</p>
                    {result.strategy.ai_generated && <Badge className="badge-purple text-[10px]">Gemini</Badge>}
                  </div>
                  <div className="space-y-3">
                    {result.strategy.recommendation && (
                      <div className="p-3 rounded-xl bg-brand-50/80 dark:bg-brand-900/20 border border-brand-200/50 dark:border-brand-800/30">
                        <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase mb-1">Recommendation</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{result.strategy.recommendation}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {result.strategy.top_suggestion && (
                        <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20">
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Top Suggestion</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{result.strategy.top_suggestion}</p>
                        </div>
                      )}
                      {result.strategy.timeline_estimate && (
                        <div className="p-3 rounded-xl bg-violet-50/80 dark:bg-violet-900/20">
                          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 mb-1">Timeline</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{result.strategy.timeline_estimate}</p>
                        </div>
                      )}
                    </div>
                    {result.strategy.risks && result.strategy.risks.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-900/20">
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Risks</p>
                        {result.strategy.risks.map((r: string, i: number) => (
                          <p key={i} className="text-xs text-slate-600 dark:text-slate-300">• {r}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Candidate results table */}
              <Card>
                <p className="font-semibold text-slate-800 dark:text-white mb-4">
                  Simulated Rankings ({result.filtered_candidates?.length} candidates)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/60">
                        {['#', 'Candidate', 'Role', 'Exp', 'Score', 'Top Skills', 'Mode'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(result.filtered_candidates || []).map((c: any) => (
                        <tr key={c.candidate_id}
                          className="border-t border-slate-100 dark:border-slate-800 hover:bg-brand-50/20 dark:hover:bg-brand-900/10 transition-colors">
                          <td className="px-3 py-2.5">
                            <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                              c.rank <= 3 ? 'gradient-bg text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            )}>
                              {c.rank}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                            <p className="text-slate-400 truncate max-w-[140px]">{c.company}</p>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{c.title || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500">
                            {c.years_of_experience != null ? `${c.years_of_experience.toFixed(1)}y` : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge className={scoreBadgeClass(c.score)}>{formatScore(c.score)}</Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {c.skills?.slice(0, 3).map((s: string, i: number) => (
                                <span key={i} className="badge badge-purple text-[9px]">{s}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {c.work_mode && <Badge className="badge-blue text-[10px]">{c.work_mode}</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
