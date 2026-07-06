import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Download, RefreshCw, ChevronLeft, ChevronRight,
  Zap, Filter, Search, Eye,
} from 'lucide-react';
import { getJobs, getMatchResults, runMatch, downloadResults } from '@/lib/api';
import type { Job, RankedCandidate } from '@/types';
import {
  Card, PageHeader, Spinner, Badge, EmptyState,
  Table, Th, Td, ScoreBar,
} from '@/components/ui';
import CandidateModal from '@/components/ui/CandidateModal';
import { cn, formatScore, scoreBadgeClass } from '@/lib/utils';

const PAGE_SIZE = 20;

export default function RankingsPage() {
  const [params, setParams] = useSearchParams();
  const initialJob = params.get('job') || '';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>(initialJob);
  const [ranked, setRanked] = useState<RankedCandidate[]>([]);
  const [filtered, setFiltered] = useState<RankedCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState('');
  const [page, setPage] = useState(1);
  const [modalId, setModalId] = useState<string | null>(null);
  const [modalScore, setModalScore] = useState<number | undefined>();

  useEffect(() => { getJobs().then(setJobs); }, []);

  const loadResults = useCallback((jobId: string) => {
    if (!jobId) return;
    setLoading(true);
    getMatchResults(jobId, 200)
      .then(r => setRanked(r.ranked))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedJob) {
      loadResults(selectedJob);
      setParams({ job: selectedJob });
    }
  }, [selectedJob]);

  useEffect(() => {
    let result = ranked;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.anonymized_name?.toLowerCase().includes(q) ||
        r.headline?.toLowerCase().includes(q) ||
        r.current_title?.toLowerCase().includes(q) ||
        r.current_company?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q)
      );
    }
    if (minScore) {
      const ms = parseFloat(minScore) / 100;
      result = result.filter(r => r.similarity_score >= ms);
    }
    setFiltered(result);
    setPage(1);
  }, [ranked, search, minScore]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleRunMatch = async () => {
    if (!selectedJob) return;
    setMatching(true);
    try {
      const result = await runMatch(selectedJob, 200);
      setRanked(result.ranked);
    } finally {
      setMatching(false);
    }
  };

  const openModal = (id: string, score: number) => {
    setModalId(id);
    setModalScore(score);
  };

  return (
    <div>
      <PageHeader
        title="Candidate Rankings"
        subtitle="Semantic + TF-IDF ranked results for your job postings"
        action={
          <div className="flex gap-2">
            {selectedJob && (
              <>
                <button
                  onClick={handleRunMatch}
                  disabled={matching}
                  className="btn-secondary flex items-center gap-2"
                >
                  {matching
                    ? <><Spinner size={14} /> Matching</>
                    : <><RefreshCw className="w-4 h-4" /> Re-run Match</>}
                </button>
                <button
                  onClick={() => downloadResults(selectedJob)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </>
            )}
          </div>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Select Job
            </label>
            <select
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value)}
              className="input-field"
            >
              <option value="">— Choose a job —</option>
              {jobs.map(j => (
                <option key={j.job_id} value={j.job_id}>
                  {j.title || '(Untitled)'} — {j.job_id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Search className="w-3 h-3 inline mr-1" />Search
              </label>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name, title, company..."
                className="input-field w-48"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Filter className="w-3 h-3 inline mr-1" />Min Score %
              </label>
              <input
                type="number"
                min="0" max="100"
                value={minScore}
                onChange={e => setMinScore(e.target.value)}
                placeholder="e.g. 40"
                className="input-field w-28"
              />
            </div>
          </div>

          {ranked.length > 0 && (
            <div className="ml-auto text-right">
              <p className="text-xs text-slate-500">Showing</p>
              <p className="font-bold text-slate-900 dark:text-white text-lg">{filtered.length}</p>
              <p className="text-xs text-slate-500">of {ranked.length} candidates</p>
            </div>
          )}
        </div>
      </Card>

      {!selectedJob && (
        <EmptyState
          icon={<Zap className="w-12 h-12" />}
          title="Select a job to see rankings"
          desc="Upload a job description first, then come back here to view ranked candidates"
        />
      )}

      {selectedJob && loading && (
        <div className="flex justify-center py-32"><Spinner size={36} /></div>
      )}

      {selectedJob && !loading && ranked.length === 0 && (
        <Card className="text-center py-12">
          <Zap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600 dark:text-slate-400">No rankings yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Run the matching algorithm to rank candidates</p>
          <button onClick={handleRunMatch} disabled={matching} className="btn-primary mx-auto flex items-center gap-2">
            {matching ? <><Spinner size={14} /> Running...</> : <><Zap className="w-4 h-4" /> Run Match</>}
          </button>
        </Card>
      )}

      {!loading && paginated.length > 0 && (
        <>
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Candidate</Th>
                <Th>Role & Company</Th>
                <Th>Location</Th>
                <Th>Exp</Th>
                <Th>Overall Score</Th>
                <Th>TF-IDF</Th>
                <Th>Semantic</Th>
                <Th>Top Skills</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(r => (
                <tr
                  key={r.candidate_id}
                  className="hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-colors group"
                >
                  <Td>
                    <span className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                      r.rank <= 3
                        ? 'gradient-bg text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    )}>
                      {r.rank}
                    </span>
                  </Td>
                  <Td>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">
                        {r.anonymized_name || r.candidate_id}
                      </p>
                      <p className="text-xs text-slate-400 truncate max-w-[160px]">{r.headline}</p>
                    </div>
                  </Td>
                  <Td>
                    <p className="text-sm font-medium">{r.current_title || '—'}</p>
                    <p className="text-xs text-slate-400">{r.current_company || ''}</p>
                  </Td>
                  <Td className="text-xs text-slate-500">{r.location || '—'}</Td>
                  <Td className="text-xs">
                    {r.years_of_experience != null ? `${r.years_of_experience.toFixed(1)} yrs` : '—'}
                  </Td>
                  <Td>
                    <Badge className={scoreBadgeClass(r.similarity_score)}>
                      {formatScore(r.similarity_score)}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="w-20">
                      <ScoreBar score={r.tfidf_score} label="" />
                    </div>
                  </Td>
                  <Td>
                    <div className="w-20">
                      <ScoreBar score={r.semantic_score} label="" />
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {r.skills?.slice(0, 3).map((s, i) => (
                        <span key={i} className="badge badge-purple text-[10px]">{s.name}</span>
                      ))}
                      {(r.skills?.length ?? 0) > 3 && (
                        <span className="badge badge-purple text-[10px]">+{(r.skills?.length ?? 0) - 3}</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <button
                      onClick={() => openModal(r.candidate_id, r.similarity_score)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/30"
                    >
                      <Eye className="w-4 h-4 text-brand-500" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Page {page} of {totalPages} · {filtered.length} results
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="btn-secondary px-3 py-1.5 flex items-center gap-1 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={cn(
                        'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                        pg === page ? 'gradient-bg text-white' : 'btn-secondary'
                      )}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="btn-secondary px-3 py-1.5 flex items-center gap-1 disabled:opacity-40"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <CandidateModal
        candidateId={modalId}
        similarityScore={modalScore}
        onClose={() => setModalId(null)}
      />
    </div>
  );
}
