import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'resume_analyzer.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_text TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    resume_id INTEGER NOT NULL,
    job_url TEXT NOT NULL,
    job_title TEXT,
    job_description TEXT,
    score INTEGER NOT NULL,
    summary TEXT NOT NULL,
    strengths TEXT NOT NULL,
    weaknesses TEXT NOT NULL,
    missing_keywords TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (resume_id) REFERENCES resumes(id)
  );

  CREATE TABLE IF NOT EXISTS generated_resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    analysis_id INTEGER NOT NULL,
    html_preview TEXT NOT NULL,
    resume_text TEXT NOT NULL,
    changes TEXT NOT NULL DEFAULT '[]',
    saved INTEGER NOT NULL DEFAULT 0,
    saved_filename TEXT,
    saved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (analysis_id) REFERENCES analyses(id)
  );
`);

// ─── Migrations (add columns to existing tables safely) ──────────────────────

function columnExists(table: string, column: string): boolean {
  const rows = db.pragma(`table_info(${table})`) as { name: string }[];
  return rows.some((r) => r.name === column);
}

if (!columnExists('generated_resumes', 'saved')) {
  db.exec(`ALTER TABLE generated_resumes ADD COLUMN saved INTEGER NOT NULL DEFAULT 0`);
}
if (!columnExists('generated_resumes', 'saved_filename')) {
  db.exec(`ALTER TABLE generated_resumes ADD COLUMN saved_filename TEXT`);
}
if (!columnExists('generated_resumes', 'saved_at')) {
  db.exec(`ALTER TABLE generated_resumes ADD COLUMN saved_at DATETIME`);
}
if (!columnExists('generated_resumes', 'changes')) {
  db.exec(`ALTER TABLE generated_resumes ADD COLUMN changes TEXT NOT NULL DEFAULT '[]'`);
}

export default db;

// ─── Typed row interfaces ────────────────────────────────────────────────────

export interface UserRow {
  id: number;
  email: string;
  password: string;
  name: string;
  created_at: string;
}

export interface ResumeRow {
  id: number;
  user_id: number;
  filename: string;
  original_text: string;
  file_path: string;
  uploaded_at: string;
}

export interface AnalysisRow {
  id: number;
  user_id: number;
  resume_id: number;
  job_url: string;
  job_title: string | null;
  job_description: string | null;
  score: number;
  summary: string;
  strengths: string;    // JSON string
  weaknesses: string;   // JSON string
  missing_keywords: string; // JSON string
  created_at: string;
}

export interface GeneratedResumeRow {
  id: number;
  user_id: number;
  analysis_id: number;
  html_preview: string;
  resume_text: string;
  changes: string; // JSON string
  saved: number;   // 0 or 1
  saved_filename: string | null;
  saved_at: string | null;
  created_at: string;
}
