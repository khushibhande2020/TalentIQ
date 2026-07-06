import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Brain, Zap, Users, Briefcase, TrendingUp, AlertCircle,
  CheckCircle2, Info, RefreshCw, Cpu, Database, Upload, Star,
} from 'lucide-react';
import { getCommandCenter } from '@/lib/api';
import { Card, PageHeader, Spinner, Badge } from '@/components/ui';
import { cn } from "@/lib/utils";

const ALERT_STYLES: Record<string, string> = {
  critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
  warning:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
  info:     'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
};
const ALERT_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertCircle className="w-4 h-4 flex-shrink-0" />,
  warning:  <AlertCircle className="w-4 h-4 flex-shrink-0" />,
  info:     <Info className="w-4 h-4 flex-shrink-0" />,
};

function HealthGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#6366f1' : score >= 40 ? '#f59e0b' : '#ef4444';
  const dash = (score / 100) * 283;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${283 - dash}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{score}</span>
          <span className="text-xs text-slate-500">/100</span>
        </div>
      </div>
      <p className="mt-2 font-bold text-slate-900 dark:text-white">{label}</p>
      <p className="text-xs text-slate-500">Hiring Health Score</p>
    </div>
  );
}

export default function CommandCenterPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await getCommandCenter()); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-32"><Spinner size={36} /></div>;

  const kpis = data?.kpis || {};
  const health = data?.health_score || { score: 0, label: 'N/A', breakdown: {} };
  const alerts = data?.alerts || [];
  const briefing = data?.ai_briefing || {};
  const recs = data?.recommendations || [];
  const funnel = data?.hiring_funnel || [];
  const topMatches = data?.top_matches || [];
  const recentJobs = data?.recent_jobs || [];
  const gpu = data?.gpu || {};
  const bq = data?.bigquery || {};

  const sentimentColor = briefing.sentiment === 'positive' ? 'text-emerald-600 dark:text-emerald-400'
    : briefing.sentiment === 'concerning' ? 'text-red-500 dark:text-red-400'
    : 'text-slate-600 dark:text-slate-300';

  return (
    <div>
      <PageHeader
        title="AI Hiring Command Center"
        subtitle="AI-powered workforce decision intelligence — live platform overview"
        action={
          <div className="flex items-center gap-3">
            {data?._cached && <span className="text-xs text-slate-400">Cached · <button onClick={load} className="text-brand-500 hover:underline">Refresh</button></span>}
            <button onClick={load} className="btn-secondary flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Refresh</button>
          </div>
        }
      />

      {/* ── AI Briefing ─────────────────────────────────────────────────────── */}
      {briefing.headline && (
        <Card className="mb-6 border border-brand-200/30 dark:border-brand-800/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/30">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Daily AI Briefing</p>
                {briefing.ai_generated && <Badge className="badge-purple text-[10px]">Gemini</Badge>}
              </div>
              <p className={cn('font-bold text-lg mb-1', sentimentColor)}>{briefing.headline}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{briefing.summary}</p>
              {briefing.priority_action && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200/50 dark:border-brand-800/30">
                  <Zap className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">{briefing.priority_action}</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── KPI Grid ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Candidates', value: (kpis.total_candidates ?? 0).toLocaleString(), icon: <Users className="w-5 h-5" />, color: 'brand' },
          { label: 'Active Jobs', value: kpis.total_jobs ?? 0, icon: <Briefcase className="w-5 h-5" />, color: 'violet' },
          { label: 'Match Runs', value: (kpis.total_rankings ?? 0).toLocaleString(), icon: <Zap className="w-5 h-5" />, color: 'cyan' },
          { label: 'Avg Score', value: kpis.avg_match_score != null ? `${(kpis.avg_match_score * 100).toFixed(1)}%` : 'N/A', icon: <TrendingUp className="w-5 h-5" />, color: 'emerald' },
        ].map(({ label, value, icon, color }) => (
          <Card key={label}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400`}>
                {icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Row: Health + Funnel + Alerts ───────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Health gauge */}
        <Card className="flex flex-col items-center justify-center py-4">
          <HealthGauge score={health.score} label={health.label} />
          <div className="mt-4 w-full space-y-2">
            {Object.entries(health.breakdown || {}).map(([key, pts]) => (
              <div key={key}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className="font-semibold">{(pts as number).toFixed(0)} pts</span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full gradient-bg rounded-full" style={{ width: `${(pts as number)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Hiring funnel */}
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Hiring Funnel</p>
          {funnel.length > 0 ? (
            <div className="space-y-3">
              {funnel.map((s: any, i: number) => {
                const max = funnel[0]?.count || 1;
                const pct = Math.round((s.count / max) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{s.stage}</span>
                      <span className="font-bold">{(s.count).toLocaleString()}</span>
                    </div>
                    <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-slate-400 text-sm text-center py-8">No data yet</p>}
        </Card>

        {/* Alerts */}
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            Critical Alerts
            {alerts.length > 0 && <Badge className="badge-red">{alerts.length}</Badge>}
          </p>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All systems healthy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a: any, i: number) => (
                <div key={i} className={cn('flex items-start gap-2 p-2.5 rounded-xl border text-xs', ALERT_STYLES[a.level] || ALERT_STYLES.info)}>
                  {ALERT_ICONS[a.level] || ALERT_ICONS.info}
                  <div>
                    <p className="font-medium">{a.message}</p>
                    {a.action && <p className="opacity-70 mt-0.5">→ {a.action}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Row: Recommendations + Recent AI Decisions ───────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* AI Recommendations */}
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-brand-500" /> AI Recommendations
          </p>
          {recs.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No recommendations available</p>
          ) : (
            <div className="space-y-3">
              {recs.map((r: any, i: number) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                    r.priority === 'high' ? 'bg-red-500' : r.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                  )}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{r.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.detail}</p>
                    <Badge className={cn('mt-1.5 text-[10px]',
                      r.category === 'Data' ? 'badge-blue' : r.category === 'Strategy' ? 'badge-purple' : 'badge-green'
                    )}>
                      {r.category}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent AI Decisions */}
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" /> Recent AI Decisions
          </p>
          {topMatches.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Run a job match to see AI decisions</p>
          ) : (
            <div className="space-y-2">
              {topMatches.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="w-7 h-7 gradient-bg rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{m.name}</p>
                    <p className="text-xs text-slate-400 truncate">{m.title} · {m.job_id}</p>
                  </div>
                  <Badge className={m.score >= 0.7 ? 'badge-green' : m.score >= 0.4 ? 'badge-amber' : 'badge-red'}>
                    {(m.score * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Row: GPU + BigQuery + Quick Actions ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {/* GPU Widget */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-violet-500" />
            <p className="font-semibold text-slate-800 dark:text-white">Compute Engine</p>
            <Badge className={gpu.available ? 'badge-green' : 'badge-amber'}>
              {gpu.available ? 'GPU' : 'CPU'}
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Engine</span>
              <span className="font-mono text-xs">{gpu.engine}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Acceleration</span>
              <Badge className={gpu.acceleration ? 'badge-green' : 'badge-amber'}>
                {gpu.acceleration ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            {!gpu.available && (
              <p className="text-xs text-slate-400 mt-2">
                Set ENABLE_GPU_ACCELERATION=true with a CUDA GPU for faster analytics.
              </p>
            )}
          </div>
          <Link to="/gpu-benchmark" className="btn-secondary w-full mt-4 text-center text-xs">View Benchmarks</Link>
        </Card>

        {/* BigQuery Status */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-blue-500" />
            <p className="font-semibold text-slate-800 dark:text-white">Data Backend</p>
            <Badge className={bq.available ? 'badge-green' : 'badge-blue'}>
              {bq.available ? 'BigQuery' : 'SQLite'}
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <Badge className={bq.enabled ? 'badge-blue' : 'badge-amber'}>
                {bq.enabled ? (bq.available ? 'Connected' : 'Error') : 'Disabled'}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Fallback</span>
              <span className="text-xs text-slate-400">{bq.fallback || 'N/A'}</span>
            </div>
            {bq.project && bq.project !== 'not configured' && (
              <div className="flex justify-between">
                <span className="text-slate-500">Project</span>
                <span className="text-xs font-mono text-slate-400 truncate max-w-[120px]">{bq.project}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-500" /> Quick Actions
          </p>
          <div className="space-y-2">
            <Link to="/upload-job" className="btn-primary flex items-center justify-center gap-2 w-full text-sm">
              <Upload className="w-3.5 h-3.5" /> Upload Job Description
            </Link>
            <Link to="/workforce" className="btn-secondary flex items-center justify-center gap-2 w-full text-sm">
              <Brain className="w-3.5 h-3.5" /> Workforce Intelligence
            </Link>
            <Link to="/copilot" className="btn-secondary flex items-center justify-center gap-2 w-full text-sm">
              <Brain className="w-3.5 h-3.5" /> AI Copilot
            </Link>
            <Link to="/executive-report" className="btn-secondary flex items-center justify-center gap-2 w-full text-sm">
              <Star className="w-3.5 h-3.5" /> Executive Report
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
