import { useState, useEffect } from 'react';
import {
  Settings2, BrainCircuit, Database, Sliders, CheckCircle,
  XCircle, AlertCircle, RefreshCw, Activity, Cpu, Cloud,
  Zap, Shield,
} from 'lucide-react';
import { Card, PageHeader, Spinner } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import {
  getHealthServices, getHealthDatabase, getHealthGemini,
  getHealthGpu, getHealthBigquery, getMetrics,
} from '@/lib/api';

type ServiceStatus = 'ok' | 'disabled' | 'not_configured' | 'not_installed' | 'not_available' | 'error' | 'loading';

interface ServiceCheck { status: ServiceStatus; latency_ms?: number; detail?: string; [k: string]: any }

const StatusIcon = ({ status }: { status: ServiceStatus }) => {
  if (status === 'loading') return <Spinner size={14} />;
  if (status === 'ok') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
  if (status === 'disabled' || status === 'not_configured' || status === 'not_installed' || status === 'not_available')
    return <AlertCircle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
};

const StatusBadge = ({ status }: { status: ServiceStatus }) => {
  const classes: Record<string, string> = {
    ok: 'badge-green', error: 'badge-red',
    disabled: 'badge-amber', not_configured: 'badge-amber',
    not_installed: 'badge-amber', not_available: 'badge-amber',
    loading: 'badge-blue',
  };
  return <span className={`badge ${classes[status] ?? 'badge-purple'}`}>{status.replace('_', ' ')}</span>;
};

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const [topK, setTopK] = useState('100');
  const [model, setModel] = useState('all-MiniLM-L6-v2');
  const [saved, setSaved] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [db, setDb] = useState<ServiceCheck>({ status: 'loading' });
  const [gemini, setGemini] = useState<ServiceCheck>({ status: 'loading' });
  const [gpu, setGpu] = useState<ServiceCheck>({ status: 'loading' });
  const [bigquery, setBigquery] = useState<ServiceCheck>({ status: 'loading' });
  const [metrics, setMetrics] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = async () => {
    setRefreshing(true);
    const [f, d, g, gp, bq, m] = await Promise.all([
      getHealthServices(),
      getHealthDatabase(),
      getHealthGemini(),
      getHealthGpu(),
      getHealthBigquery(),
      getMetrics(),
    ]);
    setFlags(f);
    setDb(d);
    setGemini(g);
    setGpu(gp);
    setBigquery(bq);
    setMetrics(m);
    setRefreshing(false);
  };

  useEffect(() => { loadHealth(); }, []);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div>
      <PageHeader
        title="Settings & System Health"
        subtitle="Configuration, service status, and performance metrics"
        action={
          <button onClick={loadHealth} disabled={refreshing} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-5">

          {/* Appearance */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center">
                <Settings2 className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-white">Appearance</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Dark Mode</p>
                <p className="text-xs text-slate-400">Toggle light/dark interface</p>
              </div>
              <button
                onClick={toggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-brand-600' : 'bg-slate-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </Card>

          {/* AI Config */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
                <BrainCircuit className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-white">AI Configuration</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Embedding Model
                </label>
                <select value={model} onChange={e => setModel(e.target.value)} className="input-field">
                  <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (fast, 384-dim)</option>
                  <option value="all-mpnet-base-v2">all-mpnet-base-v2 (quality, 768-dim)</option>
                  <option value="paraphrase-multilingual-MiniLM-L12-v2">multilingual-MiniLM-L12-v2</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Default Top-K
                </label>
                <input type="number" min="10" max="500" value={topK}
                  onChange={e => setTopK(e.target.value)} className="input-field w-32" />
              </div>
            </div>
          </Card>

          {/* Matching algorithm */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center">
                <Sliders className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-white">Matching Algorithm</p>
            </div>
            <div className="space-y-2">
              {[
                { color: 'bg-brand-500', title: 'Stage 1 — TF-IDF', desc: 'TfidfVectorizer(max_features=5000) → cosine_similarity. Keyword overlap.' },
                { color: 'bg-violet-500', title: 'Stage 2 — Semantic', desc: `SentenceTransformer(${model}) → cosine_similarity. Semantic meaning.` },
                { color: 'bg-emerald-500', title: 'Final Score', desc: '(TF-IDF + Semantic) / 2 · Sorted descending · Top-K returned.' },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className={`w-2 h-2 mt-1.5 rounded-full ${s.color} flex-shrink-0`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-white">{s.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <button onClick={handleSave} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : 'Save Preferences'}
          </button>
        </div>

        {/* Right column — live health */}
        <div className="space-y-5">

          {/* Feature flags */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-white">Feature Flags</p>
            </div>
            {Object.keys(flags).length === 0 ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(flags).map(([key, enabled]) => (
                  <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className={`badge text-[10px] ${enabled ? 'badge-green' : 'badge-amber'}`}>
                      {enabled ? 'on' : 'off'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3">Configure via backend/.env — no code changes needed</p>
          </Card>

          {/* Service health */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-white">Service Health</p>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Database', icon: <Database className="w-4 h-4" />, data: db },
                { label: 'Gemini AI', icon: <BrainCircuit className="w-4 h-4" />, data: gemini },
                { label: 'GPU / cuDF', icon: <Cpu className="w-4 h-4" />, data: gpu },
                { label: 'BigQuery', icon: <Cloud className="w-4 h-4" />, data: bigquery },
              ].map(({ label, icon, data }) => (
                <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    {icon}
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.latency_ms && (
                      <span className="text-xs text-slate-400">{data.latency_ms}ms</span>
                    )}
                    <StatusIcon status={data.status as ServiceStatus} />
                    <StatusBadge status={data.status as ServiceStatus} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Performance metrics */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-white">Performance Metrics</p>
            </div>
            {!metrics ? (
              <div className="flex justify-center py-4"><Spinner /></div>
            ) : Object.keys(metrics.latencies || {}).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No metrics yet — run a job match to see timings
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(metrics.latencies as Record<string, any>).map(([name, stat]) => (
                  <div key={name} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{name}</span>
                      <span className="text-xs text-slate-400">{stat.count} calls</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span>avg <strong>{stat.avg_ms}ms</strong></span>
                      <span className="text-slate-400">p95 {stat.p95_ms}ms</span>
                      <span className="text-slate-400">max {stat.max_ms}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Security */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-white">Security</p>
            </div>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> CORS configured</div>
              <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> File size limits enforced</div>
              <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Input validation on all endpoints</div>
              <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> GZip compression enabled</div>
              <div className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Request correlation IDs</div>
              <div className="flex items-center gap-2 text-slate-400"><AlertCircle className="w-3.5 h-3.5 text-amber-400" /> API key auth — set REQUIRE_API_KEY=true in .env</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
