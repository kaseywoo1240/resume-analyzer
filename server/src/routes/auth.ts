import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { UserRow } from '../db';
import { sanitizeString, sanitizeEmail, limitLength } from '../utils/sanitize';

const router = Router();

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  if (process.env.REGISTRATION_OPEN !== 'true') {
    res.status(403).json({ error: 'Registration is currently closed.' });
    return;
  }

  const email    = sanitizeEmail(req.body?.email);
  const password = sanitizeString(req.body?.password);
  const name     = limitLength(sanitizeString(req.body?.name), 100);

  if (!email || !password || !name) {
    res.status(400).json({ error: 'email, password, and name are required' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  if (password.length > 128) {
    res.status(400).json({ error: 'Password too long' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  try {
    const existing = db
      .prepare<[string], UserRow>('SELECT id FROM users WHERE email = ?')
      .get(email);

    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = db
      .prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)')
      .run(email, hashedPassword, name);

    const userId = result.lastInsertRowid as number;

    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ userId, email }, secret, { expiresIn: '7d' });

    res.status(201).json({ token, user: { id: userId, email, name } });
  } catch (err) {
    console.error('Registration error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Registration failed', detail: message });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const email    = sanitizeEmail(req.body?.email);
  const password = sanitizeString(req.body?.password);

  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    const user = db
      .prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?')
      .get(email);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
