import { useEffect, useState } from 'react';
import { Globe, RefreshCw, Brain, TrendingUp } from 'lucide-react';
import { getWorkforceIntelligence } from '@/lib/api';
import { Card, PageHeader, Spinner, StatCard, Badge } from '@/components/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6'];

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl border border-white/10">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.stroke || p.color }}>
          {p.name}: <b>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</b>
        </p>
      ))}
    </div>
  );
};

export default function WorkforcePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await getWorkforceIntelligence()); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-32"><Spinner size={36} /></div>;

  const analytics = data?.analytics || {};
  const funnel = data?.hiring_funnel || [];
  const trends = data?.recruitment_trends || [];
  const summary = data?.executive_summary || {};

  return (
    <div>
      <PageHeader
        title="Workforce Intelligence"
        subtitle="Real-time talent pool analytics powered by AI"
        action={
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Candidates" value={(analytics.total_candidates ?? 0).toLocaleString()}
          icon={<Globe className="w-5 h-5" />} color="brand" />
        <StatCard label="Active Jobs" value={analytics.total_jobs ?? 0}
          icon={<TrendingUp className="w-5 h-5" />} color="violet" />
        <StatCard label="Total Matches" value={(analytics.total_rankings ?? 0).toLocaleString()}
          icon={<Brain className="w-5 h-5" />} color="cyan" />
        <StatCard
          label="Avg Match Score"
          value={analytics.avg_similarity_score ? `${(analytics.avg_similarity_score * 100).toFixed(1)}%` : 'N/A'}
          icon={<TrendingUp className="w-5 h-5" />} color="emerald"
        />
      </div>

      {/* AI Executive Summary */}
      {summary.summary && (
        <Card className="mb-6">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 gradient-bg rounded-xl flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="font-bold text-slate-900 dark:text-white">AI Workforce Summary</p>
                {summary.ai_generated && <Badge className="badge-purple text-[10px]">Gemini</Badge>}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{summary.summary}</p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                {summary.key_insight && (
                  <div className="p-2.5 rounded-lg bg-brand-50/80 dark:bg-brand-900/20 border border-brand-200/50 dark:border-brand-800/30">
                    <p className="font-semibold text-brand-700 dark:text-brand-400 mb-0.5">Key Insight</p>
                    <p className="text-slate-600 dark:text-slate-300">{summary.key_insight}</p>
                  </div>
                )}
                {summary.risk && (
                  <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30">
                    <p className="font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Risk</p>
                    <p className="text-slate-600 dark:text-slate-300">{summary.risk}</p>
                  </div>
                )}
                {summary.opportunity && (
                  <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">Opportunity</p>
                    <p className="text-slate-600 dark:text-slate-300">{summary.opportunity}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Row: Skills + Experience */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Skill Distribution (Top 12)</p>
          {analytics.top_skills?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.top_skills?.slice(0, 12)} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="skill" width={120} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip content={<CT />} />
                <Bar dataKey="count" name="Candidates" radius={[0, 6, 6, 0]}>
                  {analytics.top_skills?.slice(0, 12).map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm py-10 text-center">No skill data yet</p>}
        </Card>

        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Experience Distribution</p>
          {analytics.experience_distribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.experience_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip content={<CT />} />
                <Bar dataKey="count" name="Candidates" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm py-10 text-center">No experience data yet</p>}
        </Card>
      </div>

      {/* Row: Funnel + Industry + Trends */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Hiring Funnel</p>
          {funnel.length > 0 ? (
            <div className="space-y-3">
              {funnel.map((stage: any, i: number) => {
                const max = funnel[0]?.count || 1;
                const pct = Math.round((stage.count / max) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{stage.stage}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{stage.count.toLocaleString()}</span>
                    </div>
                    <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: stage.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-slate-400 text-sm py-10 text-center">No funnel data yet</p>}
        </Card>

        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Top Industries</p>
          {analytics.industry_distribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={analytics.industry_distribution}
                  dataKey="count"
                  nameKey="industry"
                  cx="50%" cy="50%"
                  outerRadius={85}
                  label={({ industry, percent }: any) =>
                    `${(industry || '').slice(0, 8)} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {analytics.industry_distribution.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CT />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-400 text-sm py-10 text-center">No industry data yet</p>}
        </Card>

        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Recruitment Trends</p>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<CT />} />
                <Line type="monotone" dataKey="candidates" name="Candidates Added"
                  stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-52">
              <p className="text-slate-400 text-sm">Not enough historical data yet</p>
              <p className="text-xs text-slate-400 mt-1">Trends appear after multiple ingestion runs</p>
            </div>
          )}
        </Card>
      </div>

      {/* Score distribution */}
      <Card>
        <p className="font-semibold text-slate-800 dark:text-white mb-4">Match Score Distribution</p>
        {analytics.score_distribution?.some((s: any) => s.count > 0) ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={analytics.score_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<CT />} />
              <Bar dataKey="count" name="Candidates" radius={[6, 6, 0, 0]}>
                {analytics.score_distribution?.map((s: any, i: number) => {
                  const mid = parseFloat(s.range.split('-')[0]) + 0.05;
                  const color = mid >= 0.7 ? '#10b981' : mid >= 0.4 ? '#f59e0b' : '#ef4444';
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-400 text-sm py-6 text-center">Run a job match to see score distribution</p>
        )}
      </Card>
    </div>
  );
}
