import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Import routes
import authRoutes from './routes/auth';
import resumeRoutes from './routes/resume';
import analysisRoutes from './routes/analysis';
import generateRoutes from './routes/generate';

// Import DB to trigger initialization on startup
import './db';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ─── Rate limiters ───────────────────────────────────────────────────────────

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again in 15 minutes.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request limit reached. Please wait an hour before trying again.' },
});

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      // Allow localhost for local dev
      if (origin.includes('localhost')) return callback(null, true);
      // Allow any vercel.app subdomain
      if (origin.includes('vercel.app')) return callback(null, true);
      // Allow the explicit CLIENT_URL
      if (origin === CLIENT_URL) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files (optional static access)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/analysis', aiLimiter, analysisRoutes);
app.use('/api/generate', aiLimiter, generateRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use(
  (
    err: Error & { status?: number; code?: string },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File too large. Maximum size is 10 MB.' });
      return;
    }

    const status = err.status || 500;
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Internal server error';

    res.status(status).json({ error: message });
  }
);

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Resume Analyzer API running on http://localhost:${PORT}`);
  console.log(`Accepting requests from: ${CLIENT_URL}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
