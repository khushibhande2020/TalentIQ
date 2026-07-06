import { useEffect, useState } from 'react';
import { TrendingUp, Users, Briefcase, Zap } from 'lucide-react';
import { getAnalytics } from '@/lib/api';
import type { Analytics } from '@/types';
import { Card, StatCard, PageHeader, Spinner } from '@/components/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900 dark:text-white mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <span className="font-bold">{p.value}</span></p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics().then(setAnalytics).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-32"><Spinner size={36} /></div>;
  if (!analytics) return null;

  const radarData = analytics.top_skills.slice(0, 8).map(s => ({
    skill: s.skill.length > 12 ? s.skill.slice(0, 12) + '…' : s.skill,
    count: s.count,
  }));

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Insights across your entire candidate pool"
      />

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Candidates"
          value={analytics.total_candidates.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
          color="brand"
        />
        <StatCard
          label="Jobs Posted"
          value={analytics.total_jobs}
          icon={<Briefcase className="w-5 h-5" />}
          color="violet"
        />
        <StatCard
          label="Match Runs"
          value={analytics.total_rankings.toLocaleString()}
          icon={<Zap className="w-5 h-5" />}
          color="cyan"
        />
        <StatCard
          label="Avg Match Score"
          value={analytics.avg_similarity_score
            ? `${(analytics.avg_similarity_score * 100).toFixed(1)}%`
            : 'N/A'}
          icon={<TrendingUp className="w-5 h-5" />}
          color="emerald"
        />
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Top 15 skills bar chart */}
        <Card className="col-span-2">
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Top 15 Skills in Candidate Pool</p>
          {analytics.top_skills.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={analytics.top_skills} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis
                  type="category"
                  dataKey="skill"
                  width={130}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Candidates" radius={[0, 6, 6, 0]}>
                  {analytics.top_skills.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm py-10 text-center">No skill data yet</p>
          )}
        </Card>

        {/* Skills radar */}
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Skill Coverage (top 8)</p>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Radar
                  name="Count"
                  dataKey="count"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.35}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm py-10 text-center">No data</p>
          )}
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Experience distribution */}
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Experience Distribution</p>
          {analytics.experience_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={analytics.experience_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Candidates" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm py-10 text-center">No data</p>
          )}
        </Card>

        {/* Industry distribution pie */}
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Top Industries</p>
          {analytics.industry_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={analytics.industry_distribution}
                  dataKey="count"
                  nameKey="industry"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ industry, percent }) =>
                    `${industry?.slice(0, 10)} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {analytics.industry_distribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm py-10 text-center">No data</p>
          )}
        </Card>

        {/* Location distribution */}
        <Card>
          <p className="font-semibold text-slate-800 dark:text-white mb-4">Top Locations</p>
          {analytics.location_distribution.length > 0 ? (
            <div className="space-y-2">
              {analytics.location_distribution.map((l, i) => {
                const max = analytics.location_distribution[0].count;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-600 dark:text-slate-300 truncate">{l.location}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{l.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(l.count / max) * 100}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm py-10 text-center">No data</p>
          )}
        </Card>
      </div>

      {/* Row 3 — Score distribution */}
      <Card>
        <p className="font-semibold text-slate-800 dark:text-white mb-4">
          Match Score Distribution (across all ranking runs)
        </p>
        {analytics.score_distribution.some(s => s.count > 0) ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics.score_distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Candidates" radius={[6, 6, 0, 0]}>
                {analytics.score_distribution.map((s, i) => {
                  const midpoint = parseFloat(s.range.split('-')[0]) + 0.05;
                  const color = midpoint >= 0.7 ? '#10b981' : midpoint >= 0.4 ? '#f59e0b' : '#ef4444';
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-400 text-sm py-10 text-center">
            Run a job match first to see score distribution
          </p>
        )}
      </Card>
    </div>
  );
}
