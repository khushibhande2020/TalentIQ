import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Briefcase, Zap, TrendingUp, AlertTriangle,
  CheckCircle, Info, Upload, BarChart3, MessageSquare,
  Cpu, RefreshCw, Brain, Target, Globe,
} from 'lucide-react';
import { getCommandCenter } from '@/lib/api';
import { Card, Spinner, Badge } from '@/components/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

const PRIORITY_COLOR: Record<string, string> = {
  high: 'badge-red', medium: 'badge-amber', low: 'badge-blue',
};
const ALERT_ICON: Record<string, any> = {
  critical: AlertTriangle, warning: AlertTriangle, info: Info,
};
const ALERT_CLASS: Record<string, string> = {
  critical: 'border-red-300 dark:border-red-800 bg-red-50/80 dark:bg-red-900/20',
  warning: 'border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20',
  info: 'border-blue-300 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-900/20',
};

function KpiCard({ label, value, sub, icon, color = 'brand' }: any) {
  const colorMap: Record<string, string> = {
    brand:   'bg-brand-100/80 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300',
    emerald: 'bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300',
    violet:  'bg-violet-100/80 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300',
    amber:   'bg-amber-100/80 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300',
    cyan:    'bg-cyan-100/80 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-300',
    rose:    'bg-rose-100/80 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300',
  };
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white truncate">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400 truncate">{sub}</p>}
        </div>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ml-3', colorMap[color])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function HealthGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#6366f1' : score >= 40 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="10" className="dark:stroke-slate-700" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-slate-900 dark:text-white">{score}</span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
      </div>
      <p className="mt-2 font-bold text-slate-800 dark:text-white">{label}</p>
      <p className="text-xs text-slate-500">Platform Health Score</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-900 dark:text-white mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.color }}>{p.name}: <b>{p.value?.toLocaleString()}</b></p>
      ))}
    </div>
  );
};

export default function CommandCenterPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try { setData(await getCommandCenter()); } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-32"><Spinner size={36} /></div>;

  const kpis = data?.kpis || {};
  const health = data?.health_score || { score: 0, label: 'Unknown', breakdown: {} };
  const alerts = data?.alerts || [];
  const briefing = data?.ai_briefing || {};
  const recommendations = data?.recommendations || [];
  const funnel = data?.hiring_funnel || [];
  const topMatches = data?.top_matches || [];
  const recentJobs = data?.recent_jobs || [];
  const gpu = data?.gpu || {};

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            AI Hiring <span className="gradient-text">Command Center</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {briefing.headline || 'Workforce Decision Intelligence Platform'}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* AI Briefing banner */}
      {briefing.summary && (
        <div className={cn(
          'glass rounded-2xl p-4 mb-6 border flex items-start gap-4',
          briefing.sentiment === 'positive' ? 'border-emerald-300/50 dark:border-emerald-700/30' :
          briefing.sentiment === 'concerning' ? 'border-amber-300/50 dark:border-amber-700/30' :
          'border-brand-300/50 dark:border-brand-700/30'
        )}>
          <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Daily AI Briefing</p>
              {briefing.ai_generated && <Badge className="badge-purple text-[10px]">Gemini</Badge>}
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200">{briefing.summary}</p>
            {briefing.priority_action && (
              <p className="text-xs text-brand-600 dark:text-brand-400 mt-1 font-medium">
                Priority: {briefing.priority_action}
              </p>
            )}
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Candidate Pool" value={kpis.total_candidates?.toLocaleString() ?? '0'}
          icon={<Users className="w-4 h-4" />} color="brand" />
        <KpiCard label="Active Jobs" value={kpis.total_jobs ?? 0}
          sub={`${kpis.matched_jobs ?? 0} matched`}
          icon={<Briefcase className="w-4 h-4" />} color="violet" />
        <KpiCard label="Avg Match Score"
          value={kpis.avg_match_score ? `${(kpis.avg_match_score * 100).toFixed(1)}%` : 'N/A'}
          sub={`${kpis.qualified_pct ?? 0}% qualified`}
          icon={<Target className="w-4 h-4" />} color="emerald" />
        <KpiCard label="Match Runs" value={kpis.total_rankings?.toLocaleString() ?? '0'}
          icon={<Zap className="w-4 h-4" />} color="cyan" />
      </div>

      {/* Row 2: Health + Funnel + Alerts */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Health score */}
        <Card className="flex flex-col items-center justify-center py-4">
          <HealthGauge score={health.score} label={health.label} />
          <div className="mt-4 w-full space-y-2 px-2">
            {Object.entries(health.breakdown || {}).map(([key, pts]: any) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-semibold text-slate-800 dark:text-white">{pts.toFixed(0)} pts</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Hiring Funnel */}
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-4">Hiring Funnel</p>
          {funnel.length > 0 ? (
            <div className="space-y-2">
              {funnel.map((stage: any, i: number) => {
                const max = funnel[0]?.count || 1;
                const pct = (stage.count / max) * 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-600 dark:text-slate-300">{stage.stage}</span>
                      <span className="font-semibold">{stage.count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: stage.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">Run a match to see the funnel</p>
          )}
        </Card>

        {/* Alerts */}
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-4">
            Alerts & Notices <span className="ml-1 badge badge-red">{alerts.length}</span>
          </p>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 py-4">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">All systems healthy</span>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert: any, i: number) => {
                const Icon = ALERT_ICON[alert.level] || Info;
                return (
                  <div key={i} className={cn('p-2.5 rounded-xl border text-xs', ALERT_CLASS[alert.level])}>
                    <div className="flex items-start gap-2">
                      <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-slate-700 dark:text-slate-300">{alert.message}</p>
                        {alert.action && (
                          <p className="mt-0.5 font-semibold text-brand-600 dark:text-brand-400">→ {alert.action}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Row 3: AI Recommendations + Top Matches + GPU */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* AI Recommendations */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-brand-500" />
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">AI Recommendations</p>
          </div>
          {recommendations.length === 0 ? (
            <p className="text-slate-400 text-sm">Enable Gemini for AI recommendations</p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec: any, i: number) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={PRIORITY_COLOR[rec.priority] || 'badge-blue'}>
                      {rec.priority}
                    </Badge>
                    <span className="text-xs text-slate-400">{rec.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{rec.action}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{rec.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Matches */}
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-4">Top AI Decisions</p>
          {topMatches.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Run a job match to see top decisions</p>
          ) : (
            <div className="space-y-2">
              {topMatches.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="w-7 h-7 gradient-bg rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{m.name}</p>
                    <p className="text-xs text-slate-400 truncate">{m.title}</p>
                  </div>
                  <span className={cn(
                    'text-xs font-bold',
                    m.score >= 0.7 ? 'text-emerald-600' : m.score >= 0.4 ? 'text-amber-600' : 'text-red-500'
                  )}>
                    {(m.score * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* GPU Status + Quick Actions */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-brand-500" />
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Compute Engine</p>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Engine</span>
                <span className="font-semibold text-slate-800 dark:text-white">{gpu.engine || 'pandas (CPU)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GPU</span>
                <Badge className={gpu.available ? 'badge-green' : 'badge-amber'}>
                  {gpu.available ? 'Active' : 'CPU Mode'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">BigQuery</span>
                <Badge className={data?.bigquery?.available ? 'badge-green' : 'badge-amber'}>
                  {data?.bigquery?.available ? 'Connected' : 'SQLite'}
                </Badge>
              </div>
            </div>
            <Link to="/gpu-benchmark" className="text-xs text-brand-500 hover:text-brand-400 mt-3 block">
              View full benchmark →
            </Link>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Quick Actions</p>
            <div className="space-y-2">
              <Link to="/upload-job" className="btn-primary flex items-center justify-center gap-2 w-full py-2 text-xs">
                <Upload className="w-3.5 h-3.5" /> Upload Job
              </Link>
              <Link to="/copilot" className="btn-secondary flex items-center justify-center gap-2 w-full py-2 text-xs">
                <MessageSquare className="w-3.5 h-3.5" /> Ask Copilot
              </Link>
              <Link to="/workforce" className="btn-secondary flex items-center justify-center gap-2 w-full py-2 text-xs">
                <Globe className="w-3.5 h-3.5" /> Workforce Intel
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Row 4: Recent Jobs */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recent Job Postings</p>
          <Link to="/rankings" className="text-xs text-brand-500 hover:text-brand-400">View rankings →</Link>
        </div>
        {recentJobs.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">No jobs uploaded yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {recentJobs.map((j: any) => (
              <Link
                key={j.job_id}
                to={`/rankings?job=${j.job_id}`}
                className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-slate-200/50 dark:border-white/5"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{j.title || '(Untitled)'}</p>
                  <Badge className={j.status === 'matched' ? 'badge-green' : 'badge-amber'}>{j.status}</Badge>
                </div>
                <p className="text-xs text-slate-400">{j.job_id}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
