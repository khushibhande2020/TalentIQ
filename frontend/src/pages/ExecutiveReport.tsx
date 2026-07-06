import { useEffect, useState } from 'react';
import { Download, FileText, Brain, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getExecutiveReport, downloadExecutiveReportPdf } from '@/lib/api';
import { Card, PageHeader, Spinner, Badge } from '@/components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type Period = 'weekly' | 'monthly' | 'quarterly';
const PERIODS: Period[] = ['weekly', 'monthly', 'quarterly'];
const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

export default function ExecutiveReportPage() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async (p: Period) => {
    setLoading(true);
    try { setData(await getExecutiveReport(p)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(period); }, [period]);

  const report = data?.report || {};
  const snapshot = data?.analytics_snapshot || {};

  const pipelineHealth = report.pipeline_health;
  const healthBadge = pipelineHealth === 'healthy' ? 'badge-green'
    : pipelineHealth === 'at_risk' ? 'badge-amber'
    : pipelineHealth === 'critical' ? 'badge-red'
    : 'badge-blue';

  return (
    <div>
      <PageHeader
        title="Executive Board Report"
        subtitle="AI-generated hiring intelligence summary for leadership"
        action={
          <div className="flex items-center gap-2">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={period === p ? 'btn-primary text-sm py-2' : 'btn-secondary text-sm py-2'}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
            <button
              onClick={() => downloadExecutiveReportPdf(period)}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>
        }
      />

      {loading && <div className="flex justify-center py-32"><Spinner size={36} /></div>}

      {!loading && data && (
        <div className="space-y-6">
          {/* Report header */}
          <Card className="border border-brand-200/30 dark:border-brand-800/30">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 gradient-bg rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/30">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <p className="font-bold text-lg text-slate-900 dark:text-white">
                    {report.report_title || 'Executive Talent Intelligence Report'}
                  </p>
                  {data?.agent_status === 'ok' && <Badge className="badge-purple text-[10px]">Gemini</Badge>}
                  {pipelineHealth && <Badge className={healthBadge}>{pipelineHealth}</Badge>}
                </div>
                <p className="text-xs text-slate-400">
                  Period: {period.charAt(0).toUpperCase() + period.slice(1)} ·
                  Generated: {data?.generated_at ? new Date(data.generated_at).toLocaleString() : '—'}
                </p>
                {report.executive_summary && (
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {report.executive_summary}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Headline metrics */}
          {report.headline_metrics && report.headline_metrics.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {report.headline_metrics.map((m: any, i: number) => (
                <Card key={i}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{m.label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{m.value}</p>
                  <div className="mt-1.5 flex items-center gap-1">
                    <TrendingUp className={`w-3 h-3 ${m.trend === 'up' ? 'text-emerald-500' : m.trend === 'down' ? 'text-red-500 rotate-180' : 'text-slate-400'}`} />
                    <span className={`text-xs capitalize ${m.trend === 'up' ? 'text-emerald-500' : m.trend === 'down' ? 'text-red-500' : 'text-slate-400'}`}>
                      {m.trend}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Key findings + Recommendations */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-brand-500" />
                <p className="font-semibold text-slate-800 dark:text-white">Key Findings</p>
              </div>
              {report.key_findings?.length > 0 ? (
                <div className="space-y-2">
                  {report.key_findings.map((f: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
                      <div className="w-5 h-5 gradient-bg rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{f}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-sm">No findings available</p>}
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="font-semibold text-slate-800 dark:text-white">Recommendations</p>
              </div>
              {report.recommendations?.length > 0 ? (
                <div className="space-y-2">
                  {report.recommendations.map((r: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-700 dark:text-slate-300">{r}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-sm">No recommendations available</p>}
            </Card>
          </div>

          {/* Risks + Next Steps */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="font-semibold text-slate-800 dark:text-white">Top Risks</p>
              </div>
              {report.top_risks?.length > 0 ? (
                <div className="space-y-2">
                  {report.top_risks.map((r: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-700 dark:text-slate-300">{r}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-sm">No risks identified</p>}
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-violet-500" />
                <p className="font-semibold text-slate-800 dark:text-white">Next Steps</p>
              </div>
              {report.next_steps?.length > 0 ? (
                <div className="space-y-2">
                  {report.next_steps.map((s: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-violet-50/80 dark:bg-violet-900/20">
                      <span className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</span>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{s}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-sm">No next steps available</p>}
            </Card>
          </div>

          {/* Analytics snapshot */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="col-span-2">
              <p className="font-semibold text-slate-800 dark:text-white mb-4">Top Skills in Pool</p>
              {snapshot.top_skills?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={snapshot.top_skills.slice(0, 10)} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="skill" width={120} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 12, fontSize: 11 }} />
                    <Bar dataKey="count" name="Candidates" radius={[0, 6, 6, 0]}>
                      {snapshot.top_skills.slice(0, 10).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-slate-400 text-sm text-center py-8">No skill data</p>}
            </Card>

            <Card>
              <p className="font-semibold text-slate-800 dark:text-white mb-4">Platform Snapshot</p>
              <div className="space-y-3 text-sm">
                {[
                  ['Total Candidates', (snapshot.total_candidates ?? 0).toLocaleString()],
                  ['Active Jobs', snapshot.total_jobs ?? 0],
                  ['Match Runs', (snapshot.total_rankings ?? 0).toLocaleString()],
                  ['Avg Match Score', snapshot.avg_match_score ? `${(snapshot.avg_match_score * 100).toFixed(1)}%` : 'N/A'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{value}</span>
                  </div>
                ))}
              </div>
              {report.hiring_velocity && (
                <div className="mt-4 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500 mb-0.5">Hiring Velocity</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{report.hiring_velocity}</p>
                </div>
              )}
            </Card>
          </div>

          {/* Talent market + Active jobs */}
          {(report.talent_market_summary || data?.active_jobs?.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {report.talent_market_summary && (
                <Card>
                  <p className="font-semibold text-slate-800 dark:text-white mb-3">Talent Market</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{report.talent_market_summary}</p>
                </Card>
              )}
              {data?.active_jobs?.length > 0 && (
                <Card>
                  <p className="font-semibold text-slate-800 dark:text-white mb-3">Active Jobs</p>
                  <div className="space-y-1.5">
                    {data.active_jobs.slice(0, 8).map((j: any) => (
                      <div key={j.job_id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="text-slate-700 dark:text-slate-300 truncate">{j.title || '(Untitled)'}</span>
                        <Badge className={j.status === 'matched' ? 'badge-green' : 'badge-amber'}>{j.status}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
