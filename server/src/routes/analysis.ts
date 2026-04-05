import { Router, Response } from 'express';
import db, { ResumeRow, AnalysisRow } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { scrapeJobDescription } from '../services/scraper';
import { analyzeResumeWithClaude } from '../services/claude';

const router = Router();

// ─── POST /api/analysis/run ───────────────────────────────────────────────────
router.post('/run', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { jobUrl, resumeId } = req.body as {
    jobUrl?: string;
    resumeId?: number;
  };

  if (!jobUrl || !resumeId) {
    res.status(400).json({ error: 'jobUrl and resumeId are required' });
    return;
  }

  // Validate URL format
  try {
    new URL(jobUrl);
  } catch {
    res.status(400).json({ error: 'Invalid jobUrl — must be a valid URL' });
    return;
  }

  try {
    // Verify resume belongs to this user
    const resume = db
      .prepare<[number, number], ResumeRow>(
        'SELECT * FROM resumes WHERE id = ? AND user_id = ?'
      )
      .get(resumeId, req.userId!);

    if (!resume) {
      res.status(404).json({ error: 'Resume not found or does not belong to you' });
      return;
    }

    // Scrape job description
    const { jobDescription, jobTitle } = await scrapeJobDescription(jobUrl);

    if (!jobDescription || jobDescription.trim().length < 100) {
      res.status(422).json({
        error: 'Could not extract job description from the provided URL. Try a different job posting URL.',
      });
      return;
    }

    // Call Claude for ATS analysis
    const analysisResult = await analyzeResumeWithClaude(
      resume.original_text,
      jobDescription,
      jobTitle
    );

    // Store analysis
    const result = db
      .prepare(
        `INSERT INTO analyses
          (user_id, resume_id, job_url, job_title, job_description, score, summary, strengths, weaknesses, missing_keywords)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.userId,
        resumeId,
        jobUrl,
        analysisResult.jobTitle || jobTitle || null,
        jobDescription,
        analysisResult.score,
        analysisResult.summary,
        JSON.stringify(analysisResult.strengths),
        JSON.stringify(analysisResult.weaknesses),
        JSON.stringify(analysisResult.missingKeywords)
      );

    const analysisId = result.lastInsertRowid as number;

    res.status(201).json({
      analysisId,
      score: analysisResult.score,
      jobTitle: analysisResult.jobTitle || jobTitle,
      summary: analysisResult.summary,
      strengths: analysisResult.strengths,
      weaknesses: analysisResult.weaknesses,
      missingKeywords: analysisResult.missingKeywords,
    });
  } catch (err) {
    console.error('Analysis error:', err);
    const message = err instanceof Error ? err.message : 'Analysis failed';
    res.status(500).json({ error: message });
  }
});

// ─── GET /api/analysis/:analysisId ───────────────────────────────────────────
router.get('/:analysisId', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const analysisId = parseInt(req.params.analysisId, 10);

  if (isNaN(analysisId)) {
    res.status(400).json({ error: 'Invalid analysisId' });
    return;
  }

  try {
    const analysis = db
      .prepare<[number, number], AnalysisRow>(
        'SELECT * FROM analyses WHERE id = ? AND user_id = ?'
      )
      .get(analysisId, req.userId!);

    if (!analysis) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    res.json({
      analysisId: analysis.id,
      resumeId: analysis.resume_id,
      jobUrl: analysis.job_url,
      jobTitle: analysis.job_title,
      jobDescription: analysis.job_description,
      score: analysis.score,
      summary: analysis.summary,
      strengths: JSON.parse(analysis.strengths) as string[],
      weaknesses: JSON.parse(analysis.weaknesses) as string[],
      missingKeywords: JSON.parse(analysis.missing_keywords) as string[],
      createdAt: analysis.created_at,
    });
  } catch (err) {
    console.error('Get analysis error:', err);
    res.status(500).json({ error: 'Failed to retrieve analysis' });
  }
});

export default router;
