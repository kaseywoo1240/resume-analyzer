import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

interface Analysis {
  analysisId: number;
  jobTitle: string;
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
}

// ── Circular score gauge ──────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';

  const bgColor =
    score >= 75 ? '#dcfce7' : score >= 50 ? '#fef3c7' : '#fee2e2';

  const label =
    score >= 75 ? 'Strong Match' : score >= 50 ? 'Moderate Match' : 'Weak Match';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
          <circle
            cx="70" cy="70" r={radius} fill="none"
            stroke={color} strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-in-out', transform: 'rotate(-90deg)', transformOrigin: '70px 70px' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-gray-500 font-medium">/ 100</span>
        </div>
      </div>
      <span className="px-3 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: bgColor, color }}>
        {label}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalysisResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<Analysis>(`/analysis/${id}`)
      .then(({ data }) => setAnalysis(data))
      .catch(() => setError('Could not load analysis results. Please try again.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleGenerate = async () => {
    if (!id) return;
    setGenerateError('');
    setGenerating(true);

    try {
      const { data } = await apiClient.post<{ generatedResumeId: number }>('/generate/resume', {
        analysisId: Number(id),
      });
      navigate(`/preview/${data.generatedResumeId}`);
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { error?: string } } }).response?.data?.error
          ? String((err as { response: { data: { error: string } } }).response.data.error)
          : 'Generation failed. Please try again.';
      setGenerateError(msg);
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-100" />
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-indigo-600 border-t-transparent spinner" />
          </div>
          <p className="text-gray-600 font-medium">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium mb-4">{error || 'Analysis not found.'}</p>
          <button onClick={() => navigate('/job')} className="btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => navigate('/job')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900">Analysis Results</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Header card */}
        <div className="card">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <ScoreGauge score={analysis.score} />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Job Position</p>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{analysis.jobTitle}</h2>
              <p className="text-sm text-gray-500">ATS Compatibility Score</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Summary
          </h3>
          <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
        </div>

        {/* Strengths */}
        {analysis.strengths.length > 0 && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-6">
            <h3 className="text-base font-semibold text-green-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              What You're Doing Well
            </h3>
            <ul className="space-y-2">
              {analysis.strengths.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-green-800">
                  <div className="w-5 h-5 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {analysis.weaknesses.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-6">
            <h3 className="text-base font-semibold text-red-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Areas for Improvement
            </h3>
            <ul className="space-y-2">
              {analysis.weaknesses.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-red-800">
                  <div className="w-5 h-5 bg-red-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing Keywords */}
        {analysis.missingKeywords.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-6">
            <h3 className="text-base font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Keywords to Include
            </h3>
            <div className="flex flex-wrap gap-2">
              {analysis.missingKeywords.map((keyword, i) => (
                <span key={i} className="px-3 py-1.5 bg-amber-100 text-amber-900 text-sm font-semibold rounded-lg border border-amber-200">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {generateError && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{generateError}</p>
          </div>
        )}

        {/* CTA */}
        <div className="card text-center py-8">
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Ready to optimize?</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            We'll rewrite your resume to include missing keywords and address the weaknesses above.
          </p>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary px-8 py-3 text-base">
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </span>
            ) : (
              'Generate Optimized Resume'
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
