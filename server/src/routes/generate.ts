import { Router, Response } from 'express';
import db, { AnalysisRow, GeneratedResumeRow, UserRow } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { generateImprovedResume } from '../services/claude';
import { generatePdf, generateWord } from '../services/pdfGenerator';
import { sendResumeEmail } from '../services/emailService';

const router = Router();

// ─── GET /api/generate/resume/:id ────────────────────────────────────────────
router.get('/resume/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const generated = db
    .prepare<[number, number], GeneratedResumeRow>(
      'SELECT * FROM generated_resumes WHERE id = ? AND user_id = ?'
    )
    .get(id, req.userId!);

  if (!generated) {
    res.status(404).json({ error: 'Generated resume not found' });
    return;
  }

  const user = db
    .prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?')
    .get(req.userId!);

  const analysis = db
    .prepare<[number], AnalysisRow>('SELECT * FROM analyses WHERE id = ?')
    .get(generated.analysis_id);

  const suggestedFilename = buildFilename(user?.name ?? '', analysis?.job_url ?? '');

  res.json({
    id: generated.id,
    analysisId: generated.analysis_id,
    htmlPreview: generated.html_preview,
    changes: JSON.parse(generated.changes) as ResumeChange[],
    suggestedFilename,
  });
});

// ─── POST /api/generate/resume ────────────────────────────────────────────────
router.post('/resume', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { analysisId } = req.body as { analysisId?: number | string };

  if (!analysisId) {
    res.status(400).json({ error: 'analysisId is required' });
    return;
  }

  const analysisIdNum = Number(analysisId);

  try {
    const analysis = db
      .prepare<[number, number], AnalysisRow>(
        'SELECT * FROM analyses WHERE id = ? AND user_id = ?'
      )
      .get(analysisIdNum, req.userId!);

    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    const resume = db
      .prepare<[number], { original_text: string }>(
        'SELECT original_text FROM resumes WHERE id = ?'
      )
      .get(analysis.resume_id);

    if (!resume) {
      res.status(404).json({ error: 'Associated resume not found' });
      return;
    }

    const weaknesses = JSON.parse(analysis.weaknesses) as string[];
    const missingKeywords = JSON.parse(analysis.missing_keywords) as string[];
    const strengths = JSON.parse(analysis.strengths) as string[];

    const generated = await generateImprovedResume(
      resume.original_text,
      analysis.job_description || '',
      analysis.job_title || '',
      { strengths, weaknesses, missingKeywords }
    );

    const htmlPreview = buildHtmlPreview(generated.improvedResumeText, generated.changes);

    const result = db
      .prepare(
        'INSERT INTO generated_resumes (user_id, analysis_id, html_preview, resume_text, changes) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        req.userId,
        analysisIdNum,
        htmlPreview,
        generated.improvedResumeText,
        JSON.stringify(generated.changes)
      );

    const generatedResumeId = result.lastInsertRowid as number;

    res.status(201).json({
      generatedResumeId,
      analysisId: analysisIdNum,
      htmlPreview,
      changes: generated.changes,
    });
  } catch (err) {
    console.error('Generate resume error:', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    res.status(500).json({ error: message });
  }
});

// ─── POST /api/generate/save/:id ─────────────────────────────────────────────
router.post('/save/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const generated = db
    .prepare<[number, number], GeneratedResumeRow>(
      'SELECT * FROM generated_resumes WHERE id = ? AND user_id = ?'
    )
    .get(id, req.userId!);

  if (!generated) { res.status(404).json({ error: 'Generated resume not found' }); return; }

  const user = db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(req.userId!);
  const analysis = db.prepare<[number], AnalysisRow>('SELECT * FROM analyses WHERE id = ?').get(generated.analysis_id);
  const filename = buildFilename(user?.name ?? '', analysis?.job_url ?? '');

  db.prepare(
    'UPDATE generated_resumes SET saved = 1, saved_filename = ?, saved_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(filename, id);

  res.json({ saved: true, filename });
});

// ─── GET /api/generate/saved ──────────────────────────────────────────────────
router.get('/saved', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const rows = db
    .prepare<[number], GeneratedResumeRow & { job_title: string | null; job_url: string }>(
      `SELECT gr.*, a.job_title, a.job_url
       FROM generated_resumes gr
       JOIN analyses a ON a.id = gr.analysis_id
       WHERE gr.user_id = ? AND gr.saved = 1
       ORDER BY gr.saved_at DESC`
    )
    .all(req.userId!);

  res.json({
    resumes: rows.map((r) => ({
      id: r.id,
      filename: r.saved_filename,
      jobTitle: r.job_title,
      jobUrl: r.job_url,
      savedAt: r.saved_at,
      analysisId: r.analysis_id,
    })),
  });
});

// ─── POST /api/generate/download ─────────────────────────────────────────────
router.post('/download', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { generatedResumeId, format } = req.body as {
    generatedResumeId?: number | string;
    format?: 'pdf' | 'word';
  };

  if (!generatedResumeId) {
    res.status(400).json({ error: 'generatedResumeId is required' });
    return;
  }

  const fmt = format || 'pdf';
  if (!['pdf', 'word'].includes(fmt)) {
    res.status(400).json({ error: 'format must be "pdf" or "word"' });
    return;
  }

  try {
    const generated = db
      .prepare<[number, number], GeneratedResumeRow>(
        'SELECT * FROM generated_resumes WHERE id = ? AND user_id = ?'
      )
      .get(Number(generatedResumeId), req.userId!);

    if (!generated) {
      res.status(404).json({ error: 'Generated resume not found' });
      return;
    }

    const dlUser = db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(req.userId!);
    const dlAnalysis = db.prepare<[number], AnalysisRow>('SELECT * FROM analyses WHERE id = ?').get(generated.analysis_id);
    const baseName = buildFilename(dlUser?.name ?? '', dlAnalysis?.job_url ?? '');

    if (fmt === 'pdf') {
      const pdfBuffer = await generatePdf(generated.html_preview);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      });
      res.end(pdfBuffer);
    } else {
      const wordBuffer = await generateWord(generated.resume_text);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${baseName}.docx"`,
        'Content-Length': wordBuffer.length.toString(),
      });
      res.end(wordBuffer);
    }
  } catch (err) {
    console.error('Download error:', err);
    const message = err instanceof Error ? err.message : 'Download failed';
    res.status(500).json({ error: message });
  }
});

// ─── POST /api/generate/email ─────────────────────────────────────────────────
router.post('/email', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { generatedResumeId, format } = req.body as {
    generatedResumeId?: number | string;
    format?: 'pdf' | 'word';
  };

  if (!generatedResumeId) {
    res.status(400).json({ error: 'generatedResumeId is required' });
    return;
  }

  const fmt = format || 'pdf';

  try {
    const generated = db
      .prepare<[number, number], GeneratedResumeRow>(
        'SELECT * FROM generated_resumes WHERE id = ? AND user_id = ?'
      )
      .get(Number(generatedResumeId), req.userId!);

    if (!generated) {
      res.status(404).json({ error: 'Generated resume not found' });
      return;
    }

    const user = db
      .prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?')
      .get(req.userId!);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let fileBuffer: Buffer;
    let filename: string;
    let mimeType: string;

    if (fmt === 'pdf') {
      fileBuffer = await generatePdf(generated.html_preview);
      filename = 'resume_improved.pdf';
      mimeType = 'application/pdf';
    } else {
      fileBuffer = await generateWord(generated.resume_text);
      filename = 'resume_improved.docx';
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    await sendResumeEmail({
      to: user.email,
      name: user.name,
      fileBuffer,
      filename,
      mimeType,
    });

    res.json({ message: `Resume sent to ${user.email}` });
  } catch (err) {
    console.error('Email error:', err);
    const message = err instanceof Error ? err.message : 'Email failed';
    res.status(500).json({ error: message });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a download filename: "[Name] - [Company] - [YYYYMMDD]"
 * Company is derived from the job URL hostname.
 */
function buildFilename(userName: string, jobUrl: string): string {
  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');

  const company = jobUrl ? extractCompanyName(jobUrl) : 'Company';
  const name = userName.trim() || 'Resume';
  const safe = (s: string) => s.replace(/[/\\:*?"<>|]/g, '').trim();

  return `${safe(name)} - ${safe(company)} - ${date}`;
}

/**
 * Extract a human-readable company name from a job URL.
 * "otter.ai"          → "Otter AI"
 * "stripe.com"        → "Stripe"
 * "boards.greenhouse.io" → "Greenhouse IO"
 * "jobs.lever.co/acme" → "Acme"
 */
function extractCompanyName(jobUrl: string): string {
  try {
    let hostname = new URL(jobUrl).hostname.toLowerCase();

    // Strip known job-board subdomains
    hostname = hostname.replace(/^(www|jobs|careers|boards|apply|hire|recruiting|talent)\./i, '');

    const parts = hostname.split('.');
    const tld = parts[parts.length - 1];
    const domain = parts.slice(0, -1); // everything before the TLD

    // TLDs that are part of the brand (keep them)
    const brandTLDs = new Set(['ai', 'io', 'co', 'app', 'dev', 'tech', 'gg', 'tv', 'so', 'xyz']);

    const result = brandTLDs.has(tld) ? [...domain, tld] : domain;

    return result
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  } catch {
    return 'Company';
  }
}

interface ResumeChange {
  section: string;
  original: string;
  improved: string;
}

function buildHtmlPreview(resumeText: string, changes: ResumeChange[]): string {
  let htmlBody = escapeHtml(resumeText);

  for (const change of changes) {
    if (!change.improved) continue;
    const escapedImproved = escapeHtml(change.improved);
    const highlighted = `<mark style="background-color: #fef08a">${escapedImproved}</mark>`;
    htmlBody = htmlBody.replace(escapedImproved, highlighted);
  }

  const paragraphs = htmlBody
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Improved Resume</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      margin: 1in;
      color: #111;
    }
    p { margin: 0.4em 0; }
    mark {
      background-color: #fef08a;
      padding: 0 2px;
      border-radius: 2px;
    }
  </style>
</head>
<body>
${paragraphs}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default router;
