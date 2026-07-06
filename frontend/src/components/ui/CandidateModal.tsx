import { useEffect, useState } from 'react';
import { X, MapPin, Briefcase, GraduationCap, Award, Star, Clock } from 'lucide-react';
import { getCandidate } from '@/lib/api';
import type { Candidate } from '@/types';
import { Card, ScoreBar, Badge, Spinner } from '@/components/ui';
import { cn, proficiencyColor } from '@/lib/utils';

interface Props {
  candidateId: string | null;
  similarityScore?: number;
  onClose: () => void;
}

export default function CandidateModal({ candidateId, similarityScore, onClose }: Props) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!candidateId) return;
    setLoading(true);
    getCandidate(candidateId)
      .then(setCandidate)
      .finally(() => setLoading(false));
  }, [candidateId]);

  if (!candidateId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 glass border-b border-white/10 px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">
              {candidate?.anonymized_name || candidateId}
            </h2>
            <p className="text-sm text-slate-500">{candidate?.headline}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-20"><Spinner size={32} /></div>
        )}

        {candidate && !loading && (
          <div className="p-6 space-y-5">
            {/* Score + meta */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <p className="text-xs text-slate-500 mb-2 uppercase font-semibold">Match Score</p>
                {similarityScore != null ? (
                  <ScoreBar score={similarityScore} label="Similarity" />
                ) : <p className="text-slate-400 text-sm">N/A</p>}
              </Card>
              <Card>
                <p className="text-xs text-slate-500 mb-2 uppercase font-semibold">Profile</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{candidate.location || '—'}, {candidate.country || ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <span>{candidate.years_of_experience?.toFixed(1)} yrs exp</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Notice: {candidate.redrob_signals?.notice_period_days ?? '—'} days</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Summary */}
            {candidate.summary && (
              <Card>
                <p className="text-xs text-slate-500 mb-2 uppercase font-semibold">Summary</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{candidate.summary}</p>
              </Card>
            )}

            {/* Skills */}
            {candidate.skills && candidate.skills.length > 0 && (
              <Card>
                <p className="text-xs text-slate-500 mb-3 uppercase font-semibold">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {candidate.skills.map((s, i) => (
                    <span key={i} className={cn('badge', proficiencyColor(s.proficiency))}>
                      {s.name}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Career */}
            {candidate.career_history && candidate.career_history.length > 0 && (
              <Card>
                <p className="text-xs text-slate-500 mb-3 uppercase font-semibold flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5" /> Career History
                </p>
                <div className="space-y-4">
                  {candidate.career_history.map((job, i) => (
                    <div key={i} className="border-l-2 border-brand-500/30 pl-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm text-slate-900 dark:text-white">{job.title}</p>
                          <p className="text-xs text-slate-500">{job.company} · {job.company_size}</p>
                        </div>
                        {job.is_current && <Badge className="badge-green">Current</Badge>}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{job.duration_months} months</p>
                      {job.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed line-clamp-3">
                          {job.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Education */}
            {candidate.education && candidate.education.length > 0 && (
              <Card>
                <p className="text-xs text-slate-500 mb-3 uppercase font-semibold flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5" /> Education
                </p>
                {candidate.education.map((edu, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-semibold text-slate-900 dark:text-white">{edu.institution}</p>
                    <p className="text-slate-500">{edu.degree} — {edu.field_of_study}</p>
                    <p className="text-xs text-slate-400">{edu.start_year}–{edu.end_year} · {edu.grade}</p>
                  </div>
                ))}
              </Card>
            )}

            {/* Signals */}
            {candidate.redrob_signals && (
              <Card>
                <p className="text-xs text-slate-500 mb-3 uppercase font-semibold flex items-center gap-2">
                  <Star className="w-3.5 h-3.5" /> Platform Signals
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-400">Profile Completeness</p>
                    <ScoreBar score={candidate.redrob_signals.profile_completeness_score / 100} label="" />
                  </div>
                  <div>
                    <p className="text-slate-400">Interview Completion</p>
                    <ScoreBar score={candidate.redrob_signals.interview_completion_rate} label="" />
                  </div>
                  <div className="col-span-2 flex gap-2 flex-wrap mt-1">
                    {candidate.redrob_signals.open_to_work_flag && <Badge className="badge-green">Open to Work</Badge>}
                    {candidate.redrob_signals.willing_to_relocate && <Badge className="badge-blue">Willing to Relocate</Badge>}
                    <Badge className="badge-purple">{candidate.redrob_signals.preferred_work_mode}</Badge>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
