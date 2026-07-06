import { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical, RefreshCw, Info, CheckCircle2, AlertCircle,
  Clock, Cpu, Zap, Brain, Target, TrendingUp, BookOpen,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid, LineChart, Line, Legend,
} from 'recharts';
import {
  getEvaluationReport, triggerEvaluationRun, getEvaluationStatus,
} from '@/lib/api';
import type { EvaluationReport, EvaluationStatus, PerQueryResult } from '@/types';
import { Card, PageHeader, Spinner, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  brand: '#6366f1', violet: '#8b5cf6', cyan: '#06b6d4',
  emerald: '#10b981', amber: '#f59e0b', red: '#ef4444',
  slate: '#94a3b8',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl border border-white/10">
      <p className="font-semibold text-slate-900 dark:text-white mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricKpi({
  label, value, sub, color = 'brand', icon, tooltip,
}: {
  label: string; value: string | number; sub?: string;
  color?: string; icon: React.ReactNode; tooltip?: string;
}) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
            {label}
            {tooltip && (
              <span title={tooltip} className="cursor-help text-slate-400">
                <Info className="w-3 h-3" />
              </span>
            )}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white truncate">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ml-3', colorMap[color])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function ScoreGauge({ value, label, max = 1 }: { value: number; label: string; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 70 ? C.emerald : pct >= 45 ? C.amber : C.red;
  return (
    <div className="text-center">
      <div className="relative w-16 h-16 mx-auto mb-2">
        <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {(value * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
    </div>
  );
}

function SectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 gradient-bg rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/30">
        {icon}
      </div>
      <div>
        <p className="font-bold text-slate-900 dark:text-white text-sm">{title}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

function PerQueryTable({ queries }: { queries: PerQueryResult[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? queries : queries.slice(0, 5);
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-200/50 dark:border-white/5">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/60">
              {['Query', 'P@5', 'P@10', 'R@5', 'R@10', 'NDCG@5', 'NDCG@10', 'RR', 'AP', 'TF-IDF ms', 'Sem ms'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((q, i) => (
              <tr key={q.query_id} className={cn(
                'border-t border-slate-100 dark:border-slate-800 transition-colors hover:bg-brand-50/20 dark:hover:bg-brand-900/10',
              )}>
                <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white whitespace-nowrap max-w-[160px] truncate" title={q.query_title}>
                  <span className="text-slate-400 mr-1">{q.query_id}</span>{q.query_title}
                </td>
                {[
                  q['p@5'], q['p@10'], q['r@5'], q['r@10'],
                  q['ndcg@5'], q['ndcg@10'], q.rr, q.ap,
                ].map((v, vi) => {
                  const pct = v * 100;
                  const cls = pct >= 70 ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : pct >= 40 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-500 dark:text-red-400';
                  return (
                    <td key={vi} className={cn('px-3 py-2.5', cls)}>
                      {v.toFixed(3)}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-slate-500">{q.tfidf_ms}</td>
                <td className="px-3 py-2.5 text-slate-500">{q.semantic_ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {queries.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-brand-500 hover:text-brand-400 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show all {queries.length} queries</>}
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EvaluationPage() {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [status, setStatus] = useState<EvaluationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      const data = await getEvaluationReport();
      if (data.status === 'insufficient_data' || data.error) {
        setError(data.detail || data.error || 'Insufficient data');
      } else {
        setReport(data);
        setError('');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to load';
      // 503 means feature disabled
      if (e?.response?.status === 503) {
        setError('Evaluation framework is disabled. Add ENABLE_EVALUATION=true to backend/.env and restart.');
      } else {
        setError(msg);
      }
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadReport(), getEvaluationStatus().then(setStatus).catch(() => {})])
      .finally(() => setLoading(false));
  }, [loadReport]);

  // Poll status while running
  useEffect(() => {
    if (status?.status !== 'running') return;
    const interval = setInterval(async () => {
      const s = await getEvaluationStatus().catch(() => null);
      if (s) setStatus(s);
      if (s?.status === 'ready') {
        clearInterval(interval);
        setRunning(false);
        await loadReport();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [status?.status, loadReport]);

  const handleRunEval = async () => {
    setRunning(true);
    setError('');
    try {
      await triggerEvaluationRun();
      setStatus({ status: 'running' });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Failed to start evaluation';
      setError(msg);
      setRunning(false);
    }
  };

  // ── Derived data for charts ────────────────────────────────────────────────
  const ir = report?.ir_metrics;

  const radarData = ir ? [
    { metric: 'P@5',     value: ir['precision@5']  * 100 },
    { metric: 'P@10',    value: ir['precision@10'] * 100 },
    { metric: 'R@5',     value: ir['recall@5']     * 100 },
    { metric: 'R@10',    value: ir['recall@10']    * 100 },
    { metric: 'NDCG@5',  value: ir['ndcg@5']       * 100 },
    { metric: 'NDCG@10', value: ir['ndcg@10']      * 100 },
    { metric: 'MRR',     value: ir.mrr             * 100 },
    { metric: 'MAP',     value: ir.map             * 100 },
  ] : [];

  const perQueryBarData = (report?.per_query_results ?? []).map(q => ({
    name: q.query_id.replace('VQ_', 'Q'),
    'NDCG@10': +(q['ndcg@10'] * 100).toFixed(1),
    'P@10': +(q['p@10'] * 100).toFixed(1),
    'R@10': +(q['r@10'] * 100).toFixed(1),
    title: q.query_title,
  }));

  const timingData = (report?.per_query_results ?? []).map(q => ({
    name: q.query_id.replace('VQ_', 'Q'),
    'TF-IDF (ms)': q.tfidf_ms,
    'Semantic (ms)': q.semantic_ms,
  }));

  return (
    <div>
      <PageHeader
        title="AI Evaluation Framework"
        subtitle="Measurable quality metrics — Precision, Recall, NDCG, MRR, Parsing Accuracy, System Performance"
        action={
          <div className="flex items-center gap-3">
            {report?._cached && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Cached
              </span>
            )}
            {status?.status === 'running' && (
              <span className="text-xs text-amber-500 flex items-center gap-1 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Evaluating…
              </span>
            )}
            <button
              onClick={handleRunEval}
              disabled={running || status?.status === 'running'}
              className="btn-primary flex items-center gap-2"
            >
              {running ? <><Spinner size={14} /> Starting…</> : <><RefreshCw className="w-4 h-4" /> Run Evaluation</>}
            </button>
          </div>
        }
      />

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl mb-6">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">Evaluation unavailable</p>
            <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-32"><Spinner size={36} /></div>}

      {/* Running state */}
      {!loading && status?.status === 'running' && !report && (
        <Card className="text-center py-16">
          <Loader2 className="w-12 h-12 text-brand-500 animate-spin mx-auto mb-4" />
          <p className="font-bold text-slate-900 dark:text-white text-lg">Evaluation in progress…</p>
          <p className="text-sm text-slate-500 mt-2">
            Running {10} validation queries against your candidate pool.
            This takes 30–120 seconds. The page will update automatically.
          </p>
        </Card>
      )}

      {/* No data yet */}
      {!loading && !report && !error && status?.status === 'never_run' && (
        <Card className="text-center py-16">
          <FlaskConical className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="font-bold text-slate-900 dark:text-white text-lg">No evaluation run yet</p>
          <p className="text-sm text-slate-500 mt-2 mb-6">
            Click "Run Evaluation" to measure the quality of your AI matching pipeline.
          </p>
          <button onClick={handleRunEval} disabled={running} className="btn-primary mx-auto flex items-center gap-2">
            <FlaskConical className="w-4 h-4" /> Start Evaluation
          </button>
        </Card>
      )}

      {report && !loading && (
        <div className="space-y-6">

          {/* ── Top KPI row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            <MetricKpi
              label="MRR" icon={<Target className="w-4 h-4" />}
              value={(ir?.mrr ?? 0).toFixed(3)}
              sub="Mean Reciprocal Rank" color="brand"
              tooltip="How high the first relevant candidate appears on average. Range [0,1]."
            />
            <MetricKpi
              label="NDCG@10" icon={<TrendingUp className="w-4 h-4" />}
              value={(ir?.['ndcg@10'] ?? 0).toFixed(3)}
              sub="Normalized DCG at 10" color="emerald"
              tooltip="Quality of ranking order — rewards relevant results higher. Range [0,1]."
            />
            <MetricKpi
              label="MAP" icon={<Zap className="w-4 h-4" />}
              value={(ir?.map ?? 0).toFixed(3)}
              sub="Mean Average Precision" color="violet"
              tooltip="Area under precision-recall curve across all queries."
            />
            <MetricKpi
              label="Field Coverage" icon={<CheckCircle2 className="w-4 h-4" />}
              value={`${report.parsing_quality?.field_coverage_pct ?? 0}%`}
              sub={`${report.parsing_quality?.sample_size} candidates`} color="cyan"
              tooltip="% of expected profile fields populated per candidate."
            />
          </div>

          {/* ── Second KPI row ───────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-4">
            <MetricKpi
              label="Precision@10" icon={<Target className="w-4 h-4" />}
              value={(ir?.['precision@10'] ?? 0).toFixed(3)}
              sub="Avg across 10 queries" color="brand"
              tooltip="Fraction of top-10 results that are truly relevant."
            />
            <MetricKpi
              label="Recall@10" icon={<TrendingUp className="w-4 h-4" />}
              value={(ir?.['recall@10'] ?? 0).toFixed(3)}
              sub="Avg across 10 queries" color="emerald"
              tooltip="Fraction of all relevant candidates found in top-10."
            />
            <MetricKpi
              label="Avg E2E Time" icon={<Clock className="w-4 h-4" />}
              value={report.performance?.avg_e2e_query_ms != null
                ? `${report.performance.avg_e2e_query_ms.toFixed(0)} ms`
                : 'N/A'}
              sub="TF-IDF + Semantic" color="amber"
              tooltip="End-to-end matching pipeline time per query."
            />
            <MetricKpi
              label="Skill Extract Rate" icon={<Brain className="w-4 h-4" />}
              value={`${report.parsing_quality?.skill_extraction_rate ?? 0}%`}
              sub={`Avg ${report.parsing_quality?.avg_skills_per_resume ?? 0} skills/resume`}
              color="violet"
              tooltip="% of candidates with at least one skill extracted."
            />
          </div>

          {/* ── Row 1: Radar + Precision-Recall-NDCG gauges ─────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="col-span-2">
              <SectionHeader
                icon={<FlaskConical className="w-4 h-4 text-white" />}
                title="IR Metrics Overview"
                sub="All metrics expressed as percentage — higher is better"
              />
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#374151" strokeOpacity={0.4} />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Radar
                      name="Score (%)"
                      dataKey="value"
                      stroke={C.brand}
                      fill={C.brand}
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v.toFixed(1)}%`, 'Score']}
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 12, fontSize: 11 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-sm py-10 text-center">No IR metrics yet</p>
              )}
            </Card>

            <Card>
              <SectionHeader
                icon={<Target className="w-4 h-4 text-white" />}
                title="Score Gauges"
                sub="K=5 vs K=10 cutoffs"
              />
              {ir ? (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <ScoreGauge value={ir['precision@5']}  label="P@5" />
                  <ScoreGauge value={ir['precision@10']} label="P@10" />
                  <ScoreGauge value={ir['recall@5']}     label="R@5" />
                  <ScoreGauge value={ir['recall@10']}    label="R@10" />
                  <ScoreGauge value={ir['ndcg@5']}       label="NDCG@5" />
                  <ScoreGauge value={ir['ndcg@10']}      label="NDCG@10" />
                </div>
              ) : (
                <p className="text-slate-400 text-sm py-10 text-center">No data</p>
              )}
            </Card>
          </div>

          {/* ── Row 2: Per-query NDCG/P/R bar chart ─────────────────────── */}
          <Card>
            <SectionHeader
              icon={<BarChart className="w-4 h-4 text-white" /> as any}
              title="Per-Query Performance at K=10"
              sub={`${perQueryBarData.length} validation queries — NDCG@10, Precision@10, Recall@10`}
            />
            {perQueryBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={perQueryBarData} barGap={2} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const q = perQueryBarData.find(d => d.name === label);
                      return (
                        <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl border border-white/10">
                          <p className="font-semibold text-slate-900 dark:text-white mb-1">{q?.title || label}</p>
                          {payload.map((p: any, i: number) => (
                            <p key={i} style={{ color: p.fill }}>{p.name}: <b>{p.value}%</b></p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="NDCG@10" fill={C.brand} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="P@10"    fill={C.emerald} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="R@10"    fill={C.violet} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-sm py-10 text-center">No per-query data available</p>
            )}
          </Card>

          {/* ── Row 3: Timing + GPU + Gemini ─────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            {/* Timing chart */}
            <Card className="col-span-2">
              <SectionHeader
                icon={<Clock className="w-4 h-4 text-white" />}
                title="Pipeline Timing per Query"
                sub="TF-IDF vectorization vs Semantic embedding time (ms)"
              />
              {timingData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={timingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} unit=" ms" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="TF-IDF (ms)" stroke={C.brand} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Semantic (ms)" stroke={C.violet} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-slate-400 text-sm py-10 text-center">No timing data</p>
              )}
            </Card>

            {/* GPU benchmark + Gemini */}
            <div className="space-y-4">
              <Card>
                <SectionHeader
                  icon={<Cpu className="w-4 h-4 text-white" />}
                  title="GPU Benchmark"
                  sub="10K-row DataFrame operations"
                />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">CPU (pandas)</span>
                    <span className="font-mono font-semibold">{report.gpu_benchmark?.cpu_pandas_ms ?? '—'} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">GPU (cuDF)</span>
                    <span className="font-mono font-semibold">
                      {report.gpu_benchmark?.gpu_available
                        ? `${report.gpu_benchmark.gpu_cudf_ms} ms`
                        : <span className="text-slate-400 text-xs">Not available</span>}
                    </span>
                  </div>
                  {report.gpu_benchmark?.speedup_ratio && (
                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2">
                      <span className="text-slate-500">Speedup</span>
                      <Badge className="badge-green">{report.gpu_benchmark.speedup_ratio}×</Badge>
                    </div>
                  )}
                  {!report.gpu_benchmark?.gpu_available && (
                    <p className="text-xs text-slate-400 mt-1">
                      Set ENABLE_GPU_ACCELERATION=true with a CUDA GPU for GPU acceleration.
                    </p>
                  )}
                </div>
              </Card>

              <Card>
                <SectionHeader
                  icon={<Brain className="w-4 h-4 text-white" />}
                  title="Gemini Stats"
                  sub="From in-process metrics"
                />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status</span>
                    <Badge className={report.gemini?.enabled ? 'badge-green' : 'badge-amber'}>
                      {report.gemini?.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Success Rate</span>
                    <span className="font-semibold">
                      {report.gemini?.success_rate_pct != null
                        ? `${report.gemini.success_rate_pct}%`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg Response</span>
                    <span className="font-mono text-xs">
                      {report.gemini?.avg_response_ms != null
                        ? `${report.gemini.avg_response_ms} ms`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Model</span>
                    <span className="text-xs text-slate-400">{report.gemini?.model}</span>
                  </div>
                  {report.gemini?.note && (
                    <p className="text-xs text-slate-400 italic">{report.gemini.note}</p>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* ── Row 4: Per-query detail table ─────────────────────────────── */}
          <Card>
            <SectionHeader
              icon={<FlaskConical className="w-4 h-4 text-white" />}
              title="Per-Query Detailed Results"
              sub="All validation queries — click column headers to understand metrics"
            />
            {report.per_query_results?.length > 0 ? (
              <PerQueryTable queries={report.per_query_results} />
            ) : (
              <p className="text-slate-400 text-sm py-6 text-center">No per-query results available</p>
            )}
          </Card>

          {/* ── Row 5: Parsing quality ────────────────────────────────────── */}
          <Card>
            <SectionHeader
              icon={<CheckCircle2 className="w-4 h-4 text-white" />}
              title="Resume Parsing Quality"
              sub="Field coverage across candidate pool sample"
            />
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Field Coverage</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">
                    {report.parsing_quality?.field_coverage_pct ?? 0}%
                  </span>
                  <span className="text-sm text-slate-400 mb-1">of 11 critical fields</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${report.parsing_quality?.field_coverage_pct ?? 0}%`,
                      background: `linear-gradient(90deg, ${C.brand}, ${C.violet})`,
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Skill Extraction Rate</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">
                    {report.parsing_quality?.skill_extraction_rate ?? 0}%
                  </span>
                  <span className="text-sm text-slate-400 mb-1">have skills</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${report.parsing_quality?.skill_extraction_rate ?? 0}%`,
                      background: `linear-gradient(90deg, ${C.emerald}, ${C.cyan})`,
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Avg Skills / Resume</p>
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {report.parsing_quality?.avg_skills_per_resume ?? 0}
                </span>
                <p className="text-sm text-slate-400 mt-1">
                  across {report.parsing_quality?.sample_size ?? 0} candidates
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4 italic">
              Methodology: {report.parsing_quality?.methodology}
            </p>
          </Card>

          {/* ── Methodology accordion ─────────────────────────────────────── */}
          <Card>
            <button
              onClick={() => setShowMethodology(!showMethodology)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 gradient-bg rounded-xl flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Evaluation Methodology</p>
                  <p className="text-xs text-slate-500">Proxy ground-truth approach — click to expand</p>
                </div>
              </div>
              {showMethodology ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showMethodology && (
              <div className="mt-5 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
                    <p className="font-semibold text-sm text-slate-800 dark:text-white mb-1">Relevance Formula</p>
                    <code className="text-xs text-brand-600 dark:text-brand-400 block">
                      score = 0.6 × skill_overlap + 0.2 × experience_fit + 0.2 × title_similarity
                    </code>
                    <p className="text-xs text-slate-500 mt-2">
                      Grades: ≥0.60 → 3 (highly relevant), ≥0.40 → 2 (relevant), ≥0.20 → 1 (partial), else 0
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
                    <p className="font-semibold text-sm text-slate-800 dark:text-white mb-1">Validation Queries</p>
                    <p className="text-xs text-slate-500">
                      10 diverse synthetic job descriptions covering: Python Backend, ML Engineering,
                      React Frontend, Data Engineering, DevOps, Full Stack, Data Science,
                      Mobile Dev, Cloud Architecture, Product Management.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30">
                  <p className="font-semibold text-sm text-amber-700 dark:text-amber-400 mb-1">⚠️ Limitations & Transparency</p>
                  <ul className="text-xs text-amber-600 dark:text-amber-300 space-y-0.5">
                    <li>• Proxy labels are approximations — skill synonyms (e.g. "ML" ≈ "Machine Learning") may be missed</li>
                    <li>• Metrics should be interpreted relatively vs baseline, not as absolute quality scores</li>
                    <li>• Ground truth improves significantly once real recruiter feedback is collected</li>
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">References</p>
                  <ul className="text-xs text-slate-500 space-y-0.5">
                    <li>• Manning, Raghavan & Schütze (2008) — <em>Introduction to Information Retrieval</em></li>
                    <li>• Järvelin & Kekäläinen (2002) — Cumulated gain-based evaluation of IR techniques (nDCG)</li>
                    <li>• Voorhees (2000) — The TREC-8 Question Answering Track Report (MRR)</li>
                  </ul>
                </div>
              </div>
            )}
          </Card>

          {/* Run metadata */}
          <div className="flex items-center gap-4 text-xs text-slate-400 pb-2">
            <span>Evaluated: {report.evaluated_at ? new Date(report.evaluated_at).toLocaleString() : '—'}</span>
            <span>•</span>
            <span>Sample: {report.eval_candidate_sample?.toLocaleString()} candidates</span>
            <span>•</span>
            <span>Pool: {report.candidate_pool_size?.toLocaleString()} total</span>
            <span>•</span>
            <span>Eval time: {report.total_eval_time_ms ? `${(report.total_eval_time_ms / 1000).toFixed(1)}s` : '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
