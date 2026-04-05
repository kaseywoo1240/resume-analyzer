import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

interface Resume {
  id: string;
  filename: string;
  uploadedAt: string;
}

interface ResumesResponse {
  resumes: Resume[];
}

interface AnalysisResponse {
  analysisId: number;
}

export default function JobDescription() {
  const navigate = useNavigate();

  const [jobUrl, setJobUrl] = useState('');
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<ResumesResponse>('/resume/list')
      .then(({ data }) => {
        const list = data.resumes ?? [];
        setResumes(list);
        if (list.length > 0) {
          setSelectedResumeId(list[0].id);
        }
      })
      .catch(() => setResumes([]))
      .finally(() => setLoadingResumes(false));
  }, []);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isValidUrl(jobUrl)) {
      setError('Please enter a valid URL (e.g. https://linkedin.com/jobs/view/...)');
      return;
    }

    if (!selectedResumeId) {
      setError('Please select a resume to analyze.');
      return;
    }

    setAnalyzing(true);

    try {
      const { data } = await apiClient.post<AnalysisResponse>('/analysis/run', {
        jobUrl,
        resumeId: Number(selectedResumeId),
      });
      navigate(`/analysis/${data.analysisId}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const msg = axiosErr?.response?.data?.error ?? 'Analysis failed. Please check the URL and try again.';
      setError(msg);
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900">Job Analysis</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Analyze Against a Job Posting</h2>
          <p className="text-gray-500 mt-1">
            Paste a job listing URL and we'll score your resume against it using ATS matching.
          </p>
        </div>

        <div className="card">
          {analyzing ? (
            /* Loading state */
            <div className="py-16 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-indigo-100" />
                <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-indigo-600 border-t-transparent spinner" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">Analyzing your resume...</p>
                <p className="text-sm text-gray-500 mt-1">
                  This may take 15–30 seconds. We're comparing your resume to the job requirements.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 mt-2">
                {['Fetching job description', 'Parsing resume', 'Running ATS matching', 'Generating insights'].map(
                  (step, i) => (
                    <div key={step} className="flex items-center gap-2 text-sm text-gray-500">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-gray-300'}`}
                      />
                      {step}
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="jobUrl" className="label">Job Posting URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <input
                    id="jobUrl"
                    type="url"
                    required
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    className="input-field pl-10"
                    placeholder="https://www.linkedin.com/jobs/view/..."
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Works with LinkedIn, Indeed, Greenhouse, Lever, and most job boards.
                </p>
              </div>

              <div>
                <label htmlFor="resume" className="label">Resume to Analyze</label>
                {loadingResumes ? (
                  <div className="input-field flex items-center gap-2 text-gray-400">
                    <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading resumes...
                  </div>
                ) : resumes.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                    No resumes uploaded yet.{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/upload')}
                      className="font-medium underline"
                    >
                      Upload one first.
                    </button>
                  </div>
                ) : (
                  <select
                    id="resume"
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    className="input-field"
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.filename} — {new Date(r.uploadedAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="submit"
                disabled={resumes.length === 0 || !jobUrl.trim()}
                className="btn-primary w-full py-3 text-base"
              >
                Run ATS Analysis
              </button>
            </form>
          )}
        </div>

        {/* Info cards */}
        {!analyzing && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: '🎯', label: 'ATS Score', desc: 'See how your resume ranks for this role' },
              { icon: '🔍', label: 'Keyword Gaps', desc: 'Discover missing terms from the job posting' },
              { icon: '⚡', label: 'Action Plan', desc: 'Get specific suggestions to improve your score' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                <div className="text-2xl mb-2">{icon}</div>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
