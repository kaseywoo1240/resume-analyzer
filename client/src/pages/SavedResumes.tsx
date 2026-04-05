import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';

interface SavedResume {
  id: number;
  filename: string;
  jobTitle: string | null;
  jobUrl: string;
  savedAt: string;
  analysisId: number;
}

interface SavedResumesResponse {
  resumes: SavedResume[];
}

function companyFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    const tld = parts[parts.length - 1];
    const brandTLDs = new Set(['ai', 'io', 'co', 'app', 'dev', 'tech']);
    const result = brandTLDs.has(tld) ? parts : parts.slice(0, -1);
    return result.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  } catch {
    return 'Unknown';
  }
}

export default function SavedResumes() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<SavedResume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<SavedResumesResponse>('/generate/saved')
      .then(({ data }) => setResumes(data.resumes ?? []))
      .catch(() => setResumes([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900">Saved Resumes</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Saved Resumes</h2>
          <p className="text-gray-500 mt-1">All your accepted and saved optimized resumes.</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        ) : resumes.length === 0 ? (
          <div className="card text-center py-16">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium mb-1">No saved resumes yet</p>
            <p className="text-gray-400 text-sm mb-6">Run an analysis and generate an optimized resume to get started.</p>
            <Link to="/job" className="btn-primary px-6">Run Analysis</Link>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {resumes.map((r) => (
                <li key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{r.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{r.jobTitle ?? companyFromUrl(r.jobUrl)}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">Saved {new Date(r.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      to={`/analysis/${r.analysisId}`}
                      className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                    >
                      Analysis
                    </Link>
                    <span className="text-gray-200">|</span>
                    <Link
                      to={`/preview/${r.id}`}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
