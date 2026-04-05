import fs from 'fs';
import path from 'path';
// pdf-parse reads a test file at the package root when imported normally,
// which crashes under tsx. Import the inner lib directly to avoid that.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
import mammoth from 'mammoth';

/**
 * Parse text content from an uploaded resume file.
 * Supports PDF and DOCX/DOC formats.
 */
export async function parseResume(filePath: string, mimeType: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    return parsePdf(filePath);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    ext === '.docx' ||
    ext === '.doc'
  ) {
    return parseWord(filePath);
  }

  throw new Error(`Unsupported file type: ${mimeType || ext}`);
}

async function parsePdf(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return cleanText(data.text);
}

async function parseWord(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });

  if (result.messages && result.messages.length > 0) {
    const warnings = result.messages
      .filter((m) => m.type === 'warning')
      .map((m) => m.message);
    if (warnings.length > 0) {
      console.warn('Mammoth warnings:', warnings);
    }
  }

  return cleanText(result.value);
}

/**
 * Clean up extracted text: normalize whitespace, remove excessive blank lines.
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')       // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')         // Tabs → spaces
    .replace(/[ ]{3,}/g, '  ')    // Collapse multiple spaces
    .replace(/\n{4,}/g, '\n\n\n') // Collapse excessive blank lines
    .trim();
}
