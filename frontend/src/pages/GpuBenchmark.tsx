import { useEffect, useState } from 'react';
import { Cpu, RefreshCw, Zap, Clock, BarChart2 } from 'lucide-react';
import { getGpuBenchmark } from '@/lib/api';
import { Card, PageHeader, Spinner, Badge } from '@/components/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid,
} from 'recharts';

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl border border-white/10">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.color }}>
          {p.name}: <b>{p.value} ms</b>
        </p>
      ))}
    </div>
  );
};

export default function GpuBenchmarkPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setRunning(true);
    try { setData(await getGpuBenchmark()); }
    finally { setLoading(false); setRunning(false); }
  };

  useEffect(() => { load(); }, []);

  const chartData = (data?.benchmark_results || []).map((r: any) => ({
    size: r.size_label,
    'CPU (pandas)': r.cpu_ms,
    ...(r.gpu_ms != null ? { 'GPU (cuDF)': r.gpu_ms } : {}),
  }));

  const embed = data?.embedding_benchmark || {};

  return (
    <div>
      <PageHeader
        title="GPU Benchmark Dashboard"
        subtitle="CPU vs GPU performance comparison — automatic pandas fallback when no CUDA GPU present"
        action={
          <button onClick={load} disabled={running} className="btn-secondary flex items-center gap-2">
            {running ? <><Spinner size={14} /> Running…</> : <><RefreshCw className="w-4 h-4" /> Re-run</>}
          </button>
        }
      />

      {loading && <div className="flex justify-center py-32"><Spinner size={36} /></div>}

      {!loading && data && (
        <div className="space-y-6">
          {/* Status banner */}
          <Card className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${data.gpu_available ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
              <Cpu className={`w-6 h-6 ${data.gpu_available ? 'text-emerald-600' : 'text-amber-600'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <p className="font-bold text-slate-900 dark:text-white">
                  {data.gpu_available ? 'GPU Acceleration Active' : 'CPU Mode (pandas)'}
                </p>
                <Badge className={data.gpu_available ? 'badge-green' : 'badge-amber'}>
                  {data.dataframe_engine}
                </Badge>
                <Badge className={data.gpu_acceleration_enabled ? 'badge-green' : 'badge-amber'}>
                  {data.gpu_acceleration_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">{data.note}</p>
            </div>
          </Card>

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-4">
            {(data.benchmark_results || []).map((r: any) => (
              <Card key={r.size}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{r.size_label}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">CPU</span>
                    <span className="font-mono font-bold">{r.cpu_ms} ms</span>
                  </div>
                  {r.gpu_ms != null ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">GPU</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{r.gpu_ms} ms</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">GPU not available</p>
                  )}
                  {r.speedup && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs text-slate-500">Speedup</span>
                      <Badge className="badge-green">{r.speedup}×</Badge>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            {/* Embedding benchmark */}
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                <Zap className="w-3 h-3 inline mr-1" />Embedding
              </p>
              {embed.error ? (
                <p className="text-xs text-red-400">{embed.error}</p>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Texts</span>
                    <span className="font-bold">{embed.texts_encoded}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total</span>
                    <span className="font-mono font-bold">{embed.total_ms} ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Per text</span>
                    <span className="font-mono text-brand-500">{embed.ms_per_text} ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Throughput</span>
                    <span className="font-bold">{embed.texts_per_second}/s</span>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Comparison chart */}
          <Card>
            <p className="font-semibold text-slate-800 dark:text-white mb-4">
              CPU vs GPU DataFrame Operations (milliseconds — lower is better)
            </p>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="size" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} unit=" ms" />
                  <Tooltip content={<CT />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="CPU (pandas)" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  {data.gpu_available && (
                    <Bar dataKey="GPU (cuDF)" fill="#10b981" radius={[6, 6, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-sm text-center py-10">No benchmark data</p>
            )}
          </Card>

          {/* Methodology note */}
          <Card>
            <div className="flex items-start gap-3">
              <BarChart2 className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p className="font-semibold text-slate-800 dark:text-white mb-1">Benchmark Methodology</p>
                <p>Each benchmark creates a DataFrame of the specified size and runs:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                  <li>GroupBy aggregation (mean + std)</li>
                  <li>Pearson correlation (corr)</li>
                  <li>Sort + reset_index</li>
                </ul>
                <p className="mt-2 text-xs">
                  <strong>CPU</strong>: pandas on system RAM ·{' '}
                  <strong>GPU</strong>: NVIDIA RAPIDS cuDF on VRAM (requires CUDA GPU + cuDF installed) ·{' '}
                  <strong>Embedding</strong>: SentenceTransformer all-MiniLM-L6-v2 encode throughput
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  The application gracefully falls back to pandas on all machines without a CUDA GPU — no functionality is lost.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
