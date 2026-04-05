import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db, { ResumeRow } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { parseResume } from '../services/parser';

const router = Router();

// ─── Multer configuration ────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_');
    cb(null, `${base}_${timestamp}${ext}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowed = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  const allowedExts = ['.pdf', '.docx', '.doc'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Word documents (.pdf, .docx) are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─── POST /api/resume/upload ──────────────────────────────────────────────────
router.post(
  '/upload',
  requireAuth,
  upload.single('resume'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Use field name "resume".' });
      return;
    }

    try {
      const parsedText = await parseResume(req.file.path, req.file.mimetype);

      if (!parsedText || parsedText.trim().length < 50) {
        fs.unlinkSync(req.file.path);
        res.status(422).json({ error: 'Could not extract readable text from the file' });
        return;
      }

      const result = db
        .prepare(
          'INSERT INTO resumes (user_id, filename, original_text, file_path) VALUES (?, ?, ?, ?)'
        )
        .run(req.userId, req.file.originalname, parsedText.trim(), req.file.path);

      const resumeId = result.lastInsertRowid as number;

      const resume = db
        .prepare<[number], ResumeRow>('SELECT * FROM resumes WHERE id = ?')
        .get(resumeId)!;

      res.status(201).json({
        resumeId: resume.id,
        filename: resume.filename,
        text: resume.original_text,
        uploadedAt: resume.uploaded_at,
      });
    } catch (err) {
      console.error('Upload error:', err);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Failed to process uploaded file' });
    }
  }
);

// ─── GET /api/resume/list ────────────────────────────────────────────────────
router.get(
  '/list',
  requireAuth,
  (req: AuthenticatedRequest, res: Response): void => {
    try {
      const rows = db
        .prepare<[number], ResumeRow>(
          'SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC'
        )
        .all(req.userId!);

      res.json({
        resumes: rows.map((r) => ({
          id: r.id,
          filename: r.filename,
          uploadedAt: r.uploaded_at,
        })),
      });
    } catch (err) {
      console.error('List resumes error:', err);
      res.status(500).json({ error: 'Failed to list resumes' });
    }
  }
);

// ─── GET /api/resume/current ──────────────────────────────────────────────────
router.get(
  '/current',
  requireAuth,
  (req: AuthenticatedRequest, res: Response): void => {
    try {
      const resume = db
        .prepare<[number], ResumeRow>(
          'SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 1'
        )
        .get(req.userId!);

      if (!resume) {
        res.status(404).json({ error: 'No resume found for this user' });
        return;
      }

      res.json({
        resumeId: resume.id,
        filename: resume.filename,
        text: resume.original_text,
        uploadedAt: resume.uploaded_at,
      });
    } catch (err) {
      console.error('Get current resume error:', err);
      res.status(500).json({ error: 'Failed to retrieve resume' });
    }
  }
);

export default router;
