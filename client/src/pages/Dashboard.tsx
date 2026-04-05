import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

interface Resume {
  id: string;
  filename: string;
  uploadedAt: string;
}

interface ResumesResponse {
  resumes: Resume[];
}

interface SavedResume {
  id: number;
  filename: string;
  jobTitle: string | null;
  savedAt: string;
  analysisId: number;
}

interface SavedResumesResponse {
  resumes: SavedResume[];
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { justUploaded?: boolean; justSaved?: boolean } | null;
  const justUploaded = locationState?.justUploaded ?? false;
  const justSaved = locationState?.justSaved ?? false;
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);

  useEffect(() => {
    apiClient
      .get<ResumesResponse>('/resume/list')
      .then(({ data }) => setResumes(data.resumes ?? []))
      .catch(() => setResumes([]))
      .finally(() => setLoadingResumes(false));

    apiClient
      .get<SavedResumesResponse>('/generate/saved')
      .then(({ data }) => setSavedResumes(data.resumes ?? []))
      .catch(() => setSavedResumes([]));
  }, []);

  const mostRecent = resumes[0] ?? null;
  const hasResumes = resumes.length > 0;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-lg">Resume Analyzer</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0] ?? 'there'}!
          </h2>
          <p className="text-gray-500 mt-1">
            Upload your resume and get it analyzed against any job description.
          </p>
        </div>

        {/* Save success banner */}
        {justSaved && (
          <div className="mb-6 flex items-center gap-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-900">Resume saved successfully!</p>
              <p className="text-sm text-indigo-700 mt-0.5">You can find it below under <strong>Recently Saved Resumes</strong>.</p>
            </div>
          </div>
        )}

        {/* Upload success banner */}
        {justUploaded && (
          <div className="mb-6 flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900">Resume uploaded successfully!</p>
              <p className="text-sm text-green-700 mt-0.5">Ready to analyze it against a job posting? Click <strong>Run Analysis</strong> below.</p>
            </div>
          </div>
        )}

        {/* Most recent resume banner */}
        {!loadingResumes && mostRecent && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
            <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-indigo-900 font-medium truncate">{mostRecent.filename}</p>
              <p className="text-xs text-indigo-500">
                Uploaded {new Date(mostRecent.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <Link
              to="/upload"
              className="text-xs text-indigo-600 font-medium hover:text-indigo-700 flex-shrink-0"
            >
              Replace
            </Link>
          </div>
        )}

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload Resume Card */}
          <div className="card hover:shadow-md transition-shadow flex flex-col">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Resume</h3>
            <p className="text-gray-500 text-sm flex-1 mb-5">
              Upload your resume in PDF or Word format. We'll parse and store it for analysis.
            </p>
            <Link to="/upload" className="btn-primary self-start">
              {hasResumes ? 'Replace Resume' : 'Upload Resume'}
            </Link>
          </div>

          {/* Analyze Card */}
          <div className={`card flex flex-col transition-shadow ${hasResumes ? 'hover:shadow-md' : 'opacity-60'} ${justUploaded && hasResumes ? 'ring-2 ring-green-400' : ''}`}>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyze Against Job</h3>
            <p className="text-gray-500 text-sm flex-1 mb-5">
              Paste a job URL to get an ATS score, keyword gaps, strengths, and weaknesses.
            </p>
            {hasResumes ? (
              <Link to="/job" className="btn-primary self-start bg-green-600 hover:bg-green-700 focus:ring-green-500">
                Run Analysis
              </Link>
            ) : (
              <div className="self-start">
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Upload a resume first
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Saved resumes */}
        {savedResumes.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Recently Saved Resumes</h3>
            </div>
            <div className="card p-0 overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {savedResumes.slice(0, 3).map((r) => (
                  <li key={r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.filename}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {r.jobTitle ?? 'Position'} · Saved {new Date(r.savedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Link to={`/preview/${r.id}`} className="text-xs text-indigo-600 font-medium hover:text-indigo-700 flex-shrink-0">
                      View
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                <Link
                  to="/saved"
                  className="flex items-center justify-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                >
                  View all saved resumes
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Recent uploads list */}
        {!loadingResumes && resumes.length > 1 && (
          <div className="mt-8">
            <h3 className="text-base font-semibold text-gray-900 mb-4">All Uploaded Resumes</h3>
            <div className="card p-0 overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {resumes.map((r) => (
                  <li key={r.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-gray-800 flex-1 truncate">{r.filename}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(r.uploadedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {loadingResumes && (
          <div className="mt-8 flex items-center gap-2 text-sm text-gray-400">
            <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading resumes...
          </div>
        )}
      </main>
    </div>
  );
}
