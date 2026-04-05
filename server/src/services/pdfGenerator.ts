import puppeteer from 'puppeteer';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  type ISpacingProperties,
} from 'docx';

// ─── PDF Generation ───────────────────────────────────────────────────────────

/**
 * Generate a PDF buffer from an HTML string using Puppeteer.
 */
export async function generatePdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    const pdfUint8Array = await page.pdf({
      format: 'Letter',
      margin: {
        top: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
        right: '0.75in',
      },
      printBackground: true,
    });

    return Buffer.from(pdfUint8Array);
  } finally {
    await browser.close();
  }
}

// ─── Word Generation ──────────────────────────────────────────────────────────

/**
 * Generate a .docx buffer from plain resume text using the docx library.
 * Lines that look like section headers (ALL CAPS or short, no punctuation)
 * are rendered as headings.
 */
export async function generateWord(resumeText: string): Promise<Buffer> {
  const lines = resumeText.split('\n');
  const docParagraphs: Paragraph[] = [];
  const nameLine = lines.find((l) => l.trim().length > 0) || '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      // Empty line — add spacing paragraph
      docParagraphs.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
        })
      );
      continue;
    }

    if (isSectionHeader(trimmed)) {
      docParagraphs.push(
        new Paragraph({
          text: trimmed,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          border: {
            bottom: {
              color: '333333',
              space: 1,
              style: 'single',
              size: 6,
            },
          },
        })
      );
    } else if (trimmed === nameLine) {
      // First non-empty line — treat as the person's name
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              size: 28, // 14pt
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
        })
      );
    } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      // Bullet point
      const bulletText = trimmed.replace(/^[•\-*]\s*/, '');
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: bulletText }),
          ],
          bullet: { level: 0 },
          spacing: { before: 40, after: 40 },
        })
      );
    } else {
      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed })],
          spacing: { before: 40, after: 40 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,   // 0.5in in twentieths of a point
              bottom: 720,
              left: 1080, // 0.75in
              right: 1080,
            },
          },
        },
        children: docParagraphs,
      },
    ],
    styles: {
      paragraphStyles: [
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            bold: true,
            size: 24, // 12pt
            color: '1a1a1a',
          },
          paragraph: {
            spacing: {
              before: 240,
              after: 120,
            } as ISpacingProperties,
          },
        },
      ],
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const KNOWN_HEADERS = new Set([
  'SUMMARY', 'OBJECTIVE', 'PROFILE', 'ABOUT',
  'EXPERIENCE', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'EMPLOYMENT',
  'EDUCATION', 'SKILLS', 'TECHNICAL SKILLS', 'CORE COMPETENCIES',
  'CERTIFICATIONS', 'CERTIFICATES', 'AWARDS', 'PUBLICATIONS',
  'PROJECTS', 'VOLUNTEER', 'LANGUAGES', 'INTERESTS', 'REFERENCES',
  'ACHIEVEMENTS', 'ACCOMPLISHMENTS', 'PROFESSIONAL DEVELOPMENT',
]);

function isSectionHeader(line: string): boolean {
  const upper = line.toUpperCase().replace(/[:]/g, '').trim();

  // Exact match to known headers
  if (KNOWN_HEADERS.has(upper)) return true;

  // All-caps line, short, no digits — likely a custom section header
  if (
    line === line.toUpperCase() &&
    line.length <= 40 &&
    !/\d/.test(line) &&
    /^[A-Z\s&/()-]+$/.test(line)
  ) {
    return true;
  }

  return false;
}

