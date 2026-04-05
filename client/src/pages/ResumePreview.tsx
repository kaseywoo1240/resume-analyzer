import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

interface Change {
  section: string;
  original: string;
  improved: string;
}

interface GeneratedResume {
  id: number;
  analysisId: number;
  htmlPreview: string;
  changes: Change[];
  suggestedFilename: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-enter pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {t.type === 'success' ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {t.message}
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-80 hover:opacity-100">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

function ChangeItem({ change }: { change: Change }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-800">{change.section}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 bg-white">
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Before</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{change.original}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold text-green-500 uppercase tracking-wide mb-2">After</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{change.improved}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResumePreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const toastCounter = useRef(0);

  const [resume, setResume] = useState<GeneratedResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [changesOpen, setChangesOpen] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<GeneratedResume>(`/generate/resume/${id}`)
      .then(({ data }) => setResume(data))
      .catch(() => setError('Could not load your optimized resume.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!resume?.htmlPreview || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(resume.htmlPreview);
      doc.close();
    }
  }, [resume]);

  const addToast = (message: string, type: 'success' | 'error') => {
    const tid = ++toastCounter.current;
    setToasts((prev) => [...prev, { id: tid, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== tid)), 4000);
  };

  const handleDownload = async (format: 'pdf' | 'word') => {
    if (!resume) return;
    const setter = format === 'pdf' ? setDownloadingPdf : setDownloadingWord;
    setter(true);
    try {
      const response = await apiClient({
        method: 'POST',
        url: '/generate/download',
        data: { format, generatedResumeId: resume.id },
        responseType: 'blob',
      });
      const blob = new Blob([response.data as BlobPart], {
        type: format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const base = resume?.suggestedFilename ?? 'Resume';
      a.download = `${base}.${format === 'pdf' ? 'pdf' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast(`Resume downloaded as ${format.toUpperCase()}`, 'success');
    } catch {
      addToast(`Failed to download ${format.toUpperCase()}. Please try again.`, 'error');
    } finally {
      setter(false);
    }
  };

  const handleEmail = async () => {
    if (!resume) return;
    setEmailing(true);
    try {
      await apiClient.post('/generate/email', { generatedResumeId: resume.id, format: 'pdf' });
      addToast('Resume sent to your email!', 'success');
    } catch {
      addToast('Failed to send email. Please try again.', 'error');
    } finally {
      setEmailing(false);
    }
  };

  const handleSave = async () => {
    if (!resume) return;
    setSaving(true);
    try {
      await apiClient.post(`/generate/save/${resume.id}`);
      setSaved(true);
      addToast(`Saved! Redirecting to dashboard...`, 'success');
      setTimeout(() => navigate('/dashboard', { state: { justSaved: true } }), 1500);
    } catch {
      addToast('Failed to save. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = () => {
    if (resume?.analysisId) {
      navigate(`/analysis/${resume.analysisId}`);
    } else {
      navigate('/job');
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
          <p className="text-gray-600 font-medium">Loading your optimized resume...</p>
        </div>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium mb-4">{error || 'Resume not found.'}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={(tid) => setToasts((prev) => prev.filter((t) => t.id !== tid))} />

      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={handleReject} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="font-semibold text-gray-900">Optimized Resume</span>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </button>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Optimized Resume</h2>
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded bg-yellow-300 border border-yellow-400" />
              Changes are highlighted in yellow
            </p>
          </div>

          {/* Preview iframe */}
          <div className="card p-0 overflow-hidden">
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs text-gray-500 ml-1">Resume Preview</span>
            </div>
            <iframe
              ref={iframeRef}
              title="Optimized Resume Preview"
              sandbox="allow-same-origin"
              className="w-full border-0"
              style={{ height: '70vh', minHeight: 500 }}
            />
          </div>

          {/* Changes summary */}
          {resume.changes.length > 0 && (
            <div className="card">
              <button
                onClick={() => setChangesOpen((o) => !o)}
                className="w-full flex items-center justify-between text-left"
              >
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  What Changed
                  <span className="ml-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    {resume.changes.length}
                  </span>
                </h3>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${changesOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {changesOpen && (
                <div className="mt-4 space-y-2">
                  {resume.changes.map((change, i) => (
                    <ChangeItem key={i} change={change} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Accept &amp; Save</h3>

            {/* Save to account */}
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-4">
              <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-indigo-900">Save to your account</p>
                <p className="text-xs text-indigo-600 mt-0.5">
                  Saved as: <span className="font-medium">{resume.suggestedFilename}</span>
                </p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  saved
                    ? 'bg-green-100 text-green-700 cursor-default'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                }`}
              >
                {saved ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                ) : saving ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </span>
                ) : 'Save'}
              </button>
            </div>

            <h3 className="text-base font-semibold text-gray-900 mb-3">Download or Share</h3>
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <button
                onClick={() => handleDownload('pdf')}
                disabled={downloadingPdf}
                className="btn-primary flex-1 sm:flex-none py-2.5 px-5"
              >
                {downloadingPdf ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Downloading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Accept &amp; Download PDF
                  </span>
                )}
              </button>

              <button
                onClick={() => handleDownload('word')}
                disabled={downloadingWord}
                className="btn-primary flex-1 sm:flex-none py-2.5 px-5 !bg-blue-600 hover:!bg-blue-700"
              >
                {downloadingWord ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Downloading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Accept &amp; Download Word
                  </span>
                )}
              </button>

              <button
                onClick={handleEmail}
                disabled={emailing}
                className="btn-primary flex-1 sm:flex-none py-2.5 px-5 !bg-green-600 hover:!bg-green-700"
              >
                {emailing ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email to Me
                  </span>
                )}
              </button>

              <button onClick={handleReject} className="btn-secondary flex-1 sm:flex-none py-2.5 px-5">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject Changes
                </span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
