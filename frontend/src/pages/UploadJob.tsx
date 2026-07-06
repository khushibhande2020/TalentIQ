import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, X } from 'lucide-react';
import { uploadJob, runMatch } from '@/lib/api';
import { Card, PageHeader } from '@/components/ui';

type Step = 'input' | 'processing' | 'done' | 'error';

export default function UploadJobPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => setDescription(e.target?.result as string);
    reader.readAsText(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/plain') handleFile(file);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setStep('processing');
    setError('');

    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 10, 85));
    }, 300);

    try {
      // Step 1: Upload job (NER + embedding)
      setProgress(20);
      const job = await uploadJob(title, description);
      setJobId(job.job_id);

      // Step 2: Run matching
      setProgress(50);
      await runMatch(job.job_id, 100);

      clearInterval(progressInterval);
      setProgress(100);
      setStep('done');
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err?.response?.data?.detail || 'Something went wrong');
      setStep('error');
    }
  };

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Matching Complete!</h2>
        <p className="text-slate-500 mb-6">Top candidates have been ranked for your job posting.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(`/rankings?job=${jobId}`)} className="btn-primary">
            View Rankings
          </button>
          <button onClick={() => { setStep('input'); setDescription(''); setTitle(''); setProgress(0); }}
            className="btn-secondary">
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Upload Job Description"
        subtitle="Paste or drop a JD — our AI will extract skills, run NER analysis, and rank candidates semantically"
      />

      <div className="max-w-2xl">
        {/* Job title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Job Title <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Senior Data Engineer"
            className="input-field"
          />
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !description && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer mb-4
            ${dragging
              ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20'
              : 'border-slate-300 dark:border-slate-600 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/30'
            }
            ${description ? 'hidden' : 'block'}`}
        >
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300 font-medium">
            Drop a .txt file here, or click to browse
          </p>
          <p className="text-sm text-slate-400 mt-1">or paste the description below</p>
          <input ref={fileRef} type="file" accept=".txt" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        {/* Textarea */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Job Description <span className="text-red-500">*</span>
            </label>
            {description && (
              <button onClick={() => setDescription('')} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Paste the full job description here…"
            rows={12}
            className="input-field resize-none font-mono text-xs leading-relaxed"
          />
          <p className="text-xs text-slate-400 mt-1">{description.length} characters</p>
        </div>

        {/* Progress */}
        {step === 'processing' && (
          <Card className="mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
              <span className="font-medium text-sm">
                {progress < 30 ? 'Analysing job description…' :
                 progress < 60 ? 'Generating semantic embedding…' :
                 progress < 90 ? 'Ranking candidates…' : 'Finalising…'}
              </span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full gradient-bg rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2 text-right">{progress}%</p>
          </Card>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-4">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400 text-sm">Error</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setStep('input')} className="ml-auto">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!description.trim() || step === 'processing'}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {step === 'processing' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
          ) : (
            <><FileText className="w-4 h-4" /> Analyse & Match Candidates</>
          )}
        </button>
      </div>
    </div>
  );
}
