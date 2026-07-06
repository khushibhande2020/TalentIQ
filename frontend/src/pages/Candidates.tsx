import { useEffect, useState, useCallback } from 'react';
import { Users, Search, Filter, Eye, Upload } from 'lucide-react';
import { getCandidates, uploadCandidates } from '@/lib/api';
import type { Candidate, CandidatePage } from '@/types';
import {
  Card, PageHeader, Spinner, Badge, EmptyState,
  Table, Th, Td,
} from '@/components/ui';
import CandidateModal from '@/components/ui/CandidateModal';
import { cn, proficiencyColor } from '@/lib/utils';
import { useRef } from 'react';

const PAGE_SIZE = 20;

export default function CandidatesPage() {
  const [data, setData] = useState<CandidatePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [minExp, setMinExp] = useState('');
  const [maxExp, setMaxExp] = useState('');
  const [modalId, setModalId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCandidates = useCallback(() => {
    setLoading(true);
    const params: Record<string, any> = { page, page_size: PAGE_SIZE };
    if (search) params.search = search;
    if (industry) params.industry = industry;
    if (location) params.location = location;
    if (minExp) params.min_exp = parseFloat(minExp);
    if (maxExp) params.max_exp = parseFloat(maxExp);

    getCandidates(params)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, search, industry, location, minExp, maxExp]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const handleSearch = () => { setPage(1); fetchCandidates(); };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadMsg('');
    try {
      const result = await uploadCandidates(file);
      setUploadMsg(`Queued ${result.count} candidates for ingestion. Embeddings generating in background.`);
      setTimeout(fetchCandidates, 3000);
    } catch (e: any) {
      setUploadMsg(e?.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div>
      <PageHeader
        title="Candidate Pool"
        subtitle={`${(data?.total ?? 0).toLocaleString()} candidates indexed`}
        action={
          <div className="flex gap-2 items-center">
            {uploadMsg && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 max-w-xs truncate">
                {uploadMsg}
              </span>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-primary flex items-center gap-2"
            >
              {uploading ? <><Spinner size={14} /> Uploading…</> : <><Upload className="w-4 h-4" /> Import JSONL</>}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".jsonl"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
          </div>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              <Search className="w-3 h-3 inline mr-1" />Search
            </label>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Name, title, company..."
              className="input-field w-52"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              <Filter className="w-3 h-3 inline mr-1" />Industry
            </label>
            <input
              type="text"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="e.g. Software"
              className="input-field w-36"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Bangalore"
              className="input-field w-36"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Min Exp (yrs)
            </label>
            <input
              type="number"
              min="0"
              value={minExp}
              onChange={e => setMinExp(e.target.value)}
              placeholder="0"
              className="input-field w-20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Max Exp (yrs)
            </label>
            <input
              type="number"
              min="0"
              value={maxExp}
              onChange={e => setMaxExp(e.target.value)}
              placeholder="20"
              className="input-field w-20"
            />
          </div>
          <button
            onClick={() => { setPage(1); fetchCandidates(); }}
            className="btn-primary px-5 py-2.5"
          >
            Search
          </button>
          <button
            onClick={() => {
              setSearch(''); setIndustry(''); setLocation('');
              setMinExp(''); setMaxExp(''); setPage(1);
            }}
            className="btn-secondary px-4 py-2.5"
          >
            Clear
          </button>
        </div>
      </Card>

      {loading && <div className="flex justify-center py-32"><Spinner size={36} /></div>}

      {!loading && data?.total === 0 && (
        <EmptyState
          icon={<Users className="w-12 h-12" />}
          title="No candidates found"
          desc="Try adjusting your filters or import a JSONL file to populate the pool"
        />
      )}

      {!loading && data && data.total > 0 && (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Current Role</Th>
                <Th>Industry</Th>
                <Th>Location</Th>
                <Th>Experience</Th>
                <Th>Top Skills</Th>
                <Th>Work Mode</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(c => (
                <tr
                  key={c.candidate_id}
                  className="hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-colors group"
                >
                  <Td>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">
                        {c.anonymized_name || c.candidate_id}
                      </p>
                      <p className="text-xs text-slate-400 truncate max-w-[180px]">{c.headline}</p>
                    </div>
                  </Td>
                  <Td>
                    <p className="text-sm">{c.current_title || '—'}</p>
                    <p className="text-xs text-slate-400">{c.current_company || ''}</p>
                  </Td>
                  <Td className="text-xs text-slate-500">{c.current_industry || '—'}</Td>
                  <Td className="text-xs text-slate-500">{c.location || '—'}</Td>
                  <Td className="text-xs">
                    {c.years_of_experience != null
                      ? `${c.years_of_experience.toFixed(1)} yrs`
                      : '—'}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {c.skills?.slice(0, 3).map((s, i) => (
                        <span key={i} className={cn('badge text-[10px]', proficiencyColor(s.proficiency))}>
                          {s.name}
                        </span>
                      ))}
                      {(c.skills?.length ?? 0) > 3 && (
                        <span className="badge badge-purple text-[10px]">
                          +{(c.skills?.length ?? 0) - 3}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    {c.redrob_signals?.preferred_work_mode && (
                      <Badge className="badge-blue text-[10px]">
                        {c.redrob_signals.preferred_work_mode}
                      </Badge>
                    )}
                    {c.redrob_signals?.open_to_work_flag && (
                      <Badge className="badge-green text-[10px] ml-1">Open</Badge>
                    )}
                  </Td>
                  <Td>
                    <button
                      onClick={() => setModalId(c.candidate_id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/30"
                    >
                      <Eye className="w-4 h-4 text-brand-500" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of{' '}
                {data.total.toLocaleString()} candidates
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="btn-secondary px-3 py-1.5 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="flex items-center px-3 text-sm text-slate-500">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="btn-secondary px-3 py-1.5 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <CandidateModal candidateId={modalId} onClose={() => setModalId(null)} />
    </div>
  );
}
